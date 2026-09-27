const fs = require("fs");
const path = require("path");
const { ecrireJson, lireJson } = require("./jsonFile");

// Cooldown des demandes "ClearMyBL" (une par utilisateur par serveur, pour
// éviter le spam de demandes en DM) — utils/clearMyBlCommands.js.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "clearMyBl.json");
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

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
    console.error("[clearMyBlStore] échec de la sauvegarde :", err);
  }
}

function guildEntry(guildId) {
  const data = load();
  if (!data[guildId]) data[guildId] = {};
  return data[guildId];
}

/** @returns {number} millisecondes restantes avant de pouvoir refaire une demande (0 = disponible) */
function tempsRestant(guildId, userId) {
  const dernier = guildEntry(guildId)[userId];
  if (!dernier) return 0;
  const reste = dernier + COOLDOWN_MS - Date.now();
  return reste > 0 ? reste : 0;
}

function enregistrerDemande(guildId, userId) {
  guildEntry(guildId)[userId] = Date.now();
  save();
}

module.exports = { tempsRestant, enregistrerDemande, COOLDOWN_MS };
