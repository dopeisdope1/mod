const { PermissionFlagsBits } = require("discord.js");
const { buildStatusEmbed } = require("./statusEmbed");
const { can } = require("./permissions/engine");
const permStore = require("./permissions/store");
const permCatalog = require("./permissions/catalog");
const accessStore = require("./accessStore");
const { getPrefix, setPrefix } = require("./prefixStore");

const reply = (message, kind, text) => message.reply({ embeds: [buildStatusEmbed(kind, text)] });

/** "prefix <nouveau>" — réservé au rang sys, comme sur les autres bots. */
async function prefix(client, message, args) {
  if (!can(message.member, "sys")) return;
  const nouveau = (args[0] || "").trim();
  if (!nouveau) return reply(message, "info", `Préfixe actuel : \`${getPrefix(message.guild.id)}\``);
  if (nouveau.length > 3 || /\s/.test(nouveau)) {
    return reply(message, "error", "Un préfixe fait 3 caractères au maximum, sans espace.");
  }
  setPrefix(message.guild.id, nouveau);
  return reply(message, "success", `Préfixe changé pour \`${nouveau}\`.`);
}

/** "rename <nouveau nom>" — réservé au rang sys, comme prefix. */
async function rename(client, message, args) {
  if (!can(message.member, "sys")) return;
  const nouveau = args.join(" ").trim();
  if (!nouveau) return reply(message, "error", "Indique un nom : `rename <nouveau nom>`.");
  if (nouveau.length > 32) return reply(message, "error", "Un pseudo Discord fait 32 caractères au maximum.");
  if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ChangeNickname)) {
    return reply(message, "error", "Il me manque la permission **Changer de pseudo**.");
  }
  try {
    await message.guild.members.me.setNickname(nouveau);
  } catch (err) {
    return reply(message, "error", `Discord a refusé : ${err.message}`);
  }
  return reply(message, "success", `Renommé en **${nouveau}** sur ce serveur.`);
}

function parseTargetId(arg) {
  const mentionMatch = arg?.match(/^<@!?(\d{15,25})>$/);
  const idMatch = arg?.match(/^\d{15,25}$/);
  return mentionMatch?.[1] || idMatch?.[0] || null;
}

/** "owner <@membre>" — bascule TOUT l'accès de modération individuel d'un coup. */
async function owner(client, message, args) {
  if (!can(message.member, "panel.permissions.manage")) return;
  const targetId = parseTargetId(args[0]);
  if (!targetId) return reply(message, "error", "Indique un membre (mention ou identifiant) : `owner @membre`.");
  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (!target) return reply(message, "error", "Ce membre n'est pas sur le serveur.");

  const roleGrantableKeys = permCatalog.CATALOG.filter((p) => p.roleGrantable !== false).map((p) => p.key);
  const granted = permStore.getUserGrants(message.guild.id, target.id);
  const hasAll = roleGrantableKeys.every((key) => granted.includes(key));

  if (hasAll) {
    for (const key of roleGrantableKeys) permStore.revokeFromUser(message.guild.id, target.id, key);
    return reply(message, "success", `${target.user.tag} — accès de modération complet retiré.`);
  }
  for (const key of roleGrantableKeys) {
    if (!granted.includes(key)) permStore.grantToUser(message.guild.id, target.id, key);
  }
  return reply(message, "success", `${target.user.tag} a maintenant accès à toutes les commandes de modération courantes (hors ban de masse).`);
}

/** "setrole @rôle <clé>" — accorde/retire une clé du catalogue à un rôle entier. */
async function setrole(client, message, args) {
  if (!can(message.member, "panel.permissions.manage")) return;
  const roleMatch = args[0]?.match(/^<@&(\d{15,25})>$/) || args[0]?.match(/^(\d{15,25})$/);
  const role = roleMatch && message.guild.roles.cache.get(roleMatch[1]);
  if (!role) return reply(message, "error", "Indique un rôle : `setrole @rôle <clé>`.");
  const key = (args[1] || "").trim();
  const valide = permCatalog.CATALOG.find((p) => p.key === key);
  if (!valide) {
    return reply(message, "error", `Clé inconnue. Clés valides : ${permCatalog.CATALOG.map((p) => `\`${p.key}\``).join(", ")}.`);
  }
  if (valide.roleGrantable === false) {
    return reply(message, "error", `\`${key}\` ne peut jamais être accordée à un rôle — seulement en octroi individuel (owner) ou au rang sys.`);
  }
  const current = permStore.getRoleGrants(message.guild.id, role.id);
  const already = current.includes(key);
  const next = already ? current.filter((k) => k !== key) : [...current, key];
  permStore.setRoleGrants(message.guild.id, role.id, next);
  return reply(message, "success", `${role.name} — \`${key}\` ${already ? "retirée" : "accordée"}.`);
}

/** "sysadd"/"sysdel" — rang sys, réservé au propriétaire du bot. */
async function sysadd(client, message, args) {
  if (!can(message.member, "owner")) return;
  const targetId = parseTargetId(args[0]);
  if (!targetId) return reply(message, "error", "Indique un membre : `sysadd @membre`.");
  const added = accessStore.add("sys", targetId);
  return reply(message, added ? "success" : "info", added ? `<@${targetId}> a maintenant le rang sys.` : "Ce membre a déjà le rang sys.");
}

async function sysdel(client, message, args) {
  if (!can(message.member, "owner")) return;
  const targetId = parseTargetId(args[0]);
  if (!targetId) return reply(message, "error", "Indique un membre : `sysdel @membre`.");
  const removed = accessStore.remove("sys", targetId);
  return reply(message, removed ? "success" : "info", removed ? `<@${targetId}> a perdu le rang sys.` : "Ce membre n'a pas le rang sys.");
}

const ADMIN_COMMANDS = { prefix, rename, owner, setrole, sysadd, sysdel };

module.exports = { ADMIN_COMMANDS };
