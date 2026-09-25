const fs = require("fs");
const path = require("path");
const { ecrireJson, lireJson } = require("./jsonFile");

// Rang "sys" : accès total à toutes les commandes de modération (voir
// permissions/engine.js::can), attribué par le propriétaire du bot
// uniquement. Même patron que discord-music-bot/utils/accessStore.js, réduit
// à ce dont ce bot a besoin (une seule portée : "sys").
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "access.json");

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = lireJson(DATA_FILE);
  } catch {
    cache = {};
  }
  if (!Array.isArray(cache.sys)) cache.sys = [];
  return cache;
}

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    ecrireJson(DATA_FILE, cache);
  } catch (err) {
    console.error("[accessStore] échec de la sauvegarde :", err);
  }
}

/** Propriétaires du bot, lus depuis BOT_OWNER_IDS — jamais perdu même sans fichier. */
function ownerIds() {
  return (process.env.BOT_OWNER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const isOwner = (userId) => ownerIds().includes(userId);
const isSys = (userId) => load().sys.includes(userId);

/**
 * Hiérarchie : propriétaire (BOT_OWNER_IDS) -> tout, sans exception ;
 * rang sys -> tout sauf distribuer le rang sys lui-même.
 */
function isAllowed(scope, userId) {
  if (isOwner(userId)) return true;
  if (scope === "owner") return false;
  if (scope === "sys") return load().sys.includes(userId);
  return isSys(userId);
}

/** @returns {boolean} false si la personne y était déjà. */
function add(scope, userId) {
  const list = load()[scope];
  if (!list || list.includes(userId)) return false;
  list.push(userId);
  save();
  return true;
}

/** @returns {boolean} false si la personne n'y était pas. */
function remove(scope, userId) {
  const list = load()[scope];
  const index = list ? list.indexOf(userId) : -1;
  if (index === -1) return false;
  list.splice(index, 1);
  save();
  return true;
}

const list = (scope) => [...(load()[scope] || [])];

module.exports = { isAllowed, isOwner, isSys, add, remove, list, ownerIds };
