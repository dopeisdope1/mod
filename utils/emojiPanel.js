const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require("discord.js");
const { can } = require("./permissions/engine");
const { SLOTS, emojiDe } = require("./emojiSlots");
const categoryEmojiStore = require("./categoryEmojiStore");
const messageOwner = require("./messageOwner");
const { accentColor } = require("./customizePanel");

// "-emoji" — personnalise chaque icône du registre de design (utils/
// emojis.js) PAR SERVEUR. Même mécanique que discord-music-bot/utils/
// emojiPanel.js, simplifiée : un seul groupe de slots ici (pas de
// sélecteur de catégorie intermédiaire, le registre tient dans un seul
// menu de 25 options).
const CUSTOM_ID = "emoji";
const PERMISSION = "sys";

/** @param {string} texte @param {import('discord.js').Guild} [guild] */
function emojiValide(texte, guild) {
  const t = texte.trim();
  if (/^<a?:\w+:\d+>$/.test(t)) return t;
  const nomCourt = /^:([^:]+):$/.exec(t);
  if (nomCourt && guild) {
    const trouve = guild.emojis.cache.find((e) => e.name?.toLowerCase() === nomCourt[1].toLowerCase());
    if (trouve) return trouve.toString();
    return null;
  }
  if (t.length && t.length <= 8 && !/[a-zA-Z0-9]/.test(t)) return t;
  return null;
}

function buildEmojiPanel(guildId, slotKey) {
  const container = new ContainerBuilder().setAccentColor(accentColor(guildId));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("## Emoji\nChoisis l'icône dont tu veux changer l'emoji.")
  );
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  const slot = SLOTS.find((s) => s.key === slotKey) || null;
  if (slot) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${slot.label}**\nEmoji actuel : ${emojiDe(guildId, slot.key)}`)
    );
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${CUSTOM_ID}:changebtn:${slotKey}`).setLabel("Changer").setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID}:reset:${slotKey}`)
          .setLabel("Réinitialiser")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(!categoryEmojiStore.get(guildId, slotKey))
      )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  }

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${CUSTOM_ID}:select`)
        .setPlaceholder("Choisis l'emoji à changer")
        .addOptions(SLOTS.map((s) => new StringSelectMenuOptionBuilder().setLabel(s.label).setValue(s.key).setDefault(s.key === slotKey)))
    )
  );

  return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

function buildEmojiListCard(guildId) {
  const overrides = categoryEmojiStore.list(guildId);
  const container = new ContainerBuilder().setAccentColor(accentColor(guildId));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent("## Emojis personnalisés"));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  const lignes = SLOTS.filter((s) => overrides[s.key]).map((s) => `${overrides[s.key]} **${s.label}** *(défaut : ${s.defaultEmoji})*`);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(lignes.length ? lignes.join("\n") : "*Aucun emoji personnalisé — tout est par défaut.*")
  );
  return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function handleEmojiTextCommand(client, message, args) {
  if (!can(message.member, PERMISSION)) return;
  const sub = (args[0] || "").toLowerCase();

  if (sub === "list") {
    return message.reply(buildEmojiListCard(message.guild.id));
  }
  const trouverSlot = (motif) =>
    SLOTS.find((s) => s.key === motif || s.key.split(":")[1]?.toLowerCase() === motif.toLowerCase() || s.label.toLowerCase().includes(motif.toLowerCase()));

  if (sub === "reset") {
    const slot = trouverSlot(args[1] || "");
    if (!slot) return message.reply({ content: "Icône introuvable — utilise `-emoji` pour voir la liste.", flags: MessageFlags.Ephemeral }).catch(() => {});
    categoryEmojiStore.reset(message.guild.id, slot.key);
    return message.reply(`✅ **${slot.label}** remise à son emoji par défaut (${slot.defaultEmoji}).`);
  }

  if (sub && sub !== "list") {
    const slot = trouverSlot(sub);
    if (!slot) {
      return message.reply("Utilisation : `-emoji` pour ouvrir le panel, `-emoji <clé> <emoji>`, ou `-emoji reset <clé>`.");
    }
    const emoji = emojiValide(args.slice(1).join(" "), message.guild);
    if (!emoji) {
      return message.reply(
        "Ça ne ressemble pas à un seul emoji — `-emoji <clé> <emoji>`.\n" +
          "Pour un emoji personnalisé DE CE SERVEUR : `:nom:` suffit. Pour un emoji d'un AUTRE serveur, il faut son code complet `<:nom:id>`."
      );
    }
    categoryEmojiStore.set(message.guild.id, slot.key, emoji);
    return message.reply(`✅ Emoji mis à jour\n${emoji} \`${slot.key.split(":")[1] || slot.key}\` — ${slot.label}`);
  }

  return messageOwner.repondreEtRetenir(message, buildEmojiPanel(message.guild.id, null));
}

async function handleEmojiInteraction(interaction) {
  if (!can(interaction.member, PERMISSION)) {
    return interaction.reply({ content: "Réservé au rang sys.", flags: MessageFlags.Ephemeral });
  }
  const [, action, ...resteCle] = interaction.customId.split(":");
  const slotKey = resteCle.join(":");

  if (action === "select") {
    return interaction.update(buildEmojiPanel(interaction.guild.id, interaction.values[0]));
  }

  if (action === "reset") {
    categoryEmojiStore.reset(interaction.guild.id, slotKey);
    return interaction.update(buildEmojiPanel(interaction.guild.id, slotKey));
  }

  if (action === "changebtn") {
    const modal = new ModalBuilder().setCustomId(`${CUSTOM_ID}:changesubmit:${slotKey}`).setTitle("Nouvel emoji");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("emoji")
          .setLabel("Emoji (unicode, :nom: ou <:nom:id>)")
          .setPlaceholder("🛡️ ou :nom:")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(40)
          .setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  if (action === "changesubmit" && interaction.isModalSubmit()) {
    const saisi = interaction.fields.getTextInputValue("emoji");
    const emoji = emojiValide(saisi, interaction.guild);
    if (!emoji) {
      return interaction.reply({
        content:
          "Ça ne ressemble pas à un seul emoji — réessaie.\n" +
          "Pour un emoji personnalisé DE CE SERVEUR, entoure son nom de deux-points : `:nom:`. Pour un emoji d'un AUTRE serveur, il faut son code complet `<:nom:id>`.",
        flags: MessageFlags.Ephemeral,
      });
    }
    categoryEmojiStore.set(interaction.guild.id, slotKey, emoji);
    return interaction.update(buildEmojiPanel(interaction.guild.id, slotKey));
  }
}

module.exports = { CUSTOM_ID, buildEmojiPanel, handleEmojiTextCommand, handleEmojiInteraction };
