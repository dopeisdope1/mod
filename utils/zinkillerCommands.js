const { PermissionFlagsBits } = require("discord.js");
const { buildStatusEmbed } = require("./statusEmbed");
const { can } = require("./permissions/engine");
const { checkHierarchy, checkBotPermission, report } = require("./moderation/actions");
const { parseDuration, formatDuration } = require("./moderationCommands");
const zinkillerStore = require("./zinkillerStore");
const banReasonsStore = require("./banReasonsStore");
const listNavigator = require("./listNavigator");

// "-zinkiller"/"-unzinkiller" — ban PERSISTANT : re-banni automatiquement si
// quelqu'un le débannit autrement que par -unzinkiller (Discord natif, un
// autre bot...) — voir l'écouteur guildBanRemove dans index.js et
// utils/zinkillerStore.js. Distinct de -ban/-unban (utils/banPanel.js), qui
// restent un bannissement Discord ordinaire, sans ce filet.
const PERMISSION = "moderation.zinkiller";

const reply = (message, kind, text) => message.reply(buildStatusEmbed(kind, text, { guildId: message.guild.id }));

function parseTarget(args) {
  const mention = args[0]?.match(/^<@!?(\d{15,25})>$/);
  const id = args[0]?.match(/^\d{15,25}$/);
  return mention?.[1] || id?.[0] || null;
}

const GRADES = { 1: "Mineur", 2: "Modéré", 3: "Grave", 4: "Sévère", 5: "Critique" };

/** Extrait "preuve:<lien/texte>", "grade:<1-5>", "duree:<Xs/m/h/d>" et "raisonid:<id>" du reste des args, où qu'ils soient — le reste forme la raison libre. */
function parseEnrichissement(reste) {
  let preuve = null;
  let grade = null;
  let dureeBrute = null;
  let raisonId = null;
  const mots = [];
  for (const mot of reste) {
    const mPreuve = mot.match(/^preuve:(.+)$/i);
    const mGrade = mot.match(/^grade:([1-5])$/i);
    const mDuree = mot.match(/^duree:(.+)$/i);
    const mRaisonId = mot.match(/^raisonid:(.+)$/i);
    if (mPreuve) preuve = mPreuve[1];
    else if (mGrade) grade = Number(mGrade[1]);
    else if (mDuree) dureeBrute = mDuree[1];
    else if (mRaisonId) raisonId = mRaisonId[1];
    else mots.push(mot);
  }
  return { preuve, grade, dureeBrute, raisonId, reason: mots.join(" ") || null };
}

/** "-zinkiller <@membre|id> [raisonid:<id>] [preuve:<lien>] [grade:1-5] [duree:<Xs/m/h/d>] [raison]" — bannit et rend le bannissement persistant (permanent par défaut, temporaire si "duree:" est donné). */
async function zinkiller(client, message, args) {
  if (!can(message.member, PERMISSION)) return;

  const targetId = parseTarget(args);
  if (!targetId) {
    return reply(
      message,
      "error",
      "Indique un membre (mention ou identifiant) : `zinkiller @membre|id [raisonid:<id>] [preuve:<lien>] [grade:1-5] [duree:<Xs/m/h/d>] [raison]`."
    );
  }
  if (targetId === message.author.id) return reply(message, "error", "Tu ne peux pas agir sur toi-même.");

  const botPerm = checkBotPermission(message.guild, PermissionFlagsBits.BanMembers, "BanMembers");
  if (botPerm) return reply(message, "error", botPerm);

  const targetMember = await message.guild.members.fetch(targetId).catch(() => null);
  if (targetMember) {
    const refusal = checkHierarchy(message.guild, message.member, targetMember);
    if (refusal) return reply(message, "error", refusal);
  }

  const { preuve, grade, dureeBrute, raisonId, reason: raisonLibre } = parseEnrichissement(args.slice(1));

  let raisonPredefinie = null;
  if (raisonId) {
    raisonPredefinie = banReasonsStore.get(message.guild.id, raisonId);
    if (!raisonPredefinie) return reply(message, "error", "Identifiant de raison inconnu (voir `reasonlist`).");
  }
  if (raisonPredefinie?.requiresProof && !preuve) {
    return reply(message, "error", `La raison **${raisonPredefinie.label}** exige une preuve : ajoute \`preuve:<lien>\`.`);
  }
  const reason = raisonPredefinie?.label || raisonLibre;

  let dureeMs = null;
  if (dureeBrute) {
    dureeMs = parseDuration(dureeBrute);
    if (!dureeMs) return reply(message, "error", "Durée invalide (ex: `duree:7d`) — laisse `duree:` de côté pour un ban permanent.");
  }

  const targetTag = targetMember?.user.tag || targetId;

  try {
    await message.guild.members.ban(targetId, { reason: reason || `zinkiller — par ${message.author.tag}` });
  } catch (err) {
    return reply(message, "error", `Discord a refusé : ${err.message}`);
  }

  const expiresAt = dureeMs ? Date.now() + dureeMs : null;
  zinkillerStore.add(message.guild.id, targetId, { reason, moderatorId: message.author.id, preuve, grade, expiresAt });

  await report(client, {
    guildId: message.guild.id,
    title: "Blacklist mise à jour",
    fields: [
      { label: "Cible", value: `<@${targetId}> (${targetId})` },
      { label: "Durée", value: dureeMs ? formatDuration(dureeMs) : "Permanente" },
      ...(grade ? [{ label: "Grade", value: `${grade} — ${GRADES[grade]}` }] : []),
      ...(preuve ? [{ label: "Preuve", value: preuve }] : []),
    ],
    action: "zinkiller",
    targetId,
    targetTag,
    moderator: message.author,
    reason,
    channelId: message.channel.id,
  });

  return reply(
    message,
    "success",
    `**${targetTag}** banni ${dureeMs ? `pour ${formatDuration(dureeMs)}` : "définitivement"} et re-banni automatiquement s'il est débanni ailleurs que par \`unzinkiller\`.`
  );
}

/** "-unzinkiller <@membre|id>" — débannit et retire le ban persistant. */
async function unzinkiller(client, message, args) {
  if (!can(message.member, PERMISSION)) return;

  const targetId = parseTarget(args);
  if (!targetId) return reply(message, "error", "Indique un membre (mention ou identifiant) : `unzinkiller @membre|id`.");

  const botPerm = checkBotPermission(message.guild, PermissionFlagsBits.BanMembers, "BanMembers");
  if (botPerm) return reply(message, "error", botPerm);

  const existing = await message.guild.bans.fetch(targetId).catch(() => null);
  if (!existing) return reply(message, "error", "Cet identifiant ne figure pas dans la liste des bannis.");

  const removed = zinkillerStore.remove(message.guild.id, targetId);

  try {
    await message.guild.bans.remove(targetId, `Unzinkiller par ${message.author.tag}`);
  } catch (err) {
    if (removed) zinkillerStore.add(message.guild.id, targetId, removed);
    return reply(message, "error", `Discord a refusé : ${err.message}`);
  }

  await report(client, {
    guildId: message.guild.id,
    title: "Blacklist retirée",
    fields: [
      { label: "Cible", value: `<@${targetId}> (${targetId})` },
      ...(removed?.grade ? [{ label: "Grade appliqué", value: `${removed.grade} — ${GRADES[removed.grade]}` }] : []),
      { label: "Ban sur ny", value: "levé" },
    ],
    action: "unzinkiller",
    targetId,
    targetTag: existing.user.tag,
    moderator: message.author,
    channelId: message.channel.id,
  });

  return reply(message, "success", `**${existing.user.tag}** débanni, le ban persistant est retiré.`);
}

/** Appelé périodiquement (voir index.js) pour débannir les blacklist temporaires arrivées à échéance. */
async function checkExpiredZinkillers(client) {
  const expired = zinkillerStore.getExpired();
  for (const entry of expired) {
    zinkillerStore.remove(entry.guildId, entry.userId);
    const guild = client.guilds.cache.get(entry.guildId);
    if (!guild) continue;
    await guild.bans.remove(entry.userId, "Fin de la blacklist temporaire").catch(() => {});
    await report(client, {
      guildId: entry.guildId,
      title: "Blacklist retirée — expiration",
      fields: [
        { label: "Cible", value: `<@${entry.userId}> (${entry.userId})` },
        ...(entry.grade ? [{ label: "Grade appliqué", value: `${entry.grade} — ${GRADES[entry.grade]}` }] : []),
        { label: "Ban sur ny", value: "levé" },
      ],
      action: "zinkiller_expire",
      targetId: entry.userId,
      targetTag: null,
      moderator: client.user,
      channelId: null,
    }).catch(() => {});
  }
}

/** "-zinkillerlist" — membres sous ban persistant sur ce serveur, un seul message paginé. */
async function zinkillerlist(client, message) {
  if (!can(message.member, PERMISSION)) return;
  return listNavigator.repondreAvecListe("zinkillerlist", message);
}

listNavigator.registerProvider("zinkillerlist", (guild) => {
  const entries = zinkillerStore.list(guild.id);
  return {
    title: "Bans persistants",
    vide: "Aucun ban persistant actif sur ce serveur.",
    numerote: true,
    lines: entries.map((e) =>
      [
        `<@${e.userId}> (${e.userId}) — par <@${e.moderatorId}>`,
        e.grade ? `grade ${e.grade} (${GRADES[e.grade]})` : null,
        e.reason ? `raison : ${e.reason}` : null,
        e.preuve ? `preuve : ${e.preuve}` : null,
        e.expiresAt ? `fin : <t:${Math.floor(e.expiresAt / 1000)}:R>` : "permanente",
      ]
        .filter(Boolean)
        .join(" — ")
    ),
  };
});

module.exports = { zinkiller, unzinkiller, zinkillerlist, checkExpiredZinkillers };
