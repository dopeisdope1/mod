const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");
const { EMOJI } = require("./emojis");
const { iconDe } = require("./emojiSlots");

// Repli utilisé quand `options.guildId` est absent — ne jamais supprimer :
// garde les appelants non migrés strictement inchangés.
const TYPE_EMOJI = {
  success: EMOJI.SUCCESS,
  error: EMOJI.ERROR,
  info: EMOJI.INFO,
  warning: EMOJI.INFO,
};

const CLE_ICONE_PAR_TYPE = { success: "SUCCESS", error: "ERROR", info: "INFO", warning: "INFO" };

/**
 * Carte Components V2 de statut (remplace l'ancien embed à barre colorée) :
 * texte précédé d'un emoji, personnalisable par serveur via `-emoji` (voir
 * utils/emojiSlots.js::iconDe) — sans `options.guildId`, retombe sur
 * l'icône par défaut de utils/emojis.js.
 * @param {"success"|"error"|"info"|"warning"} type
 * @param {string} description
 * @param {{ title?: string, guildId?: string }} [options]
 */
function buildStatusEmbed(type, description, options = {}) {
  const emoji = options.guildId ? iconDe(options.guildId, CLE_ICONE_PAR_TYPE[type]) : TYPE_EMOJI[type];
  const container = new ContainerBuilder();
  if (options.title) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${options.title}`));
    if (description) container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  }
  if (description) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(emoji ? `${emoji} ${description}` : description));
  }
  return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

module.exports = { buildStatusEmbed };
