require("dotenv").config();
const { Client, GatewayIntentBits, Partials, MessageFlags } = require("discord.js");
const statsStore = require("./utils/statsStore");
const { getPrefix, setPrefix } = require("./utils/prefixStore");
const { ADMIN_COMMANDS } = require("./utils/adminCommands");
const { moderationHandlers } = require("./utils/moderationCommands");
const moderationExtra = require("./utils/moderationExtra");
const { handleBan, handleUnban, handleBanInteraction, ID: BAN_ID } = require("./utils/banPanel");
const { handleBanAll, handleBanAllInteraction, ID: BANALL_ID } = require("./utils/banAll");
const { unbanall, handleUnbanAllInteraction, ID: UNBANALL_ID } = require("./utils/unbanAll");
const { repondreAvecBanInfo, handleBanInfoInteraction, CUSTOM_ID: BANINFO_ID } = require("./utils/banInfoCard");
const { zinkiller, unzinkiller, blinfo, zinkillerlist, checkExpiredZinkillers } = require("./utils/zinkillerCommands");
const { handleBlacklistCardInteraction, CUSTOM_ID: BLCARD_ID } = require("./utils/blacklistCard");
const { reasonadd, reasondel, reasonproof, reasongrade, reasonlist } = require("./utils/reasonCommands");
const { help, handleHelpNavInteraction, CUSTOM_ID: HELP_CUSTOM_ID } = require("./utils/helpNavigator");
const listNavigator = require("./utils/listNavigator");
const zinkillerStore = require("./utils/zinkillerStore");
const messageOwner = require("./utils/messageOwner");
const commandsStore = require("./utils/commandsStore");
const commandRules = require("./utils/commandRules");
const accessStore = require("./utils/accessStore");
const { config, handleConfigInteraction, CUSTOM_ID: CONFIG_ID } = require("./utils/configCommand");
const { handleEmojiTextCommand, handleEmojiInteraction, CUSTOM_ID: EMOJI_ID } = require("./utils/emojiPanel");
const { demanderClearMyBL } = require("./utils/clearMyBlCommands");
const { perms, helpall } = require("./utils/permsCommands");

// Liste FIXE — construite une seule fois au chargement, jamais recréée à
// chaque clic (même principe que discord-music-bot/index.js et
// secure-bot/index.js).
const PANNEAUX_PRIVES = [
  `${BAN_ID}:`,
  `${BANALL_ID}:`,
  `${UNBANALL_ID}:`,
  `${BANINFO_ID}:`,
  `${BLCARD_ID}:`,
  `${HELP_CUSTOM_ID}:`,
  `${listNavigator.CUSTOM_ID}:`,
  `${CONFIG_ID}:`,
  `${EMOJI_ID}:`,
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  // Nécessaire : les DM ne sont jamais mis en cache par défaut, donc
  // messageCreate ne se déclencherait pas pour "clearmybl" en privé sans ça.
  partials: [Partials.Channel],
  // Aucun ping par défaut, nulle part — mêmes réglages que les 3 autres bots.
  allowedMentions: { parse: [], repliedUser: false },
});

client.once("clientReady", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

/** Cible en premier argument, pour -baninfo (menu de raisons), pas un texte libre. */
function parseFirstTarget(args) {
  const mention = args[0]?.match(/^<@!?(\d{15,25})>$/);
  const id = args[0]?.match(/^\d{15,25}$/);
  return mention?.[1] || id?.[0] || null;
}

// ---- Commandes texte préfixées ----
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) {
    if (message.content.trim().toLowerCase() === "clearmybl") {
      return demanderClearMyBL(client, message).catch((err) => console.error("[clearMyBlCommands]", err));
    }
    return;
  }
  statsStore.record(message.guild.id, "messages");

  const content = message.content.trim();
  const prefix = getPrefix(message.guild.id);
  if (!prefix || !content.startsWith(prefix)) return;

  const [cmd, ...args] = content.slice(prefix.length).trim().split(/\s+/);
  const mot = (cmd || "").toLowerCase();
  if (!mot) return;

  // Filtre &panel > "Gestion des commandes" (utils/commandRules.js) —
  // additionnel au moteur de permissions existant (can()), jamais un
  // remplacement. Owner/rang sys gardent toujours un accès total. "help" et
  // "panel" restent toujours accessibles, comme sur les 3 autres bots.
  if (mot !== "help" && mot !== "panel") {
    const bypass = accessStore.isOwner(message.author.id) || accessStore.isSys(message.author.id);
    const enabled = commandsStore.isEnabledForGuild(mot, message.guild.id);
    const rulesAllow = bypass || commandRules.evaluate(message.guild.id, mot, message.member, message.channel?.id, true).allowed;
    if (!enabled || !rulesAllow) return;
  }

  try {
    if (mot === "help") return await help(client, message);
    if (mot === "panel") return await config(client, message);
    if (mot === "emoji") return await handleEmojiTextCommand(client, message, args);
    if (mot === "ban") return await handleBan(client, message, args);
    if (mot === "unban") return await handleUnban(client, message, args);
    if (mot === "banall") return await handleBanAll(client, message, args);
    if (mot === "unbanall") return await unbanall(client, message);
    if (mot === "baninfo") {
      // Deux commandes distinctes partagent le nom : consultation (logs.view,
      // sans argument supplémentaire suffisant) vs carte de bannissement
      // (moderation.ban) — voir utils/moderationExtra.js::baninfo et
      // utils/banInfoCard.js::repondreAvecBanInfo, chacune vérifie son propre
      // droit et répond en silence si refusé.
      const targetId = parseFirstTarget(args);
      if (targetId) {
        const target = await message.guild.members.fetch(targetId).catch(() => null);
        if (target) return await repondreAvecBanInfo(message, target);
      }
      return await moderationExtra.baninfo(client, message, args);
    }
    if (mot === "zinkiller") return await zinkiller(client, message, args);
    if (mot === "unzinkiller") return await unzinkiller(client, message, args);
    if (mot === "zinkillerlist") return await zinkillerlist(client, message);
    if (mot === "blinfo") return await blinfo(client, message, args);
    if (mot === "reasonadd") return await reasonadd(client, message, args);
    if (mot === "reasondel") return await reasondel(client, message, args);
    if (mot === "reasonproof") return await reasonproof(client, message, args);
    if (mot === "reasongrade") return await reasongrade(client, message, args);
    if (mot === "reasonlist") return await reasonlist(client, message);
    if (mot === "perms") return await perms(client, message);
    if (mot === "helpall") return await helpall(client, message);

    if (mot === "clear" && (args[0] || "").toLowerCase() === "sanctions") return await moderationExtra.clearSanctions(client, message, args.slice(1));
    if (mot === "clear" && (args[0] || "").toLowerCase() === "all" && (args[1] || "").toLowerCase() === "sanctions") {
      return await moderationExtra.clearAllSanctions(client, message);
    }
    if (mot === "del" && (args[0] || "").toLowerCase() === "sanction") return await moderationExtra.delSanction(client, message, args.slice(1));
    if (mot === "set" && (args[0] || "").toLowerCase() === "muterole") return await moderationExtra.setMuteRole(client, message, args.slice(1));

    const handler = ADMIN_COMMANDS[mot] || moderationHandlers[mot] || moderationExtra[mot];
    if (handler && commandsStore.isEnabledForGuild(mot, message.guild.id)) await handler(client, message, args);
  } catch (err) {
    console.error(`[moderation-bot] erreur sur "${mot}" :`, err);
  }
});

// ---- Interactions (boutons/menus/modales) ----
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton() && !interaction.isAnySelectMenu() && !interaction.isModalSubmit()) return;

  if (PANNEAUX_PRIVES.some((prefixe) => interaction.customId?.startsWith(prefixe))) {
    const { autorise, proprietaire } = await messageOwner.verifier(interaction);
    if (!autorise) {
      await interaction
        .reply({
          content: `Ce panneau a été ouvert par <@${proprietaire}>. Lance la commande toi-même pour avoir le tien.`,
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
      return;
    }
  }

  if (interaction.customId?.startsWith(`${CONFIG_ID}:`)) {
    return handleConfigInteraction(interaction).catch((err) => console.error("[configCommand]", err));
  }
  if (interaction.customId?.startsWith(`${BAN_ID}:`)) {
    return handleBanInteraction(interaction).catch((err) => console.error("[banPanel]", err));
  }
  if (interaction.customId?.startsWith(`${BANALL_ID}:`)) {
    return handleBanAllInteraction(interaction).catch((err) => console.error("[banAll]", err));
  }
  if (interaction.customId?.startsWith(`${UNBANALL_ID}:`)) {
    return handleUnbanAllInteraction(interaction).catch((err) => console.error("[unbanAll]", err));
  }
  if (interaction.customId?.startsWith(`${BANINFO_ID}:`)) {
    return handleBanInfoInteraction(interaction).catch((err) => console.error("[banInfoCard]", err));
  }
  if (interaction.customId?.startsWith(`${BLCARD_ID}:`)) {
    return handleBlacklistCardInteraction(interaction).catch((err) => console.error("[blacklistCard]", err));
  }
  if (interaction.customId?.startsWith(`${HELP_CUSTOM_ID}:`)) {
    return handleHelpNavInteraction(interaction).catch((err) => console.error("[helpNavigator]", err));
  }
  if (interaction.customId?.startsWith(`${listNavigator.CUSTOM_ID}:`)) {
    return listNavigator.handleListNavInteraction(interaction).catch((err) => console.error("[listNavigator]", err));
  }
  if (interaction.customId?.startsWith(`${EMOJI_ID}:`)) {
    return handleEmojiInteraction(interaction).catch((err) => console.error("[emojiPanel]", err));
  }
});

// ---- Ban persistant (-zinkiller) : re-bannit si débanni ailleurs que par -unzinkiller ----
client.on("guildBanRemove", async (ban) => {
  if (zinkillerStore.getConfig(ban.guild.id).enabled === false) return;
  const entry = zinkillerStore.isZinkilled(ban.guild.id, ban.user.id) ? zinkillerStore.remove(ban.guild.id, ban.user.id) : null;
  // remove() a déjà retiré l'entrée : un futur débannissement légitime
  // (-unzinkiller) ne se re-déclenchera pas dessus.
  if (!entry) return;
  try {
    await ban.guild.members.ban(ban.user.id, { reason: "Ban persistant (zinkiller) — redéclenché automatiquement" });
    console.log(`[zinkiller] ${ban.user.tag} re-banni automatiquement sur "${ban.guild.name}"`);
  } catch (err) {
    console.error(`[zinkiller] échec du re-ban automatique pour ${ban.user.id} :`, err.message);
    // Le débannissement externe a eu lieu et le re-ban a échoué : remettre
    // l'entrée pour retenter à la prochaine tentative de débannissement.
    zinkillerStore.add(ban.guild.id, ban.user.id, entry);
  }
});

// Lève les mutes/bans temporaires arrivés à échéance.
setInterval(() => {
  moderationExtra.checkExpiredMutes(client).catch((err) => console.error("[mute]", err));
  moderationExtra.checkExpiredTempbans(client).catch((err) => console.error("[tempban]", err));
  checkExpiredZinkillers(client).catch((err) => console.error("[zinkiller]", err));
}, 30_000);

// Statistiques du panel (voir utils/statsStore.js) : comptées en mémoire,
// écrites toutes les 60s et à l'arrêt — jamais à chaque message.
client.on("guildMemberAdd", (member) => statsStore.record(member.guild.id, "joins"));
client.on("guildMemberRemove", (member) => statsStore.record(member.guild.id, "leaves"));
setInterval(() => statsStore.flush(), 60_000);
// pm2 restart envoie SIGINT : sans ce handler, jusqu'à 60s de statistiques
// perdues à chaque redémarrage.
function arretPropre() {
  statsStore.flush();
  process.exit(0);
}
process.on("SIGINT", arretPropre);
process.on("SIGTERM", arretPropre);

process.on("unhandledRejection", (reason) => {
  console.error("[moderation-bot] promesse rejetée sans traitement :", reason?.stack || reason);
});
process.on("uncaughtException", (err) => {
  console.error("[moderation-bot] exception non rattrapée :", err?.stack || err);
});

const PANEL_COMMANDS = [
  { name: "prefix", category: "Admin", description: "Change le prefixe des commandes du bot." },
  { name: "emoji", category: "Admin", description: "Personnalise les emojis affiches par le bot, par serveur." },
  { name: "rename", category: "Admin", description: "Renomme le bot sur ce serveur." },
  { name: "owner", category: "Admin", description: "Gere le proprietaire du bot." },
  { name: "setrole", category: "Admin", description: "Definit un role requis pour une fonction." },
  { name: "sysadd", category: "Admin", description: "Active un systeme sur ce serveur." },
  { name: "sysdel", category: "Admin", description: "Desactive un systeme sur ce serveur." },
  { name: "ban", category: "Moderation", description: "Bannit un membre." },
  { name: "unban", category: "Moderation", description: "Debannit un membre." },
  { name: "banall", category: "Moderation", description: "Bannit plusieurs membres a la fois." },
  { name: "unbanall", category: "Moderation", description: "Debannit tous les membres bannis." },
  { name: "zinkiller", category: "Moderation", description: "Ban persistant (re-banni si debanni ailleurs) - ouvre la carte Blacklist (raisons/preuves/confirmation)." },
  { name: "unzinkiller", category: "Moderation", description: "Retire le ban persistant d'un membre." },
  { name: "zinkillerlist", category: "Moderation", description: "Liste les bans persistants actifs." },
  { name: "blinfo", category: "Moderation", description: "Consulte une entree blacklist (raison, preuve, grade, duree)." },
  { name: "reasonadd", category: "Moderation", description: "Ajoute une raison de ban predefinie (optionnellement preuve obligatoire)." },
  { name: "reasondel", category: "Moderation", description: "Retire une raison de ban predefinie." },
  { name: "reasonproof", category: "Moderation", description: "Bascule si une raison predefinie exige une preuve." },
  { name: "reasongrade", category: "Moderation", description: "Attache un grade (etiquette libre) a une raison predefinie." },
  { name: "reasonlist", category: "Moderation", description: "Liste les raisons de ban predefinies." },
  { name: "perms", category: "Moderation", description: "Affiche les paliers de permissions accordes et les commandes qu'ils debloquent." },
  { name: "helpall", category: "Moderation", description: "Affiche les paliers de permissions accordes et les roles associes." },
  { name: "kick", category: "Moderation", description: "Expulse un membre du serveur." },
  { name: "softban", category: "Moderation", description: "Bannit puis debannit immediatement (purge les messages)." },
  { name: "timeout", category: "Moderation", description: "Mute temporairement un membre (timeout Discord)." },
  { name: "untimeout", category: "Moderation", description: "Retire le timeout d'un membre." },
  { name: "modlogs", category: "Moderation", description: "Consulte l'historique de moderation d'un membre." },
  { name: "clear", category: "Moderation", description: "Supprime des messages en masse." },
  { name: "purge", category: "Moderation", description: "Purge des messages selon des criteres." },
  { name: "lockdown", category: "Moderation", description: "Verrouille le serveur/un salon." },
  { name: "unlockdown", category: "Moderation", description: "Deverrouille le serveur/un salon." },
  { name: "panic", category: "Moderation", description: "Active le mode panique (verrouillage d'urgence)." },
  { name: "mute", category: "Moderation", description: "Reduit un membre au silence." },
  { name: "tempmute", category: "Moderation", description: "Mute temporaire d'un membre." },
  { name: "unmute", category: "Moderation", description: "Retire le mute d'un membre." },
  { name: "cmute", category: "Moderation", description: "Mute un membre sur un salon precis." },
  { name: "tempcmute", category: "Moderation", description: "Mute temporaire sur un salon precis." },
  { name: "uncmute", category: "Moderation", description: "Retire le mute d'un salon precis." },
  { name: "mutelist", category: "Moderation", description: "Liste les membres actuellement mute." },
  { name: "unmuteall", category: "Moderation", description: "Retire tous les mutes actifs." },
  { name: "warn", category: "Moderation", description: "Avertit un membre." },
  { name: "warnings", category: "Moderation", description: "Liste les avertissements d'un membre." },
  { name: "unwarn", category: "Moderation", description: "Retire un avertissement." },
  { name: "tempban", category: "Moderation", description: "Bannit temporairement un membre." },
  { name: "banlist", category: "Moderation", description: "Liste les membres bannis." },
  { name: "hideall", category: "Moderation", description: "Cache tous les salons pour @everyone." },
  { name: "unhideall", category: "Moderation", description: "Reaffiche tous les salons." },
  { name: "derank", category: "Moderation", description: "Retire tous les roles d'un membre." },
];

const logStore = require("./utils/logStore");

// Message configurable depuis le panel : le DM envoyé à chaque membre avant
// -banall (même donnée que "-banall message <texte>"). Texte brut, d'où
// fields: ["description"] — le panel n'affiche pas de titre/couleur ignorés.
const banAllDmStoreForPanel = require("./utils/banAllDmStore");
const banAllDmMessage = {
  key: "banall-dm",
  label: "DM du ban de masse",
  description: "Envoyé en DM à chaque membre avant d'être banni par -banall. Vide = aucun DM.",
  fields: ["description"],
  get(guildId) {
    return {
      key: "banall-dm",
      guildId,
      title: null,
      description: banAllDmStoreForPanel.getDmMessage(guildId),
      color: null,
      imageUrl: null,
      thumbnailUrl: null,
      footer: null,
      buttons: [],
      updatedAt: null,
    };
  },
  set(guildId, patch) {
    if (patch.description !== undefined) {
      const text = typeof patch.description === "string" ? patch.description.trim() : "";
      banAllDmStoreForPanel.setDmMessage(guildId, text || null);
    }
    return banAllDmMessage.get(guildId);
  },
};

const MODERATION_SYSTEMS = [
  {
    key: "zinkiller",
    label: "Zinkiller (ban persistant)",
    description: "Re-bannit automatiquement un membre s'il est débanni ailleurs que par -unzinkiller. Désactiver ce système coupe le re-ban auto pour tout le serveur, sans vider la liste.",
    icon: "shield-ban",
    category: "Sécurité",
    getState(guildId) {
      const cfg = zinkillerStore.getConfig(guildId) || {};
      return { enabled: !!cfg.enabled, config: { membres: zinkillerStore.list(guildId).length }, updatedAt: null };
    },
    setState(guildId, patch) {
      if (typeof patch.enabled === "boolean") zinkillerStore.setEnabled(guildId, patch.enabled);
      const cfg = zinkillerStore.getConfig(guildId) || {};
      return { enabled: !!cfg.enabled, config: { membres: zinkillerStore.list(guildId).length }, updatedAt: null };
    },
  },
];

require("./utils/apiServer")(client, {
  port: process.env.PANEL_API_PORT || 4003,
  apiKey: process.env.PANEL_API_KEY,
  botName: "Moderation",
  commands: PANEL_COMMANDS,
  commandsStore,
  getPrefix,
  setPrefix,
  logStore,
  statsStore,
  statsMetrics: [
    { metric: "messages", title: "Messages" },
    { metric: "joins", title: "Member joins" },
    { metric: "leaves", title: "Member leaves" },
    { metric: "sanctions", title: "Actions de modération" },
  ],
  messageStore: banAllDmMessage,
  systems: MODERATION_SYSTEMS,
});
client.login(process.env.DISCORD_TOKEN);
