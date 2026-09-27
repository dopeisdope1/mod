const { can } = require("./permissions/engine");
const categoryEmojiStore = require("./categoryEmojiStore");

// "-titre" — personnalisation par serveur, réutilise le même stockage que
// "-emoji" (utils/categoryEmojiStore.js est un simple guildId -> clé ->
// valeur, rien de spécifique aux emojis) avec son propre espace de clés :
// "text:<slot>". Réservé au rang sys, même patron que voice-master/utils/
// customizePanel.js.
const PERMISSION = "sys";

const TITRES = {
  help: { defaut: "🔨 Modération — Aide", label: "Titre de -help" },
  panel: { defaut: "「 CONFIGURATION — MODÉRATION 」", label: "Titre de -panel" },
};

/** @returns {string} le titre personnalisé pour ce slot ("help"/"panel"), ou son défaut. */
function titreDe(guildId, slot) {
  return categoryEmojiStore.get(guildId, `text:${slot}`) || TITRES[slot]?.defaut || "";
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

module.exports = { titreDe, titre };
