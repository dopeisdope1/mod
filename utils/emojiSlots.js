const { EMOJI } = require("./emojis");
const categoryEmojiStore = require("./categoryEmojiStore");

// "-emoji" — un slot par clé du registre de design (utils/emojis.js), une
// seule catégorie (le registre de ce bot est petit, pas besoin de le
// découper comme sur le bot principal). Même mécanique que discord-music-
// bot/utils/emojiSlots.js.
const SLOTS = Object.keys(EMOJI).map((cle) => ({
  key: `icon:${cle}`,
  label: cle,
  defaultEmoji: EMOJI[cle],
  categorie: "Icônes",
}));

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

module.exports = { SLOTS, emojiDe, iconDe };
