// Catégories de "-help" — extrait de utils/helpNavigator.js pour que
// utils/emojiSlots.js puisse aussi les exposer comme slots personnalisables
// via "-emoji" (même logique que utils/commandCatalog.js sur discord-music-bot,
// séparé de utils/helpNavigator.js pour éviter une dépendance circulaire).
const CATEGORIES = [
  {
    key: "sanctions",
    label: "Sanctions",
    emoji: "🔨",
    commandes: [
      { nom: "kick @membre [raison]", permission: "moderation.kick", description: "Expulse un membre — droit `moderation.kick`." },
      { nom: "ban @membre|id [raison]", permission: "moderation.ban", description: "Bannit un membre — droit `moderation.ban`." },
      { nom: "unban [id]", permission: "moderation.unban", description: "Débannit (sans argument : liste des bannis) — droit `moderation.unban`." },
      { nom: "softban @membre [raison]", permission: "moderation.softban", description: "Bannit puis débannit aussitôt, purge les messages des 24h — droit `moderation.softban`." },
      { nom: "timeout @membre <durée> [raison]", permission: "moderation.timeout", description: "Timeout Discord natif (max 28 jours) — droit `moderation.timeout`." },
      { nom: "untimeout @membre", permission: "moderation.timeout", description: "Lève un timeout — droit `moderation.timeout`." },
      { nom: "warn @membre [raison]", permission: "moderation.warn", description: "Avertit un membre (historique) — droit `moderation.warn`." },
      { nom: "unwarn @membre <numéro>", permission: "logs.manage", description: "Retire un avertissement précis — droit `logs.manage`." },
      { nom: "mute @membre [raison]", permission: "moderation.timeout", description: "Mute par rôle (alias : cmute) — droit `moderation.timeout`." },
      { nom: "tempmute @membre <durée> [raison]", permission: "moderation.timeout", description: "Mute temporaire par rôle (alias : tempcmute) — droit `moderation.timeout`." },
      { nom: "unmute @membre", permission: "moderation.timeout", description: "Démute (alias : uncmute) — droit `moderation.timeout`." },
      { nom: "tempban @membre <durée> [raison]", permission: "moderation.ban", description: "Ban temporaire, débanni automatiquement à l'échéance — droit `moderation.ban`." },
      { nom: "zinkiller @membre|id [raison]", permission: "moderation.zinkiller", description: "Ban persistant (re-banni s'il est débanni ailleurs) — droit `moderation.zinkiller`." },
      { nom: "unzinkiller @membre|id", permission: "moderation.zinkiller", description: "Retire le ban persistant et débannit — droit `moderation.zinkiller`." },
      { nom: "derank @membre", permission: "members.role", description: "Retire tous les rôles gérables d'un membre — droit `members.role`." },
    ],
  },
  {
    key: "masse",
    label: "Actions de masse",
    emoji: "⚡",
    commandes: [
      { nom: "banall [raison]", permission: "moderation.banall", description: "Bannit tout le monde (confirmation, sauf protégés) — droit `moderation.banall`, jamais octroyable par rôle." },
      { nom: "banall message <texte>", permission: "moderation.banall", description: "Configure le message DM envoyé avant chaque ban de masse — droit `moderation.banall`." },
      { nom: "unbanall", permission: "moderation.unbanall", description: "Débannit tout le monde (confirmation) — droit `moderation.unbanall`, jamais octroyable par rôle." },
      { nom: "unmuteall", permission: "moderation.unmuteall", description: "Démute tout le monde d'un coup — droit `moderation.unmuteall`." },
      { nom: "hideall", permission: "channels.manageall", description: "Masque tous les salons textuels à @everyone — droit `channels.manageall`." },
      { nom: "unhideall", permission: "channels.manageall", description: "Réaffiche tous les salons textuels — droit `channels.manageall`." },
      { nom: "lockdown", permission: "channels.lockdown", description: "Verrouille tous les salons (alias : panic) — droit `channels.lockdown`." },
      { nom: "unlockdown", permission: "channels.lockdown", description: "Déverrouille tous les salons — droit `channels.lockdown`." },
      { nom: "clear @membre|id [nombre]", permission: "moderation.clear", description: "Supprime les messages d'un membre (défaut 50, max 200) — droit `moderation.clear`." },
    ],
  },
  {
    key: "consultation",
    label: "Consultation",
    emoji: "📋",
    commandes: [
      { nom: "sanctions @membre|id", permission: "logs.view", description: "Historique complet d'un membre — droit `logs.view`." },
      { nom: "warnings @membre|id", permission: "logs.view", description: "Avertissements d'un membre — droit `logs.view`." },
      { nom: "modlogs [@membre|id]", permission: "logs.view", description: "10 dernières entrées de l'historique — droit `logs.view`." },
      { nom: "case <numéro>", permission: "logs.view", description: "Fiche détaillée d'une case — droit `logs.view`." },
      { nom: "baninfo <@membre|id>", permission: "logs.view", description: "Détail du dernier ban enregistré — droit `logs.view`." },
      { nom: "baninfo <@membre>", permission: "moderation.ban", description: "Carte raisons/durée avant de bannir — droit `moderation.ban`." },
      { nom: "banlist", permission: "moderation.unban", description: "Liste des membres bannis — droit `moderation.unban`." },
      { nom: "mutelist", permission: "moderation.timeout", description: "Mutes actifs (rôle + timeout Discord) — droit `moderation.timeout`." },
      { nom: "zinkillerlist", permission: "moderation.zinkiller", description: "Bans persistants actifs — droit `moderation.zinkiller`." },
      { nom: "del sanction @membre <numéro>", permission: "logs.manage", description: "Supprime une sanction précise — droit `logs.manage`." },
      { nom: "clear sanctions @membre", permission: "logs.manage", description: "Supprime toutes les sanctions d'un membre — droit `logs.manage`." },
      { nom: "clear all sanctions", permission: "logs.manage", description: "Supprime tout l'historique du serveur — droit `logs.manage`." },
    ],
  },
  {
    key: "configuration",
    label: "Configuration",
    emoji: "⚙️",
    commandes: [
      { nom: "muterole", permission: "protection.automod", description: "Affiche le rôle de mute configuré — droit `protection.automod`." },
      { nom: "set muterole @rôle", permission: "protection.automod", description: "Configure le rôle de mute — droit `protection.automod`." },
      { nom: "owner <@membre>", permission: "panel.permissions.manage", description: "Accorde/retire des permissions de modération individuelles." },
      { nom: "prefix <nouveau>", permission: null, description: "Réservé au rang sys — change le préfixe de ce bot sur ce serveur." },
    ],
  },
];

module.exports = { CATEGORIES };
