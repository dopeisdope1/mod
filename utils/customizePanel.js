const categoryEmojiStore = require("./categoryEmojiStore");

// Personnalisation par serveur, exposée depuis -panel > Apparence/Textes
// (PAS des commandes séparées). Réutilise le même stockage que "-emoji"
// (utils/categoryEmojiStore.js est un simple guildId -> clé -> valeur, rien
// de spécifique aux emojis) avec ses propres espaces de clés :
// "color:accent" et "text:<slot>".
//
// Bordure colorée DÉSACTIVÉE par défaut : une carte Components V2 sans
// setAccentColor() n'a aucune bordure — c'est l'état de base. -panel >
// Apparence permet de l'activer avec la couleur de son choix.
const TITRES = {
  help: { defaut: "🔨 Modération — Aide", label: "Titre de -help", commande: "-help" },
  panel: { defaut: "「 CONFIGURATION — MODÉRATION 」", label: "Titre de -panel", commande: "-panel" },
};

/** @returns {number|null} couleur d'accent des cartes Components V2 de ce serveur, ou null (pas de bordure — état par défaut). */
function accentColor(guildId) {
  const hex = guildId && categoryEmojiStore.get(guildId, "color:accent");
  if (!hex) return null;
  const n = parseInt(hex.replace("#", ""), 16);
  return Number.isFinite(n) ? n : null;
}

function hexValide(texte) {
  const t = texte.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(t) ? `#${t.toLowerCase()}` : null;
}

/** @returns {string|null} le hex normalisé si valide, sinon null — appelé depuis -panel > Apparence. */
function setAccentColor(guildId, texte) {
  const hex = hexValide(texte);
  if (!hex) return null;
  categoryEmojiStore.set(guildId, "color:accent", hex);
  return hex;
}

function resetAccentColor(guildId) {
  categoryEmojiStore.reset(guildId, "color:accent");
}

/** Applique la couleur d'accent SEULEMENT si elle a été activée — sinon la carte reste sans bordure. */
function applyAccent(container, guildId) {
  const c = accentColor(guildId);
  if (c !== null) container.setAccentColor(c);
  return container;
}

/** @returns {string} le titre personnalisé pour ce slot ("help"/"panel"), ou son défaut. */
function titreDe(guildId, slot) {
  return categoryEmojiStore.get(guildId, `text:${slot}`) || TITRES[slot]?.defaut || "";
}

function setTitre(guildId, slot, texte) {
  categoryEmojiStore.set(guildId, `text:${slot}`, texte);
}

function resetTitre(guildId, slot) {
  categoryEmojiStore.reset(guildId, `text:${slot}`);
}

module.exports = {
  TITRES,
  accentColor,
  setAccentColor,
  resetAccentColor,
  applyAccent,
  hexValide,
  titreDe,
  setTitre,
  resetTitre,
};
