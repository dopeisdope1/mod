// Catalogue des permissions de modération — reprend exactement les clés
// "moderation.*"/"logs.*"/"channels.manageall"/"members.role"/
// "protection.automod" du bot principal (discord-music-bot/utils/
// permissions/catalog.js), pour rester compatible avec les octrois déjà en
// place si permissions.json est partagé via PERMISSIONS_FILE.
const CATALOG = [
  { key: "moderation.clear", category: "moderation", label: "Nettoyer des messages (-clear)" },
  { key: "moderation.kick", category: "moderation", label: "Expulser un membre (-kick)" },
  { key: "moderation.ban", category: "moderation", label: "Bannir un membre (-ban)" },
  { key: "moderation.unban", category: "moderation", label: "Débannir un membre (-unban)" },
  { key: "moderation.softban", category: "moderation", label: "Softban (-softban)" },
  { key: "moderation.timeout", category: "moderation", label: "Timeout / fin de timeout (-timeout, -untimeout, -mute, -unmute)" },
  { key: "moderation.warn", category: "moderation", label: "Avertir un membre (-warn, -unwarn)" },
  { key: "moderation.unmuteall", category: "moderation", label: "Démute de masse (-unmuteall)" },
  { key: "moderation.banall", category: "moderation", label: "Ban de masse (-banall)", roleGrantable: false },
  { key: "moderation.unbanall", category: "moderation", label: "Débannissement de masse (-unbanall)", roleGrantable: false },
  { key: "moderation.zinkiller", category: "moderation", label: "Ban persistant, re-banni automatiquement si débanni ailleurs (-zinkiller, -unzinkiller, -zinkillerlist)" },
  { key: "channels.manageall", category: "channels", label: "Masquer/réafficher TOUS les salons (-hideall, -unhideall)" },
  { key: "channels.lockdown", category: "channels", label: "Verrouiller/déverrouiller tous les salons (-lockdown, -panic, -unlockdown)" },
  { key: "members.role", category: "members", label: "Ajouter/retirer un rôle (-derank)" },
  { key: "logs.view", category: "logs", label: "Consulter l'historique de modération (-modlogs, -sanctions, -case, panel)" },
  { key: "logs.manage", category: "logs", label: "Supprimer des entrées de l'historique (-del sanction, panel)" },
  { key: "protection.automod", category: "protection", label: "Configurer le rôle de mute (-muterole, -set muterole)" },
];

// Clés qu'aucun rôle ne peut jamais recevoir : réservées au rang sys ou à un
// octroi individuel explicite (voir engine.js::can) — même règle que le bot
// principal pour ces mêmes clés.
const isRoleGrantable = (key) => CATALOG.find((p) => p.key === key)?.roleGrantable !== false;

function byCategory() {
  const categories = [...new Set(CATALOG.map((p) => p.category))];
  return categories.map((category) => ({ category, permissions: CATALOG.filter((p) => p.category === category) }));
}

function label(key) {
  return CATALOG.find((p) => p.key === key)?.label || key;
}

module.exports = { CATALOG, byCategory, label, isRoleGrantable };
