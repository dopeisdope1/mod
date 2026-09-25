const { EmbedBuilder } = require("discord.js");
const { EMOJI } = require("./emojis");

// Version simplifiée de discord-music-bot/utils/statusEmbed.js : pas de
// personnalisation d'emoji par serveur (utils/emojiSlots.js n'existe pas
// ici, périmètre non demandé pour ce bot) — même thème couleur bleu-nuit
// (THEME_BLEU du bot principal, repris en dur, sans dépendre de
// utils/dashboardImage.js qui gère des images bien plus larges que ce bot
// n'en a besoin).
const TYPE_EMOJI = {
  success: EMOJI.SUCCESS,
  error: EMOJI.ERROR,
  info: EMOJI.INFO,
  warning: EMOJI.INFO,
};

const COULEUR_PAR_TYPE = {
  success: "#22c55e",
  error: "#ef4444",
  info: "#3b82f6",
  warning: "#3b82f6",
};

/**
 * @param {"success"|"error"|"info"|"warning"} type
 * @param {string} description
 * @param {{ title?: string, fields?: {name: string, value: string, inline?: boolean}[] }} [options]
 * @returns {EmbedBuilder}
 */
function buildStatusEmbed(type, description, options = {}) {
  const embed = new EmbedBuilder();
  const emoji = TYPE_EMOJI[type];
  if (description) embed.setDescription(emoji ? `${emoji} ${description}` : description);
  if (options.title) embed.setTitle(options.title);
  if (options.fields?.length) embed.addFields(options.fields);
  embed.setColor(COULEUR_PAR_TYPE[type] ?? COULEUR_PAR_TYPE.info);
  return embed;
}

module.exports = { buildStatusEmbed };
