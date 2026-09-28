const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");
const { can } = require("./permissions/engine");
const permStore = require("./permissions/store");
const permCatalog = require("./permissions/catalog");

// "-perms"/"-helpall" — vue d'ensemble des permissions accordées par rôle,
// regroupées par palier d'AFFICHAGE (rôles ayant EXACTEMENT le même
// ensemble de clés) — porté depuis discord-music-bot (&perms/&helpall
// retirés de ce bot, déplacés ici sur demande). Un "palier" ici n'est qu'un
// regroupement calculé à la volée depuis utils/permissions/store.js, PAS le
// système des "Paliers" assignables de -panel (utils/permissions/
// tierStore.js) — les deux coexistent, celui-ci est juste une vue.
const tierSignature = (keys) => [...keys].sort().join("|");

function computeTiers(guildId) {
  const grants = permStore.listRoleGrants(guildId);
  const bySignature = new Map();
  for (const [roleId, keys] of grants) {
    const signature = tierSignature(keys);
    if (!bySignature.has(signature)) bySignature.set(signature, { keys: [...keys], roleIds: [] });
    bySignature.get(signature).roleIds.push(roleId);
  }
  return [...bySignature.values()]
    .sort((a, b) => a.keys.length - b.keys.length)
    .map((tier, i) => ({ index: i + 1, ...tier }));
}

function labelsForKeys(keys) {
  return [...new Set(keys.map((k) => permCatalog.label(k)))];
}

// Discord plafonne le texte affichable à 4000 caractères, sur le TOTAL du
// message — avec beaucoup de paliers/rôles, un seul message peut dépasser
// ce plafond (DiscordAPIError constaté sur le bot d'origine). Pagination
// PAR MESSAGE, comme là-bas : "1/2", "2/2"...
const LIMITE_PAGE = 3800;

function paginerBlocs(blocs) {
  const pages = [];
  let courante = "";
  for (let bloc of blocs) {
    if (bloc.length > LIMITE_PAGE) bloc = `${bloc.slice(0, LIMITE_PAGE - 1)}…`;
    const candidate = courante ? `${courante}\n\n${bloc}` : bloc;
    if (candidate.length > LIMITE_PAGE && courante) {
      pages.push(courante);
      courante = bloc;
    } else {
      courante = candidate;
    }
  }
  if (courante) pages.push(courante);
  return pages;
}

function buildTierCard(title, intro, tiers, renderTierLine) {
  const blocs = tiers.map((tier) => `**Permission ${tier.index}**\n> ↳ ${renderTierLine(tier) || "*aucune*"}`);
  const pages = paginerBlocs([`> ${intro}`, ...blocs]);
  return pages.map((page, i) => {
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}${pages.length > 1 ? ` (${i + 1}/${pages.length})` : ""}`));
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(page.trim()));
    return { flags: MessageFlags.IsComponentsV2, components: [container] };
  });
}

/** Envoie une ou plusieurs pages : la première en réponse, les suivantes à la suite dans le salon. */
async function envoyerPages(message, pages) {
  await message.reply(pages[0]);
  for (const page of pages.slice(1)) await message.channel.send(page);
}

/** "-perms" — les permissions débloquées par chaque palier (rôles au même ensemble de droits). */
async function perms(client, message) {
  if (!can(message.member, "panel.permissions.manage")) return;
  const guildId = message.guild.id;
  const tiers = computeTiers(guildId);
  if (!tiers.length) {
    return message.reply("Aucune permission n'est encore accordée à un rôle (voir `-panel` > Rôles et permissions).");
  }
  return envoyerPages(
    message,
    buildTierCard(
      "Permissions liées aux commandes",
      "Voici les différentes permissions ainsi que ce qu'elles débloquent",
      tiers,
      (tier) => labelsForKeys(tier.keys).join(", ")
    )
  );
}

/** "-helpall" — les rôles associés à chaque palier de permissions. */
async function helpall(client, message) {
  if (!can(message.member, "panel.permissions.manage")) return;
  const guildId = message.guild.id;
  const tiers = computeTiers(guildId);
  if (!tiers.length) {
    return message.reply("Aucune permission n'est encore accordée à un rôle (voir `-panel` > Rôles et permissions).");
  }
  return envoyerPages(
    message,
    buildTierCard("Permissions", "Voici les différentes permissions ainsi que les rôles associés", tiers, (tier) => tier.roleIds.map((id) => `<@&${id}>`).join(", "))
  );
}

module.exports = { perms, helpall, computeTiers };
