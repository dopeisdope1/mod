const fs = require("fs");
const path = require("path");
const { ecrireJson, lireJson } = require("./jsonFile");

// Salon de logs de modération, par serveur — version réduite à UNE seule
// catégorie du système multi-catégories du bot principal (utils/
// modLogStore.js, 8 catégories dont "moderation").
//
// PARTAGÉ via MODLOG_FILE (optionnel) avec le MÊME modLog.json que le bot
// principal : ce bot ne lit/écrit QUE la clé "moderation" de chaque entrée,
// les 7 autres catégories (members/roles/channels/voice/server/bots/
// messages) restent gérées et intactes côté bot principal.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const DATA_FILE = process.env.MODLOG_FILE || path.join(DATA_DIR, "modLog.json");

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
    console.error("[modLogStore] échec de la sauvegarde :", err);
  }
}

/**
 * Normalise l'entrée d'un serveur — reprend le même format que le bot
 * principal ({ categories: { moderation: channelId, ... } }, ou l'ancien
 * format à salon unique { channelId } comme salon "moderation").
 */
function guildEntry(guildId) {
  const data = load();
  const raw = data[guildId];
  if (!raw) return {};
  if (raw.channelId && !raw.categories) return { moderation: raw.channelId };
  return raw.categories || {};
}

/** @returns {string|null} salon de logs de modération configuré, ou null. */
function getLogChannelId(guildId) {
  return guildEntry(guildId).moderation || null;
}

/** @param {string|null} channelId null pour désactiver. */
function setLogChannelId(guildId, channelId) {
  const data = load();
  // Une entrée existante peut porter d'autres catégories (fichier partagé
  // avec le bot principal) : on ne touche QUE "moderation", jamais le reste.
  const raw = data[guildId];
  const current = raw?.channelId && !raw.categories ? { moderation: raw.channelId } : { ...(raw?.categories || {}) };
  current.moderation = channelId || null;
  if (!current.moderation) delete current.moderation;
  const hasAny = Object.values(current).some(Boolean);
  if (hasAny) data[guildId] = { categories: current };
  else if (raw) delete data[guildId];
  save();
}

module.exports = { getLogChannelId, setLogChannelId };
