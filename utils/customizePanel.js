const { can } = require("./permissions/engine");
const categoryEmojiStore = require("./categoryEmojiStore");

// "-couleur" / "-titre" — personnalisation par serveur, réutilise le même
// stockage que "-emoji" (utils/categoryEmojiStore.js est un simple
// guildId -> clé -> valeur, rien de spécifique aux emojis) avec ses propres
// espaces de clés : "color:accent" et "text:<slot>". Réservé au rang sys,
// même patron que voice-master/utils/customizePanel.js.
const PERMISSION = "sys";
const COULEUR_DEFAUT = 0x5865f2; // Blurple Discord, même repli que les autres bots sans thème dédié.

const TITRES = {
  help: { defaut: "🔨 Modération — Aide", label: "Titre de -help" },
  panel: { defaut: "「 CONFIGURATION — MODÉRATION 」", label: "Titre de -panel" },
};

/** @returns {number} couleur d'accent des cartes Components V2 de ce serveur, en entier (setAccentColor). */
function accentColor(guildId) {
  const hex = categoryEmojiStore.get(guildId, "color:accent");
  const n = hex ? parseInt(hex.replace("#", ""), 16) : NaN;
  return Number.isFinite(n) ? n : COULEUR_DEFAUT;
}

/** @returns {string} le titre personnalisé pour ce slot ("help"/"panel"), ou son défaut. */
function titreDe(guildId, slot) {
  return categoryEmojiStore.get(guildId, `text:${slot}`) || TITRES[slot]?.defaut || "";
}

function hexValide(texte) {
  const t = texte.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(t) ? `#${t.toLowerCase()}` : null;
}

/** "-couleur [#RRGGBB|reset]" — couleur d'accent des cartes du bot sur ce serveur. */
async function couleur(client, message, args) {
  if (!can(message.member, PERMISSION)) return;
  const arg = (args[0] || "").trim();

  if (!arg) {
    return message.reply(`Couleur actuelle : \`#${accentColor(message.guild.id).toString(16).padStart(6, "0")}\`. Utilise \`-couleur #RRGGBB\` ou \`-couleur reset\`.`);
  }
  if (arg.toLowerCase() === "reset") {
    categoryEmojiStore.reset(message.guild.id, "color:accent");
    return message.reply(`✅ Couleur réinitialisée (\`#${COULEUR_DEFAUT.toString(16).padStart(6, "0")}\`).`);
  }
  const hex = hexValide(arg);
  if (!hex) return message.reply("Indique une couleur hexadécimale : `-couleur #RRGGBB` (ex. `-couleur #ff4d4d`).");
  categoryEmojiStore.set(message.guild.id, "color:accent", hex);
  return message.reply(`✅ Couleur mise à jour : \`${hex}\`.`);
}

/** "-titre <help|panel> [texte|reset]" — texte d'en-tête de -help/-panel sur ce serveur. */
async function titre(client, message, args) {
  if (!can(message.member, PERMISSION)) return;
  const slot = (args[0] || "").toLowerCase();
  if (!TITRES[slot]) {
    return message.reply(
      `Utilisation : \`-titre help <texte>\` ou \`-titre panel <texte>\` (\`reset\` pour revenir au défaut).\nTitres actuels :\n${Object.keys(TITRES)
        .map((s) => `\`${s}\` — ${titreDe(message.guild.id, s)}`)
        .join("\n")}`
    );
  }
  const reste = args.slice(1).join(" ").trim();
  if (!reste) return message.reply(`Titre actuel de \`${slot}\` : ${titreDe(message.guild.id, slot)}`);
  if (reste.toLowerCase() === "reset") {
    categoryEmojiStore.reset(message.guild.id, `text:${slot}`);
    return message.reply(`✅ Titre de \`${slot}\` réinitialisé.`);
  }
  if (reste.length > 100) return message.reply("100 caractères maximum.");
  categoryEmojiStore.set(message.guild.id, `text:${slot}`, reste);
  return message.reply(`✅ Titre de \`${slot}\` mis à jour.`);
}

module.exports = { accentColor, titreDe, couleur, titre };
