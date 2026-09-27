const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const { getPrefix } = require("./prefixStore");
const { can } = require("./permissions/engine");
const messageOwner = require("./messageOwner");
const { titreDe } = require("./customizePanel");
const { categoryEmojiDe } = require("./emojiSlots");
const { CATEGORIES } = require("./helpCategories");

// "-help" — même moteur d'aide navigable que le bot principal (menu
// déroulant "Choisir une catégorie" + Précédent/Suivant si une catégorie ne
// tient pas sur une page), un seul message jamais dupliqué. CATEGORIES vit
// dans utils/helpCategories.js (partagé avec utils/emojiSlots.js, qui
// expose l'emoji de chaque catégorie comme slot personnalisable via
// "-emoji").
const CUSTOM_ID = "helpnav";

const LIMITE_PAGE = 3400;

function paginerLignes(lignes) {
  const pages = [];
  let courante = [];
  let longueur = 0;
  for (const ligne of lignes) {
    const ajout = ligne.length + 1;
    if (courante.length && longueur + ajout > LIMITE_PAGE) {
      pages.push(courante);
      courante = [];
      longueur = 0;
    }
    courante.push(ligne);
    longueur += ajout;
  }
  if (courante.length) pages.push(courante);
  return pages.length ? pages : [[]];
}

/** Catégories non vides, filtrées selon les permissions du membre. */
function buildTiers(guildId, member, prefix) {
  return CATEGORIES.map((cat) => {
    const cmds = cat.commandes.filter((c) => can(member, c.permission));
    const lines = cmds.map((c) => `> \`${prefix}${c.nom}\` (${c.description})`);
    return { key: cat.key, label: `${categoryEmojiDe(guildId, cat.key)} ${cat.label}`, lines, count: cmds.length };
  }).filter((t) => t.count);
}

function buildHelpNavigator(guildId, member, state = {}) {
  const prefix = getPrefix(guildId);
  const tiers = buildTiers(guildId, member, prefix);
  const tierKey = state.tier && tiers.some((t) => t.key === state.tier) ? state.tier : "accueil";
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${titreDe(guildId, "help")}\nVoici les commandes disponibles, filtrées selon tes permissions.`)
  );
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  let pageCount = 1;
  let page = 0;
  if (tierKey === "accueil") {
    const lignes = tiers.map((t) => `**${t.label}** — ${t.count} commande(s)`);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lignes.length ? lignes.join("\n") : "*Aucune commande accessible pour l'instant.*")
    );
  } else {
    const tier = tiers.find((t) => t.key === tierKey);
    const pages = paginerLignes(tier.lines);
    pageCount = pages.length;
    page = Math.min(Math.max(state.page || 0, 0), pageCount - 1);
    const titre = `**${tier.label}${pageCount > 1 ? ` (${page + 1}/${pageCount})` : ""}**`;
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${titre}\n${pages[page].join("\n")}`));
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`> Préfixe : \`${prefix}\``));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  const options = [
    new StringSelectMenuOptionBuilder().setLabel("Accueil").setValue("accueil").setDefault(tierKey === "accueil"),
    ...tiers.map((t) =>
      new StringSelectMenuOptionBuilder().setLabel(`${t.label} (${t.count})`).setValue(t.key).setDefault(t.key === tierKey)
    ),
  ];
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId(`${CUSTOM_ID}:select`).setPlaceholder("Choisir une catégorie").addOptions(options)
    )
  );

  if (tierKey !== "accueil" && pageCount > 1) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID}:page:${tierKey}:${page - 1}`)
          .setLabel("Précédent")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID}:page:${tierKey}:${page + 1}`)
          .setLabel("Suivant")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === pageCount - 1)
      )
    );
  }

  return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

async function help(client, message) {
  return messageOwner.repondreEtRetenir(message, buildHelpNavigator(message.guild.id, message.member));
}

async function handleHelpNavInteraction(interaction) {
  const [, action, ...rest] = interaction.customId.split(":");

  let state;
  if (action === "select") {
    state = { tier: interaction.values[0], page: 0 };
  } else if (action === "page") {
    const [tier, page] = rest;
    state = { tier, page: Number(page) };
  } else {
    return;
  }

  return interaction.update(buildHelpNavigator(interaction.guild.id, interaction.member, state));
}

module.exports = { CUSTOM_ID, help, buildHelpNavigator, handleHelpNavInteraction, CATEGORIES };
