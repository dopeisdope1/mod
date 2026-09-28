const accessStore = require("../accessStore");
const { getRoleGrants, getUserGrants } = require("./store");
const { isRoleGrantable } = require("./catalog");
const tierStore = require("./tierStore");

/**
 * SEUL point de vérification des droits sur une clé de permission — même
 * moteur que discord-music-bot/utils/permissions/engine.js::can.
 *
 * Ordre de résolution :
 *  1. propriétaire du bot / rang sys (accès total, sauf clés non
 *     role-grantable qui suivent leur propre règle) ;
 *  2. octroi individuel sur ce serveur ;
 *  3. n'importe quel rôle du membre ayant reçu cette clé sur ce serveur ;
 *  4. palier de confiance cumulatif (utils/permissions/tierStore.js) — rôle
 *     lié à un palier ou affectation directe.
 *
 * @param {import('discord.js').GuildMember} member
 * @param {string|string[]|null} key null = commande publique, toujours autorisée.
 * @returns {boolean}
 */
function can(member, key) {
  if (Array.isArray(key)) return key.some((permission) => can(member, permission));
  if (!key) return true;
  if (!member || !member.guild) return false;

  if (accessStore.isOwner(member.id)) return true;
  if (key === "owner") return false;
  if (accessStore.isSys(member.id)) return true;

  const guildId = member.guild.id;
  if (getUserGrants(guildId, member.id).includes(key)) return true;

  if (!isRoleGrantable(key)) return false;

  for (const roleId of member.roles?.cache?.keys?.() || []) {
    if (getRoleGrants(guildId, roleId).includes(key)) return true;
  }
  return tierStore.hasPermission(member, key);
}

module.exports = { can };
