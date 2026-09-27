const categoryEmojiStore = require("./categoryEmojiStore");

// Registre de TOUS les messages que le bot envoie (hors emojis/titres, voir
// utils/emojiSlots.js et utils/customizePanel.js) — personnalisables par
// serveur depuis "-panel > Textes". Réutilise le même stockage générique
// (utils/categoryEmojiStore.js), espace de clés "msg:<clé>". `{placeholder}`
// est remplacé à l'envoi par la valeur fournie dans `vars` — un placeholder
// sans valeur fournie reste tel quel. `commande` sert uniquement d'affichage
// (description du select "-panel > Textes").
const MESSAGES = {
  // --- Préfixe & profil (-prefix, -rename) ---
  prefix_current: { defaut: "Préfixe actuel : `{prefix}`", label: "Préfixe actuel", categorie: "Préfixe & profil", commande: "-prefix" },
  prefix_invalid: { defaut: "Un préfixe fait 3 caractères au maximum, sans espace.", label: "Préfixe invalide", categorie: "Préfixe & profil", commande: "-prefix" },
  prefix_success: { defaut: "Préfixe changé pour `{prefix}`.", label: "Préfixe changé", categorie: "Préfixe & profil", commande: "-prefix" },
  rename_missing: { defaut: "Indique un nom : `rename <nouveau nom>`.", label: "Renommer — nom manquant", categorie: "Préfixe & profil", commande: "-rename" },
  rename_toolong: { defaut: "Un pseudo Discord fait 32 caractères au maximum.", label: "Renommer — trop long", categorie: "Préfixe & profil", commande: "-rename" },
  rename_noperm: { defaut: "Il me manque la permission **Changer de pseudo**.", label: "Renommer — permission manquante", categorie: "Préfixe & profil", commande: "-rename" },
  rename_refused: { defaut: "Discord a refusé : {erreur}", label: "Renommer — refusé par Discord", categorie: "Préfixe & profil", commande: "-rename" },
  rename_success: { defaut: "Renommé en **{nom}** sur ce serveur.", label: "Renommer — succès", categorie: "Préfixe & profil", commande: "-rename" },

  // --- Accès (-owner, -setrole, -sysadd, -sysdel) ---
  member_missing: { defaut: "Indique un membre (mention ou identifiant) : `{commande} @membre`.", label: "Membre manquant (argument)", categorie: "Accès", commande: "-owner" },
  member_not_found: { defaut: "Ce membre n'est pas sur le serveur.", label: "Membre introuvable sur le serveur", categorie: "Accès", commande: "-owner / modération" },
  owner_removed: { defaut: "{tag} — accès de modération complet retiré.", label: "owner — accès retiré", categorie: "Accès", commande: "-owner" },
  owner_granted: { defaut: "{tag} a maintenant accès à toutes les commandes de modération courantes (hors ban de masse).", label: "owner — accès accordé", categorie: "Accès", commande: "-owner" },
  setrole_missing_role: { defaut: "Indique un rôle : `setrole @rôle <clé>`.", label: "setrole — rôle manquant", categorie: "Accès", commande: "-setrole" },
  setrole_unknown_key: { defaut: "Clé inconnue. Clés valides : {cles}.", label: "setrole — clé inconnue", categorie: "Accès", commande: "-setrole" },
  setrole_not_role_grantable: { defaut: "`{cle}` ne peut jamais être accordée à un rôle — seulement en octroi individuel (owner) ou au rang sys.", label: "setrole — clé non accordable à un rôle", categorie: "Accès", commande: "-setrole" },
  setrole_success: { defaut: "{role} — `{cle}` {action}.", label: "setrole — succès", categorie: "Accès", commande: "-setrole" },
  sysadd_missing: { defaut: "Indique un membre : `sysadd @membre`.", label: "sysadd — membre manquant", categorie: "Accès", commande: "-sysadd" },
  sysadd_already: { defaut: "Ce membre a déjà le rang sys.", label: "sysadd — déjà rang sys", categorie: "Accès", commande: "-sysadd" },
  sysadd_success: { defaut: "<@{id}> a maintenant le rang sys.", label: "sysadd — succès", categorie: "Accès", commande: "-sysadd" },
  sysdel_missing: { defaut: "Indique un membre : `sysdel @membre`.", label: "sysdel — membre manquant", categorie: "Accès", commande: "-sysdel" },
  sysdel_not_sys: { defaut: "Ce membre n'a pas le rang sys.", label: "sysdel — n'a pas le rang sys", categorie: "Accès", commande: "-sysdel" },
  sysdel_success: { defaut: "<@{id}> a perdu le rang sys.", label: "sysdel — succès", categorie: "Accès", commande: "-sysdel" },
};

const CATEGORIES = [...new Set(Object.values(MESSAGES).map((m) => m.categorie))];

/** Remplace chaque `{cle}` du texte par vars[cle] — laisse le placeholder tel quel si absent. */
function interpoler(texte, vars = {}) {
  return texte.replace(/\{(\w+)\}/g, (m, cle) => (cle in vars ? String(vars[cle]) : m));
}

/** Le texte réellement envoyé pour ce message, sur ce serveur — personnalisé, ou celui par défaut, avec `vars` substituées. */
function msg(guildId, key, vars = {}) {
  const def = MESSAGES[key];
  const texte = (guildId && categoryEmojiStore.get(guildId, `msg:${key}`)) || def?.defaut || key;
  return interpoler(texte, vars);
}

function texteDe(guildId, key) {
  return categoryEmojiStore.get(guildId, `msg:${key}`) || MESSAGES[key]?.defaut || "";
}

function setMessage(guildId, key, texte) {
  categoryEmojiStore.set(guildId, `msg:${key}`, texte);
}

function resetMessage(guildId, key) {
  categoryEmojiStore.reset(guildId, `msg:${key}`);
}

module.exports = { MESSAGES, CATEGORIES, msg, texteDe, setMessage, resetMessage };
