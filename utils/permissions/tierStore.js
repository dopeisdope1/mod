const fs = require("fs");
const path = require("path");
const { ecrireJson, lireJson } = require("../jsonFile");
const { isRoleGrantable } = require("./catalog");

// Paliers de confiance (1 = le plus bas, 12 = le plus haut) — échelle de
// permissions CUMULATIVE : un membre affecté au palier N hérite des
// permissions de TOUS les paliers <= N. Un rôle "lié" à un palier fait
// hériter ce palier à quiconque le possède (utils/permissions/engine.js) ;
// un membre peut aussi être affecté directement, sans passer par un rôle.
// Vient en complément des octrois individuels/par rôle déjà en place
// (utils/permissions/store.js) — jamais en remplacement. Respecte
// roleGrantable: false (ex. moderation.banall/unbanall, jamais via un rôle
// NI un palier — réservées au rang sys ou à un octroi individuel explicite).
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "..", "data");
const DATA_FILE = path.join(DATA_DIR, "rankTiers.json");
const NB_PALIERS = 12;

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = lireJson(DATA_FILE);
  } catch {
    cache = {};
  }
  return cache;
}

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    ecrireJson(DATA_FILE, cache);
  } catch (err) {
    console.error("[permissions/tierStore] échec de la sauvegarde :", err);
  }
}

function guildEntry(guildId) {
  const data = load();
  if (!data[guildId]) data[guildId] = {};
  const entry = data[guildId];
  if (!entry.labels || typeof entry.labels !== "object") entry.labels = {};
  if (!entry.permissions || typeof entry.permissions !== "object") entry.permissions = {};
  if (!entry.roles || typeof entry.roles !== "object") entry.roles = {};
  if (!entry.users || typeof entry.users !== "object") entry.users = {};
  return entry;
}

function getTierLabel(guildId, index) {
  return guildEntry(guildId).labels[index] || `Palier ${index}`;
}

function setTierLabel(guildId, index, label) {
  guildEntry(guildId).labels[index] = label;
  save();
}

/** @returns {string[]} clés de permission accordées PAR CE palier précis (pas cumulatif ici, voir hasPermission). */
function getTierPermissions(guildId, index) {
  return [...(guildEntry(guildId).permissions[index] || [])];
}

/** @returns {boolean} nouvel état (true = désormais accordée par ce palier), ou null si la clé n'est pas "role-grantable". */
function togglePermission(guildId, index, key) {
  if (!isRoleGrantable(key)) return null;
  const entry = guildEntry(guildId);
  const liste = entry.permissions[index] || [];
  const present = liste.includes(key);
  entry.permissions[index] = present ? liste.filter((k) => k !== key) : [...liste, key];
  save();
  return !present;
}

function linkRole(guildId, roleId, index) {
  guildEntry(guildId).roles[roleId] = index;
  save();
}

function unlinkRole(guildId, roleId) {
  delete guildEntry(guildId).roles[roleId];
  save();
}

/** @returns {Record<string, number>} roleId -> palier */
function getLinkedRoles(guildId) {
  return { ...guildEntry(guildId).roles };
}

function assignUser(guildId, userId, index) {
  guildEntry(guildId).users[userId] = index;
  save();
}

function unassignUser(guildId, userId) {
  delete guildEntry(guildId).users[userId];
  save();
}

/** @returns {Record<string, number>} userId -> palier */
function getUserAssignments(guildId) {
  return { ...guildEntry(guildId).users };
}

/** @returns {number|null} le palier le plus élevé dont bénéficie ce membre (affectation directe ou rôle lié), ou null. */
function effectiveTier(member) {
  if (!member) return null;
  const guildId = member.guild.id;
  const entry = guildEntry(guildId);
  let meilleur = entry.users[member.id] ?? null;
  for (const roleId of member.roles?.cache?.keys?.() || []) {
    const palier = entry.roles[roleId];
    if (palier && (meilleur === null || palier > meilleur)) meilleur = palier;
  }
  return meilleur;
}

/** Cumulatif : accordée si un palier <= au palier effectif du membre la contient. */
function hasPermission(member, key) {
  if (!isRoleGrantable(key)) return false;
  const palier = effectiveTier(member);
  if (palier === null) return false;
  const guildId = member.guild.id;
  for (let i = 1; i <= palier; i++) {
    if (getTierPermissions(guildId, i).includes(key)) return true;
  }
  return false;
}

module.exports = {
  NB_PALIERS,
  getTierLabel,
  setTierLabel,
  getTierPermissions,
  togglePermission,
  linkRole,
  unlinkRole,
  getLinkedRoles,
  assignUser,
  unassignUser,
  getUserAssignments,
  effectiveTier,
  hasPermission,
};
