const { PermissionFlagsBits } = require("discord.js");
const { buildStatusEmbed } = require("./statusEmbed");
const { can } = require("./permissions/engine");
const permStore = require("./permissions/store");
const permCatalog = require("./permissions/catalog");
const accessStore = require("./accessStore");
const { getPrefix, setPrefix } = require("./prefixStore");
const { msg } = require("./messages");

const reply = (message, kind, text) => message.reply(buildStatusEmbed(kind, text, { guildId: message.guild.id }));
const m = (message, key, vars) => msg(message.guild.id, key, vars);

/** "prefix <nouveau>" — réservé au rang sys, comme sur les autres bots. */
async function prefix(client, message, args) {
  if (!can(message.member, "sys")) return;
  const nouveau = (args[0] || "").trim();
  if (!nouveau) return reply(message, "info", m(message, "prefix_current", { prefix: getPrefix(message.guild.id) }));
  if (nouveau.length > 3 || /\s/.test(nouveau)) {
    return reply(message, "error", m(message, "prefix_invalid"));
  }
  setPrefix(message.guild.id, nouveau);
  return reply(message, "success", m(message, "prefix_success", { prefix: nouveau }));
}

/** "rename <nouveau nom>" — réservé au rang sys, comme prefix. */
async function rename(client, message, args) {
  if (!can(message.member, "sys")) return;
  const nouveau = args.join(" ").trim();
  if (!nouveau) return reply(message, "error", m(message, "rename_missing"));
  if (nouveau.length > 32) return reply(message, "error", m(message, "rename_toolong"));
  if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ChangeNickname)) {
    return reply(message, "error", m(message, "rename_noperm"));
  }
  try {
    await message.guild.members.me.setNickname(nouveau);
  } catch (err) {
    return reply(message, "error", m(message, "rename_refused", { erreur: err.message }));
  }
  return reply(message, "success", m(message, "rename_success", { nom: nouveau }));
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
  if (!targetId) return reply(message, "error", m(message, "member_missing", { commande: "owner" }));
  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (!target) return reply(message, "error", m(message, "member_not_found"));

  const roleGrantableKeys = permCatalog.CATALOG.filter((p) => p.roleGrantable !== false).map((p) => p.key);
  const granted = permStore.getUserGrants(message.guild.id, target.id);
  const hasAll = roleGrantableKeys.every((key) => granted.includes(key));

  if (hasAll) {
    for (const key of roleGrantableKeys) permStore.revokeFromUser(message.guild.id, target.id, key);
    return reply(message, "success", m(message, "owner_removed", { tag: target.user.tag }));
  }
  for (const key of roleGrantableKeys) {
    if (!granted.includes(key)) permStore.grantToUser(message.guild.id, target.id, key);
  }
  return reply(message, "success", m(message, "owner_granted", { tag: target.user.tag }));
}

/** "setrole @rôle <clé>" — accorde/retire une clé du catalogue à un rôle entier. */
async function setrole(client, message, args) {
  if (!can(message.member, "panel.permissions.manage")) return;
  const roleMatch = args[0]?.match(/^<@&(\d{15,25})>$/) || args[0]?.match(/^(\d{15,25})$/);
  const role = roleMatch && message.guild.roles.cache.get(roleMatch[1]);
  if (!role) return reply(message, "error", m(message, "setrole_missing_role"));
  const key = (args[1] || "").trim();
  const valide = permCatalog.CATALOG.find((p) => p.key === key);
  if (!valide) {
    return reply(message, "error", m(message, "setrole_unknown_key", { cles: permCatalog.CATALOG.map((p) => `\`${p.key}\``).join(", ") }));
  }
  if (valide.roleGrantable === false) {
    return reply(message, "error", m(message, "setrole_not_role_grantable", { cle: key }));
  }
  const current = permStore.getRoleGrants(message.guild.id, role.id);
  const already = current.includes(key);
  const next = already ? current.filter((k) => k !== key) : [...current, key];
  permStore.setRoleGrants(message.guild.id, role.id, next);
  return reply(message, "success", m(message, "setrole_success", { role: role.name, cle: key, action: already ? "retirée" : "accordée" }));
}

/** "sysadd"/"sysdel" — rang sys, réservé au propriétaire du bot. */
async function sysadd(client, message, args) {
  if (!can(message.member, "owner")) return;
  const targetId = parseTargetId(args[0]);
  if (!targetId) return reply(message, "error", m(message, "sysadd_missing"));
  const added = accessStore.add("sys", targetId);
  return reply(message, added ? "success" : "info", added ? m(message, "sysadd_success", { id: targetId }) : m(message, "sysadd_already"));
}

async function sysdel(client, message, args) {
  if (!can(message.member, "owner")) return;
  const targetId = parseTargetId(args[0]);
  if (!targetId) return reply(message, "error", m(message, "sysdel_missing"));
  const removed = accessStore.remove("sys", targetId);
  return reply(message, removed ? "success" : "info", removed ? m(message, "sysdel_success", { id: targetId }) : m(message, "sysdel_not_sys"));
}

const ADMIN_COMMANDS = { prefix, rename, owner, setrole, sysadd, sysdel };

module.exports = { ADMIN_COMMANDS };
