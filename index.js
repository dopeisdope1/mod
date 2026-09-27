require("dotenv").config();
const { Client, GatewayIntentBits, MessageFlags } = require("discord.js");
const { getPrefix } = require("./utils/prefixStore");
const { ADMIN_COMMANDS } = require("./utils/adminCommands");
const { moderationHandlers } = require("./utils/moderationCommands");
const moderationExtra = require("./utils/moderationExtra");
const { handleBan, handleUnban, handleBanInteraction, ID: BAN_ID } = require("./utils/banPanel");
const { handleBanAll, handleBanAllInteraction, ID: BANALL_ID } = require("./utils/banAll");
const { unbanall, handleUnbanAllInteraction, ID: UNBANALL_ID } = require("./utils/unbanAll");
const { repondreAvecBanInfo, handleBanInfoInteraction, CUSTOM_ID: BANINFO_ID } = require("./utils/banInfoCard");
const { zinkiller, unzinkiller, zinkillerlist } = require("./utils/zinkillerCommands");
const { help, handleHelpNavInteraction, CUSTOM_ID: HELP_CUSTOM_ID } = require("./utils/helpNavigator");
const listNavigator = require("./utils/listNavigator");
const zinkillerStore = require("./utils/zinkillerStore");
const messageOwner = require("./utils/messageOwner");
const commandsStore = require("./utils/commandsStore");
const commandRules = require("./utils/commandRules");
const accessStore = require("./utils/accessStore");
const { config, handleConfigInteraction, CUSTOM_ID: CONFIG_ID } = require("./utils/configCommand");

// Liste FIXE — construite une seule fois au chargement, jamais recréée à
// chaque clic (même principe que discord-music-bot/index.js et
// secure-bot/index.js).
const PANNEAUX_PRIVES = [
  `${BAN_ID}:`,
  `${BANALL_ID}:`,
  `${UNBANALL_ID}:`,
  `${BANINFO_ID}:`,
  `${HELP_CUSTOM_ID}:`,
  `${listNavigator.CUSTOM_ID}:`,
  `${CONFIG_ID}:`,
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
  ],
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
  if (message.author.bot || !message.guild) return;

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

    if (mot === "clear" && (args[0] || "").toLowerCase() === "sanctions") return await moderationExtra.clearSanctions(client, message, args.slice(1));
    if (mot === "clear" && (args[0] || "").toLowerCase() === "all" && (args[1] || "").toLowerCase() === "sanctions") {
      return await moderationExtra.clearAllSanctions(client, message);
    }
    if (mot === "del" && (args[0] || "").toLowerCase() === "sanction") return await moderationExtra.delSanction(client, message, args.slice(1));
    if (mot === "set" && (args[0] || "").toLowerCase() === "muterole") return await moderationExtra.setMuteRole(client, message, args.slice(1));

    const handler = ADMIN_COMMANDS[mot] || moderationHandlers[mot] || moderationExtra[mot];
    if (handler) await handler(client, message, args);
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
  if (interaction.customId?.startsWith(`${HELP_CUSTOM_ID}:`)) {
    return handleHelpNavInteraction(interaction).catch((err) => console.error("[helpNavigator]", err));
  }
  if (interaction.customId?.startsWith(`${listNavigator.CUSTOM_ID}:`)) {
    return listNavigator.handleListNavInteraction(interaction).catch((err) => console.error("[listNavigator]", err));
  }
});

// ---- Ban persistant (-zinkiller) : re-bannit si débanni ailleurs que par -unzinkiller ----
client.on("guildBanRemove", async (ban) => {
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
}, 30_000);

process.on("unhandledRejection", (reason) => {
  console.error("[moderation-bot] promesse rejetée sans traitement :", reason?.stack || reason);
});
process.on("uncaughtException", (err) => {
  console.error("[moderation-bot] exception non rattrapée :", err?.stack || err);
});

client.login(process.env.DISCORD_TOKEN);
