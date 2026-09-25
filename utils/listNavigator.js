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
const messageOwner = require("./messageOwner");

// Composant générique pour toute commande "liste" (-banlist, -mutelist...) :
// UN message, paginé avec Précédent/Suivant plutôt que tronqué en silence ou
// dumpé sans limite au risque de dépasser le plafond de texte Discord. Repris
// tel quel de discord-music-bot/utils/listNavigator.js.
const CUSTOM_ID = "listnav";

const PROVIDERS = new Map();

/**
 * @param {string} kind identifiant unique de la liste (ex: "banlist")
 * @param {(guild: import('discord.js').Guild) => { title: string, lines: string[], vide?: string, numerote?: boolean }} fournisseur
 */
function registerProvider(kind, fournisseur) {
  PROVIDERS.set(kind, fournisseur);
}

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

async function buildListNavigator(kind, guild, page = 0) {
  const fournisseur = PROVIDERS.get(kind);
  const { title, lines, vide, erreur, compteur, numerote } = await fournisseur(guild);
  const container = new ContainerBuilder();

  if (erreur) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}\n${erreur}`));
    return { flags: MessageFlags.IsComponentsV2, components: [container] };
  }

  if (!lines.length) {
    const compteurVide = compteur ? `${compteur}\n` : "";
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}\n${compteurVide}${vide || "Aucune entrée."}`));
    return { flags: MessageFlags.IsComponentsV2, components: [container] };
  }

  const lignesAffichees = numerote ? lines.map((ligne, i) => `${i + 1}. ${ligne}`) : lines;
  const pages = paginerLignes(lignesAffichees);
  const pageActive = Math.min(Math.max(page, 0), pages.length - 1);
  const suffixe = pages.length > 1 ? ` (${pageActive + 1}/${pages.length})` : "";
  const enTete = compteur ? `## ${title}${suffixe}\n${compteur}` : `## ${title} — ${lines.length}${suffixe}`;
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${enTete}\n${pages[pageActive].join("\n")}`));

  if (pages.length > 1) {
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID}:${kind}:${pageActive - 1}`)
          .setLabel("Précédent")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageActive === 0),
        new ButtonBuilder()
          .setCustomId(`${CUSTOM_ID}:${kind}:${pageActive + 1}`)
          .setLabel("Suivant")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageActive === pages.length - 1)
      )
    );
  }

  return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

/** Poste la liste navigable et en retient le propriétaire (voir utils/messageOwner.js). */
async function repondreAvecListe(kind, message) {
  return messageOwner.repondreEtRetenir(message, await buildListNavigator(kind, message.guild, 0));
}

async function handleListNavInteraction(interaction) {
  const [, kind, page] = interaction.customId.split(":");
  if (!PROVIDERS.has(kind)) return;
  return interaction.update(await buildListNavigator(kind, interaction.guild, Number(page)));
}

module.exports = { CUSTOM_ID, registerProvider, buildListNavigator, repondreAvecListe, handleListNavInteraction };
