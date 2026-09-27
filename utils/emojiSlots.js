const { EMOJI } = require("./emojis");
const categoryEmojiStore = require("./categoryEmojiStore");
const { CATEGORIES } = require("./helpCategories");

// "-emoji" — un slot par clé du registre de design (utils/emojis.js) ET un
// slot par catégorie de "-help" (même principe que discord-music-bot/utils/
// emojiSlots.js, qui expose aussi les catégories d'aide comme slots
// "cat:*"), personnalisables par serveur.
const ICON_SLOTS = Object.keys(EMOJI).map((cle) => ({
  key: `icon:${cle}`,
  label: cle,
  defaultEmoji: EMOJI[cle],
  categorie: "Icônes",
}));

const CATEGORY_SLOTS = CATEGORIES.map((cat) => ({
  key: `cat:${cat.key}`,
  label: `-help — ${cat.label}`,
  defaultEmoji: cat.emoji,
  categorie: "Catégories d'aide",
}));

const SLOTS = [...ICON_SLOTS, ...CATEGORY_SLOTS];
const SLOT_PAR_CLE = new Map(SLOTS.map((s) => [s.key, s]));

/** L'emoji réellement affiché pour ce slot sur ce serveur — personnalisé, ou par défaut. */
function emojiDe(guildId, slotKey) {
  const slot = SLOT_PAR_CLE.get(slotKey);
  if (!slot) return null;
  return categoryEmojiStore.get(guildId, slotKey) || slot.defaultEmoji;
}

/** L'icône réellement affichée pour cette clé de utils/emojis.js sur ce serveur — personnalisée, ou celle du registre. */
function iconDe(guildId, emojiKey) {
  return emojiDe(guildId, `icon:${emojiKey}`) || EMOJI[emojiKey] || null;
}

/** L'emoji réellement affiché pour cette catégorie de "-help" sur ce serveur. */
function categoryEmojiDe(guildId, catKey) {
  return emojiDe(guildId, `cat:${catKey}`) || "";
}

module.exports = { SLOTS, emojiDe, iconDe, categoryEmojiDe };
