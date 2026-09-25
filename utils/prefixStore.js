const fs = require("fs");
const path = require("path");
const { ecrireJson, lireJson } = require("./jsonFile");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "prefixes.json");

// Repris tel quel du bot principal : "-" était le préfixe modération avant la
// migration, il devient le préfixe (unique) de ce bot dédié.
const DEFAULT_PREFIX = "-";

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
    console.error("[prefixStore] échec de la sauvegarde :", err);
  }
}

function getPrefix(guildId) {
  return load()[guildId] || DEFAULT_PREFIX;
}

function setPrefix(guildId, value) {
  const data = load();
  data[guildId] = value;
  save();
}

module.exports = { getPrefix, setPrefix, DEFAULT_PREFIX };
