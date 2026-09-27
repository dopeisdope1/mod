const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");
const { getLogChannelId } = require("./modLogStore");
const logStore = require("./logStore");
const statsStore = require("./statsStore");
const { applyAccent } = require("./customizePanel");

// Version réduite de discord-music-bot/utils/moderationLog.js : ce bot ne
// gère qu'UNE catégorie de logs ("moderation"), donc ni relais d'audit-log
// multi-catégories ni logs de messages/vocal — seulement le point d'écriture
// utilisé par utils/moderation/actions.js::report() pour les actions que CE
// bot exécute lui-même (ban/kick/mute/warn/...).

function formatTimestamp() {
  return `<t:${Math.floor(Date.now() / 1000)}:F>`;
}

/**
 * Poste une entrée dans le salon de logs de modération configuré (utils/
 * modLogStore.js) — ne fait rien si aucun salon n'est configuré, ou si
 * l'envoi échoue (salon supprimé, permission retirée...).
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {{ title: string, fields: {label: string, value: string}[], moderatorId?: string|null, moderatorTag?: string|null, reason?: string|null }} entry
 */
async function postModerationEntry(client, guildId, { title, fields, moderatorId = null, moderatorTag = null, reason = null }) {
  logStore.record(guildId, { type: "event", level: "info", message: title, metadata: { category: "moderation", fields, moderatorId, moderatorTag, reason } });
  statsStore.record(guildId, "sanctions");
  const channelId = getLogChannelId(guildId);
  if (!channelId) return;

  const guild = client.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(channelId) ?? (await guild?.channels.fetch(channelId).catch(() => null));
  if (!channel?.isTextBased()) return;

  const allFields = [
    ...fields,
    moderatorId || moderatorTag ? { label: "Auteur", value: moderatorId ? `<@${moderatorId}> (${moderatorId})` : moderatorTag } : null,
    reason ? { label: "Raison", value: reason } : null,
  ].filter(Boolean);

  const container = applyAccent(new ContainerBuilder(), guildId);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(allFields.map((f) => `**${f.label} :** ${f.value}`).join("\n"))
  );
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${formatTimestamp()}`));

  await channel
    .send({
      flags: MessageFlags.IsComponentsV2,
      components: [container],
      allowedMentions: { parse: [] },
    })
    .catch((err) => {
      console.error(`[moderationLog] échec d'envoi dans le salon de logs (${channelId}) :`, err.message);
    });
}

module.exports = { postModerationEntry };
