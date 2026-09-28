const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const { can } = require("./permissions/engine");
const { report } = require("./moderation/actions");
const zinkillerStore = require("./zinkillerStore");
const clearMyBlStore = require("./clearMyBlStore");
const modLogStore = require("./modLogStore");
const { applyAccent } = require("./customizePanel");

// "ClearMyBL" — commande DM (sans préfixe serveur, tapée directement au bot
// en message privé, ex: "clearmybl") : un membre blacklisté (utils/
// zinkillerStore.js) demande la levée de SA blacklist. Ne débannit jamais
// automatiquement — poste une demande avec Approuver/Refuser dans le salon
// de logs de modération du serveur concerné, la décision reste humaine
// (droit "moderation.zinkiller"). Un seul serveur bloqué par ce bot en
// pratique, mais on parcourt tous ceux où il tourne pour rester correct.
const CUSTOM_ID = "clearmybl";
const PERMISSION = "moderation.zinkiller";

function joursRestants(ms) {
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

async function trouverSalonLogs(guild) {
  const channelId = modLogStore.getLogChannelId(guild.id);
  if (!channelId) return null;
  const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
  return channel?.isTextBased() ? channel : null;
}

/** Déclenchée sur un message privé (DM) dont le contenu est "clearmybl". */
async function demanderClearMyBL(client, message) {
  const userId = message.author.id;
  const guildsConcernes = client.guilds.cache.filter((g) => zinkillerStore.isZinkilled(g.id, userId));

  if (!guildsConcernes.size) {
    return message.reply("Tu n'es dans la liste noire persistante d'aucun serveur géré par ce bot.").catch(() => {});
  }

  const resultats = [];
  for (const guild of guildsConcernes.values()) {
    const attente = clearMyBlStore.tempsRestant(guild.id, userId);
    if (attente > 0) {
      resultats.push(`**${guild.name}** — déjà une demande en cours, réessaie dans ${joursRestants(attente)} jour(s).`);
      continue;
    }

    const salon = await trouverSalonLogs(guild);
    if (!salon) {
      resultats.push(`**${guild.name}** — aucun salon de logs configuré, contacte le staff directement.`);
      continue;
    }

    const entry = zinkillerStore.get(guild.id, userId);
    const container = applyAccent(new ContainerBuilder(), guild.id);
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent("## ClearMyBL — demande de levée"));
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `**Demandeur** : <@${userId}> (${userId})`,
          entry?.grade ? `**Grade** : ${entry.grade}` : null,
          entry?.reason ? `**Raison d'origine** : ${entry.reason}` : null,
          entry?.preuve ? `**Preuve d'origine** : ${entry.preuve}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      )
    );
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${CUSTOM_ID}:approve:${guild.id}:${userId}`).setLabel("Approuver").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`${CUSTOM_ID}:deny:${guild.id}:${userId}`).setLabel("Refuser").setStyle(ButtonStyle.Danger)
      )
    );

    await salon.send({ flags: MessageFlags.IsComponentsV2, components: [container], allowedMentions: { parse: [] } }).catch(() => {});
    clearMyBlStore.enregistrerDemande(guild.id, userId);
    resultats.push(`**${guild.name}** — demande envoyée au staff.`);
  }

  return message.reply(resultats.join("\n")).catch(() => {});
}

function resolu(guild, texte) {
  const container = applyAccent(new ContainerBuilder(), guild.id);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ClearMyBL — demande de levée\n${texte}`));
  return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function handleClearMyBLInteraction(interaction) {
  const [, action, guildId, userId] = interaction.customId.split(":");
  if (!can(interaction.member, PERMISSION)) {
    return interaction.reply({ content: "Tu n'as pas la permission nécessaire pour cette action.", flags: MessageFlags.Ephemeral });
  }

  const guild = interaction.guild;
  const target = await guild.members.fetch(userId).catch(() => null);
  const ciblePourDM = target?.user ?? (await interaction.client.users.fetch(userId).catch(() => null));

  if (action === "deny") {
    await ciblePourDM?.send(`Ta demande de levée de blacklist sur **${guild.name}** a été refusée.`).catch(() => {});
    return interaction.update(resolu(guild, `Demande de <@${userId}> **refusée** par <@${interaction.user.id}>.`));
  }

  if (action === "approve") {
    const entry = zinkillerStore.remove(guild.id, userId);
    try {
      await guild.bans.remove(userId, `ClearMyBL approuvé par ${interaction.user.tag}`);
    } catch (err) {
      if (entry) zinkillerStore.add(guild.id, userId, entry);
      return interaction.reply({ content: `Discord a refusé le débannissement : ${err.message}`, flags: MessageFlags.Ephemeral });
    }

    await report(interaction.client, {
      guildId: guild.id,
      title: "Blacklist retirée — ClearMyBL",
      fields: [
        { label: "Cible", value: `<@${userId}> (${userId})` },
        ...(entry?.grade ? [{ label: "Grade appliqué", value: `${entry.grade}` }] : []),
        { label: "Ban sur ny", value: "levé" },
      ],
      action: "clearmybl",
      targetId: userId,
      targetTag: ciblePourDM?.tag || userId,
      moderator: interaction.user,
      channelId: interaction.channelId,
    });

    await ciblePourDM?.send(`Ta demande de levée de blacklist sur **${guild.name}** a été **approuvée** — tu peux revenir sur le serveur.`).catch(() => {});
    return interaction.update(resolu(guild, `Demande de <@${userId}> **approuvée** par <@${interaction.user.id}>, débanni.`));
  }
}

module.exports = { CUSTOM_ID, demanderClearMyBL, handleClearMyBLInteraction };
