const fs = require("fs");
const path = require("path");
const { ecrireJson, lireJson } = require("../jsonFile");

// Octrois de permission PAR SERVEUR : rôle ou membre individuel — même
// patron que discord-music-bot/utils/permissions/store.js, voice-master et
// secure-bot.
// { [guildId]: { roleGrants: { [roleId]: [clé, ...] }, userGrants: { [userId]: [clé, ...] } } }
//
// PERMISSIONS_FILE (optionnel) pointe vers le MÊME permissions.json que
// discord-music-bot : les octrois de modération (moderation.*/logs.*)
// deviennent communs aux deux bots. Ce fichier contient aussi les clés de
// vocal/sécurité/gestion des autres bots : ce bot ne les lit ni ne les écrit
// jamais (SES_CLES ci-dessous).
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "..", "data");
const DATA_FILE = process.env.PERMISSIONS_FILE || path.join(DATA_DIR, "permissions.json");

const SES_CLES = new Set([
  "moderation.clear",
  "moderation.kick",
  "moderation.ban",
  "moderation.unban",
  "moderation.softban",
  "moderation.timeout",
  "moderation.warn",
  "moderation.unmuteall",
  "moderation.banall",
  "moderation.unbanall",
  "moderation.zinkiller",
  "channels.manageall",
  "channels.lockdown",
  "members.role",
  "logs.view",
  "logs.manage",
  "protection.automod",
]);
const filtreCles = (keys) => keys.filter((k) => SES_CLES.has(k));

// Pas de cache PERSISTANT ici, volontairement : ce fichier peut être
// PARTAGÉ (PERMISSIONS_FILE) avec le bot principal, un AUTRE process qui
// écrit dans le même fichier à tout moment. Un cache figé écraserait ses
// changements à la prochaine sauvegarde de ce bot (perte silencieuse d'un
// octroi accordé entre-temps par l'autre bot).
//
// En revanche, un même clic (ex. construire le menu d'aide navigable)
// appelle `can()` pour CHAQUE commande du catalogue, qui rappelle `load()`
// à chaque fois — sans rien de plus, ça relit et re-parse le fichier depuis
// le disque en boucle, de façon SYNCHRONE et bloquante, pour un seul clic.
// Le cache ci-dessous ne vit que le temps d'un même tour de boucle
// d'événements (setImmediate le vide juste après) : les appels groupés
// d'une même interaction partagent une seule lecture, mais l'interaction
// suivante relit toujours le fichier à jour — aucune fraîcheur perdue.
let cache = null;
let cacheVidageProgramme = false;

function load() {
  if (cache) return cache;
  try {
    cache = lireJson(DATA_FILE);
  } catch {
    cache = {};
  }
  if (!cacheVidageProgramme) {
    cacheVidageProgramme = true;
    setImmediate(() => {
      cache = null;
      cacheVidageProgramme = false;
    });
  }
  return cache;
}

function save(data) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    ecrireJson(DATA_FILE, data);
  } catch (err) {
    console.error("[permissions/store] échec de la sauvegarde :", err);
  }
}

/** Lit et normalise l'entrée d'UNE guilde depuis un snapshot déjà chargé (jamais persisté seul : voir les appelants). */
function guildEntry(data, guildId) {
  if (!data[guildId]) data[guildId] = { roleGrants: {}, userGrants: {} };
  if (!data[guildId].roleGrants) data[guildId].roleGrants = {};
  if (!data[guildId].userGrants) data[guildId].userGrants = {};
  return data[guildId];
}

const getRoleGrants = (guildId, roleId) => filtreCles(guildEntry(load(), guildId).roleGrants[roleId] || []);
const getUserGrants = (guildId, userId) => filtreCles(guildEntry(load(), guildId).userGrants[userId] || []);

/** Remplace UNIQUEMENT les clés de modération du rôle — les autres octrois (vocal, sécurité, gestion...) du fichier partagé restent intacts. */
function setRoleGrants(guildId, roleId, keys) {
  const data = load();
  const entry = guildEntry(data, guildId);
  const autresCles = (entry.roleGrants[roleId] || []).filter((k) => !SES_CLES.has(k));
  const nouvelles = [...autresCles, ...new Set(filtreCles(keys))];
  if (nouvelles.length) entry.roleGrants[roleId] = nouvelles;
  else delete entry.roleGrants[roleId];
  save(data);
}

function grantToUser(guildId, userId, key) {
  if (!SES_CLES.has(key)) return false;
  const data = load();
  const entry = guildEntry(data, guildId);
  const list = entry.userGrants[userId] || (entry.userGrants[userId] = []);
  if (list.includes(key)) return false;
  list.push(key);
  save(data);
  return true;
}

function revokeFromUser(guildId, userId, key) {
  if (!SES_CLES.has(key)) return false;
  const data = load();
  const entry = guildEntry(data, guildId);
  const list = entry.userGrants[userId];
  const index = list ? list.indexOf(key) : -1;
  if (index === -1) return false;
  list.splice(index, 1);
  if (!list.length) delete entry.userGrants[userId];
  save(data);
  return true;
}

function listRoleGrants(guildId) {
  return Object.entries(guildEntry(load(), guildId).roleGrants)
    .map(([roleId, keys]) => [roleId, filtreCles(keys)])
    .filter(([, keys]) => keys.length);
}

function listUserGrants(guildId) {
  return Object.entries(guildEntry(load(), guildId).userGrants)
    .map(([userId, keys]) => [userId, filtreCles(keys)])
    .filter(([, keys]) => keys.length);
}

module.exports = {
  getRoleGrants,
  getUserGrants,
  setRoleGrants,
  grantToUser,
  revokeFromUser,
  listRoleGrants,
  listUserGrants,
};
