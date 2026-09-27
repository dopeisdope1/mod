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
  RoleSelectMenuBuilder,
  UserSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  PermissionFlagsBits,
} = require("discord.js");
const accessStore = require("./accessStore");
const messageOwner = require("./messageOwner");
const { can } = require("./permissions/engine");
const permStore = require("./permissions/store");
const permCatalog = require("./permissions/catalog");
const commandsStore = require("./commandsStore");
const commandRules = require("./commandRules");
const { getPrefix, setPrefix } = require("./prefixStore");
const { TITRES, accentColor, setAccentColor, resetAccentColor, applyAccent, titreDe, setTitre, resetTitre } = require("./customizePanel");
const { iconDe } = require("./emojiSlots");
const { MESSAGES, CATEGORIES: MESSAGE_CATEGORIES, texteDe, setMessage, resetMessage } = require("./messages");
const modLogStore = require("./modLogStore");
const { ADMIN_COMMANDS } = require("./adminCommands");
const { moderationHandlers } = require("./moderationCommands");
const moderationExtra = require("./moderationExtra");

// "-panel > Textes" couvre à la fois les titres (utils/customizePanel.js)
// et les messages du bot (utils/messages.js) — présentés ensemble sous une
// même catégorie "Titres" pour ne pas dupliquer l'UI.
const TEXT_CATEGORIES = ["Titres", ...MESSAGE_CATEGORIES];

function textItemsFor(categorie) {
  if (categorie === "Titres") return Object.entries(TITRES).map(([key, t]) => ({ key, label: t.label, commande: t.commande }));
  return Object.entries(MESSAGES)
    .filter(([, def]) => def.categorie === categorie)
    .map(([key, def]) => ({ key, label: def.label, commande: def.commande }));
}

function textLabelFor(categorie, key) {
  return textItemsFor(categorie).find((i) => i.key === key)?.label || key;
}

function textValueFor(guildId, categorie, key) {
  return categorie === "Titres" ? titreDe(guildId, key) : texteDe(guildId, key);
}

function textSetFor(guildId, categorie, key, val) {
  return categorie === "Titres" ? setTitre(guildId, key, val) : setMessage(guildId, key, val);
}

function textResetFor(guildId, categorie, key) {
  return categorie === "Titres" ? resetTitre(guildId, key) : resetMessage(guildId, key);
}

// Centre de configuration de moderation-bot — "&panel" (bot séparé de
// discord-music-bot, même préfixe par défaut mais processus/token distincts,
// aucun conflit). Même patron que =panel/!!config : sections + navigation par
// select menu, tout customId commence par "modconfig:".
const ID = "modconfig";

// Toutes les commandes dispatchables au sens large. Les branches spéciales du
// dispatch (ban/unban/banall/unbanall/baninfo/zinkiller*/clear
// sanctions/del sanction/set muterole) sont ajoutées explicitement : elles ne
// vivent pas dans une table d'objet comme les autres, mais passent bien par
// le même filtre commandRules dans index.js.
const ALL_COMMAND_NAMES = () => [
  ...Object.keys(ADMIN_COMMANDS),
  ...Object.keys(moderationHandlers),
  ...Object.keys(moderationExtra).filter((k) => typeof moderationExtra[k] === "function"),
  "ban",
  "unban",
  "banall",
  "unbanall",
  "baninfo",
  "zinkiller",
  "unzinkiller",
  "zinkillerlist",
];

const SECTIONS = [
  { key: "home", label: "Accueil", description: "Vue d'ensemble" },
  { key: "prefix", label: "Préfixe", description: "Préfixe des commandes", permission: "sys" },
  { key: "profile", label: "Profil du bot", description: "Renommer le bot sur ce serveur", permission: "sys" },
  { key: "logs", label: "Logs", description: "Salon de l'historique de modération", permission: "logs.manage" },
  {
    key: "permissions",
    label: "Rôles et permissions",
    description: "Quel rôle/membre débloque quelles clés de modération",
    permission: "panel.permissions.manage",
  },
  {
    key: "commands",
    label: "Gestion des commandes",
    description: "Activer/désactiver, rôles/membres/salons autorisés-interdits, par commande",
    permission: "panel.permissions.manage",
  },
  { key: "sys", label: "Rang sys", description: "Qui a accès à tout le bot", ownerOnly: true },
  { key: "appearance", label: "Apparence", description: "Couleur d'accent des cartes du bot", permission: "sys" },
  { key: "texts", label: "Textes", description: "Titres et messages du bot", permission: "sys" },
];

function sectionVisible(section, member, isOwner) {
  if (section.key === "home") return true;
  if (section.ownerOnly) return isOwner;
  return can(member, section.permission);
}

const sectionsFor = (member, isOwner) => SECTIONS.filter((s) => sectionVisible(s, member, isOwner));

function hasAnyPanelAccess(member) {
  const isOwner = accessStore.isOwner(member.id);
  return sectionsFor(member, isOwner).some((s) => s.ownerOnly || s.permission != null);
}

function buildNav(current, member, isOwner) {
  const disponibles = sectionsFor(member, isOwner);
  return new StringSelectMenuBuilder()
    .setCustomId(`${ID}:nav`)
    .setPlaceholder("Choisir une rubrique")
    .addOptions(
      disponibles.map((s) =>
        new StringSelectMenuOptionBuilder().setLabel(s.label).setDescription(s.description.slice(0, 100)).setValue(s.key).setDefault(s.key === current)
      )
    );
}

function sectionBody(section, guild, member, state) {
  const guildId = guild.id;

  if (section === "home") {
    return `> **Serveur** : ${guild.name}\n> **Préfixe** : \`${getPrefix(guildId)}\``;
  }

  if (section === "prefix") {
    return `> **Préfixe actuel** : \`${getPrefix(guildId)}\``;
  }

  if (section === "profile") {
    return `> **Pseudo actuel sur ce serveur** : ${guild.members.me?.nickname || guild.members.me?.user.username || "—"}`;
  }

  if (section === "logs") {
    const channelId = modLogStore.getLogChannelId(guildId);
    return `> **Salon de logs de modération** : ${channelId ? `<#${channelId}>` : "*non configuré*"}`;
  }

  if (section === "permissions") {
    const roleId = state.permissionsRoleId;
    if (!roleId || !guild.roles.cache.has(roleId)) {
      return "> Choisis un rôle ci-dessous pour voir/modifier ses clés de modération.";
    }
    const role = guild.roles.cache.get(roleId);
    const granted = permStore.getRoleGrants(guildId, roleId);
    const lignes = permCatalog.CATALOG.map((p) => `${granted.includes(p.key) ? iconDe(guildId, "SUCCESS") : iconDe(guildId, "ERROR")} \`${p.key}\` — ${p.label}`);
    return [`> **Rôle** : ${role.name}`, ...lignes].join("\n");
  }

  if (section === "commands") {
    const cmdName = state.commandsSelected;
    if (!cmdName) return "> Choisis une commande ci-dessous pour voir/modifier sa configuration.";
    const enabled = commandsStore.isEnabledForGuild(cmdName, guildId);
    const rule = commandRules.getRule(guildId, cmdName);
    const mentionUser = (id) => `<@${id}>`;
    const mentionRole = (id) => `<@&${id}>`;
    const mentionChannel = (id) => `<#${id}>`;
    const liste = (ids, fn) => (ids.length ? ids.map(fn).join(", ") : "*aucun*");
    return [
      `> **Commande** : \`${cmdName}\``,
      `> **État** : ${enabled ? "🟢 Activée" : "🔴 Désactivée"}`,
      `> **Rôles autorisés** : ${liste(rule.allowedRoles, mentionRole)}`,
      `> **Rôles interdits** : ${liste(rule.deniedRoles, mentionRole)}`,
      `> **Membres autorisés** : ${liste(rule.allowedUsers, mentionUser)}`,
      `> **Membres interdits** : ${liste(rule.deniedUsers, mentionUser)}`,
      `> **Salons autorisés** : ${liste(rule.allowedChannels, mentionChannel)}`,
      `> **Salons interdits** : ${liste(rule.deniedChannels, mentionChannel)}`,
    ].join("\n");
  }

  if (section === "appearance") {
    const c = accentColor(guildId);
    return c === null
      ? "> **Bordure** : désactivée — cartes sans couleur (par défaut)."
      : `> **Bordure** : activée — \`#${c.toString(16).padStart(6, "0")}\``;
  }

  if (section === "texts") {
    if (!state.textsCategorie) return "> Choisis une catégorie ci-dessous, puis le texte à voir/modifier.";
    if (!state.textsSelected) return `> **${state.textsCategorie}** — choisis un texte ci-dessous.`;
    return `> **${textLabelFor(state.textsCategorie, state.textsSelected)}** :\n${textValueFor(guildId, state.textsCategorie, state.textsSelected)}`;
  }

  if (section === "sys") {
    const owners = accessStore.ownerIds();
    const sys = accessStore.list("sys");
    return [
      `> **Propriétaire(s)** : ${owners.length ? owners.map((id) => `<@${id}>`).join(", ") : "*aucun configuré*"}`,
      `> **Rang sys** : ${sys.length ? sys.map((id) => `<@${id}>`).join(", ") : "*personne*"}`,
    ].join("\n");
  }

  return "";
}

function buildPanel(guild, current = "home", member, state = {}) {
  const isOwner = accessStore.isOwner(member.id);
  const available = sectionsFor(member, isOwner);
  const meta = available.find((s) => s.key === current) || available[0];

  const container = applyAccent(new ContainerBuilder(), guild.id);
  const entete = [`## ${titreDe(guild.id, "panel")}`, `> <@${member.id}> · Préfixe : \`${getPrefix(guild.id)}\``];
  if (meta.key !== "home") entete.push(`### ${meta.label}`);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(entete.join("\n")));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(sectionBody(meta.key, guild, member, state)));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addActionRowComponents(new ActionRowBuilder().addComponents(buildNav(meta.key, member, isOwner)));

  if (meta.key === "prefix") {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${ID}:prefixbtn`).setLabel("Changer le préfixe").setStyle(ButtonStyle.Secondary)
      )
    );
  } else if (meta.key === "profile") {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${ID}:renamebtn`).setLabel("Renommer le bot").setStyle(ButtonStyle.Secondary)
      )
    );
  } else if (meta.key === "logs") {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder().setCustomId(`${ID}:logschannel`).setPlaceholder("Choisir le salon de logs de modération")
      )
    );
    const channelId = modLogStore.getLogChannelId(guild.id);
    if (channelId) {
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`${ID}:logsclear`).setLabel("Désactiver les logs").setStyle(ButtonStyle.Danger)
        )
      );
    }
  } else if (meta.key === "permissions") {
    const roleChoisi = state.permissionsRoleId && guild.roles.cache.has(state.permissionsRoleId);
    if (!roleChoisi) {
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new RoleSelectMenuBuilder().setCustomId(`${ID}:permrole`).setPlaceholder("Choisir un rôle à configurer")
        )
      );
    } else {
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`${ID}:permrolereset`).setLabel("Choisir un autre rôle").setStyle(ButtonStyle.Secondary)
        )
      );
      const granted = permStore.getRoleGrants(guild.id, state.permissionsRoleId);
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`${ID}:permtoggle:${state.permissionsRoleId}`)
            .setPlaceholder("Basculer une permission")
            .addOptions(
              permCatalog.CATALOG.filter((p) => permCatalog.isRoleGrantable(p.key)).map((p) =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(p.key)
                  .setEmoji(granted.includes(p.key) ? iconDe(guild.id, "SUCCESS") : iconDe(guild.id, "ERROR"))
                  .setDescription(p.label.slice(0, 100))
                  .setValue(p.key)
              )
            )
        )
      );
    }
  } else if (meta.key === "commands") {
    const noms = ALL_COMMAND_NAMES();
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${ID}:cmdselect`)
          .setPlaceholder("Choisir une commande")
          .addOptions(noms.slice(0, 25).map((n) => new StringSelectMenuOptionBuilder().setLabel(n).setValue(n).setDefault(n === state.commandsSelected)))
      )
    );
    const cmdName = state.commandsSelected;
    if (cmdName) {
      const enabled = commandsStore.isEnabledForGuild(cmdName, guild.id);
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`${ID}:cmdtoggle:${cmdName}`).setLabel(enabled ? "Désactiver" : "Activer").setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`${ID}:cmdreset:${cmdName}`).setLabel("Réinitialiser").setStyle(ButtonStyle.Secondary)
        )
      );
      const ASPECTS = [
        { key: "allowRole", label: "Rôles autorisés" },
        { key: "denyRole", label: "Rôles interdits" },
        { key: "allowUser", label: "Membres autorisés" },
        { key: "denyUser", label: "Membres interdits" },
        { key: "allowChannel", label: "Salons autorisés" },
        { key: "denyChannel", label: "Salons interdits" },
      ];
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`${ID}:cmdaspect:${cmdName}`)
            .setPlaceholder("Choisir ce qu'on modifie")
            .addOptions(ASPECTS.map((a) => new StringSelectMenuOptionBuilder().setLabel(a.label).setValue(a.key).setDefault(a.key === state.commandsAspect)))
        )
      );
      const aspect = state.commandsAspect;
      if (aspect === "allowRole") {
        container.addActionRowComponents(new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(`${ID}:cmdallowrole:${cmdName}`).setPlaceholder("Ajouter/retirer un rôle autorisé")));
      } else if (aspect === "denyRole") {
        container.addActionRowComponents(new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId(`${ID}:cmddenyrole:${cmdName}`).setPlaceholder("Ajouter/retirer un rôle interdit")));
      } else if (aspect === "allowUser") {
        container.addActionRowComponents(new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`${ID}:cmdallowuser:${cmdName}`).setPlaceholder("Ajouter/retirer un membre autorisé")));
      } else if (aspect === "denyUser") {
        container.addActionRowComponents(new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`${ID}:cmddenyuser:${cmdName}`).setPlaceholder("Ajouter/retirer un membre interdit")));
      } else if (aspect === "allowChannel") {
        container.addActionRowComponents(new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId(`${ID}:cmdallowchannel:${cmdName}`).setPlaceholder("Ajouter/retirer un salon autorisé")));
      } else if (aspect === "denyChannel") {
        container.addActionRowComponents(new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId(`${ID}:cmddenychannel:${cmdName}`).setPlaceholder("Ajouter/retirer un salon interdit")));
      }
    }
  } else if (meta.key === "appearance") {
    const bordureActive = accentColor(guild.id) !== null;
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${ID}:colorbtn`)
          .setLabel(bordureActive ? "Changer la couleur" : "Activer une bordure colorée")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`${ID}:colorreset`)
          .setLabel("Désactiver la bordure")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(!bordureActive)
      )
    );
  } else if (meta.key === "texts") {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${ID}:textcat`)
          .setPlaceholder("Choisir une catégorie")
          .addOptions(
            TEXT_CATEGORIES.map((cat) => new StringSelectMenuOptionBuilder().setLabel(cat).setValue(cat).setDefault(cat === state.textsCategorie))
          )
      )
    );
    if (state.textsCategorie) {
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`${ID}:textselect:${state.textsCategorie}`)
            .setPlaceholder("Choisir un texte")
            .addOptions(
              textItemsFor(state.textsCategorie)
                .slice(0, 25)
                .map((i) => {
                  const apercu = textValueFor(guild.id, state.textsCategorie, i.key);
                  return new StringSelectMenuOptionBuilder()
                    .setLabel(i.label.slice(0, 100))
                    .setDescription(`${i.commande} — ${apercu}`.slice(0, 100))
                    .setValue(i.key)
                    .setDefault(i.key === state.textsSelected);
                })
            )
        )
      );
    }
    if (state.textsCategorie && state.textsSelected) {
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`${ID}:textbtn:${state.textsCategorie}:${state.textsSelected}`).setLabel("Modifier").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`${ID}:textreset:${state.textsCategorie}:${state.textsSelected}`).setLabel("Réinitialiser").setStyle(ButtonStyle.Secondary)
        )
      );
    }
  } else if (meta.key === "sys") {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`${ID}:sysadd`).setPlaceholder("Ajouter au rang sys"))
    );
    const sys = accessStore.list("sys");
    if (sys.length) {
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`${ID}:sysdel`)
            .setPlaceholder("Retirer du rang sys")
            .addOptions(sys.slice(0, 25).map((id) => new StringSelectMenuOptionBuilder().setLabel(id).setValue(id)))
        )
      );
    }
  }

  return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

/** "panel" — ouvre le centre de configuration, réservé à qui a au moins un droit dessus. */
async function config(client, message) {
  if (!hasAnyPanelAccess(message.member)) return;
  return messageOwner.repondreEtRetenir(message, buildPanel(message.guild, "home", message.member, {}));
}

async function handleConfigInteraction(interaction) {
  const [, action, extra] = interaction.customId.split(":");
  const member = interaction.member;
  if (!hasAnyPanelAccess(member)) {
    return interaction.reply({ content: "Tu n'as pas accès à ce panneau.", flags: MessageFlags.Ephemeral });
  }

  const guild = interaction.guild;
  const goto = (section, state) => interaction.update(buildPanel(guild, section, member, state));
  const denied = () => interaction.reply({ content: "Permission manquante.", flags: MessageFlags.Ephemeral });

  if (action === "nav") return goto(interaction.values[0], {});

  if (action === "prefixbtn") {
    if (!can(member, "sys")) return interaction.reply({ content: "Réservé au rang sys.", flags: MessageFlags.Ephemeral });
    if (interaction.isModalSubmit()) {
      const nouveau = interaction.fields.getTextInputValue("value").trim();
      if (!nouveau || /\s/.test(nouveau)) return interaction.reply({ content: "Préfixe invalide.", flags: MessageFlags.Ephemeral });
      setPrefix(guild.id, nouveau);
      return interaction.reply({ content: `Préfixe changé pour \`${nouveau}\`.`, flags: MessageFlags.Ephemeral });
    }
    const modal = new ModalBuilder()
      .setCustomId(`${ID}:prefixbtn`)
      .setTitle("Changer le préfixe")
      .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("value").setLabel("Nouveau préfixe (3 caractères max)").setStyle(TextInputStyle.Short).setMaxLength(3).setRequired(true)));
    return interaction.showModal(modal);
  }

  if (action === "renamebtn") {
    if (!can(member, "sys")) return interaction.reply({ content: "Réservé au rang sys.", flags: MessageFlags.Ephemeral });
    if (interaction.isModalSubmit()) {
      const nouveau = interaction.fields.getTextInputValue("value").trim();
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ChangeNickname)) {
        return interaction.reply({ content: "Il me manque la permission Changer de pseudo.", flags: MessageFlags.Ephemeral });
      }
      try {
        await guild.members.me.setNickname(nouveau);
      } catch (err) {
        return interaction.reply({ content: `Discord a refusé : ${err.message}`, flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ content: `Renommé en **${nouveau}** sur ce serveur.`, flags: MessageFlags.Ephemeral });
    }
    const modal = new ModalBuilder()
      .setCustomId(`${ID}:renamebtn`)
      .setTitle("Renommer le bot")
      .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("value").setLabel("Nouveau pseudo (32 caractères max)").setStyle(TextInputStyle.Short).setMaxLength(32).setRequired(true)));
    return interaction.showModal(modal);
  }

  if (action === "logschannel") {
    if (!can(member, "logs.manage")) return denied();
    modLogStore.setLogChannelId(guild.id, interaction.values[0]);
    return goto("logs", {});
  }

  if (action === "logsclear") {
    if (!can(member, "logs.manage")) return denied();
    modLogStore.setLogChannelId(guild.id, null);
    return goto("logs", {});
  }

  if (action === "permrole") {
    if (!can(member, "panel.permissions.manage")) return denied();
    return goto("permissions", { permissionsRoleId: interaction.values[0] });
  }

  if (action === "permrolereset") return goto("permissions", {});

  if (action === "permtoggle") {
    if (!can(member, "panel.permissions.manage")) return denied();
    const roleId = extra;
    const key = interaction.values[0];
    const current = permStore.getRoleGrants(guild.id, roleId);
    const already = current.includes(key);
    permStore.setRoleGrants(guild.id, roleId, already ? current.filter((k) => k !== key) : [...current, key]);
    return goto("permissions", { permissionsRoleId: roleId });
  }

  if (action === "cmdselect") return goto("commands", { commandsSelected: interaction.values[0] });

  if (action === "cmdaspect") return goto("commands", { commandsSelected: extra, commandsAspect: interaction.values[0] });

  if (action === "cmdtoggle") {
    if (!can(member, "panel.permissions.manage")) return denied();
    const enabled = commandsStore.isEnabledForGuild(extra, guild.id);
    commandsStore.setGuildEnabled(guild.id, extra, !enabled);
    return goto("commands", { commandsSelected: extra });
  }

  if (action === "cmdreset") {
    if (!can(member, "panel.permissions.manage")) return denied();
    commandRules.resetRule(guild.id, extra);
    commandsStore.setGuildEnabled(guild.id, extra, true);
    return goto("commands", { commandsSelected: extra });
  }

  if (action === "cmdallowrole") {
    if (!can(member, "panel.permissions.manage")) return denied();
    commandRules.toggleAllowedRole(guild.id, extra, interaction.values[0]);
    return goto("commands", { commandsSelected: extra, commandsAspect: "allowRole" });
  }

  if (action === "cmddenyrole") {
    if (!can(member, "panel.permissions.manage")) return denied();
    commandRules.toggleDeniedRole(guild.id, extra, interaction.values[0]);
    return goto("commands", { commandsSelected: extra, commandsAspect: "denyRole" });
  }

  if (action === "cmdallowuser") {
    if (!can(member, "panel.permissions.manage")) return denied();
    commandRules.toggleAllowedUser(guild.id, extra, interaction.values[0]);
    return goto("commands", { commandsSelected: extra, commandsAspect: "allowUser" });
  }

  if (action === "cmddenyuser") {
    if (!can(member, "panel.permissions.manage")) return denied();
    commandRules.toggleDeniedUser(guild.id, extra, interaction.values[0]);
    return goto("commands", { commandsSelected: extra, commandsAspect: "denyUser" });
  }

  if (action === "cmdallowchannel") {
    if (!can(member, "panel.permissions.manage")) return denied();
    commandRules.toggleAllowedChannel(guild.id, extra, interaction.values[0]);
    return goto("commands", { commandsSelected: extra, commandsAspect: "allowChannel" });
  }

  if (action === "cmddenychannel") {
    if (!can(member, "panel.permissions.manage")) return denied();
    commandRules.toggleDeniedChannel(guild.id, extra, interaction.values[0]);
    return goto("commands", { commandsSelected: extra, commandsAspect: "denyChannel" });
  }

  if (action === "colorbtn") {
    if (!can(member, "sys")) return interaction.reply({ content: "Réservé au rang sys.", flags: MessageFlags.Ephemeral });
    if (interaction.isModalSubmit()) {
      const saisi = interaction.fields.getTextInputValue("value").trim();
      const hex = setAccentColor(guild.id, saisi);
      if (!hex) return interaction.reply({ content: "Couleur invalide — attendu : `#RRGGBB` (ex. `#ff4d4d`).", flags: MessageFlags.Ephemeral });
      return goto("appearance", {});
    }
    const modal = new ModalBuilder()
      .setCustomId(`${ID}:colorbtn`)
      .setTitle("Couleur d'accent")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("value").setLabel("Couleur (#RRGGBB)").setPlaceholder("#5865f2").setStyle(TextInputStyle.Short).setMaxLength(7).setRequired(true)
        )
      );
    return interaction.showModal(modal);
  }

  if (action === "colorreset") {
    if (!can(member, "sys")) return interaction.reply({ content: "Réservé au rang sys.", flags: MessageFlags.Ephemeral });
    resetAccentColor(guild.id);
    return goto("appearance", {});
  }

  if (action === "textcat") {
    return goto("texts", { textsCategorie: interaction.values[0] });
  }

  if (action === "textselect") {
    const categorie = extra;
    return goto("texts", { textsCategorie: categorie, textsSelected: interaction.values[0] });
  }

  if (action === "textbtn") {
    if (!can(member, "sys")) return interaction.reply({ content: "Réservé au rang sys.", flags: MessageFlags.Ephemeral });
    const [categorie, key] = interaction.customId.split(":").slice(2);
    if (interaction.isModalSubmit()) {
      const saisi = interaction.fields.getTextInputValue("value").trim();
      if (!saisi) return interaction.reply({ content: "Texte vide.", flags: MessageFlags.Ephemeral });
      if (saisi.length > 300) return interaction.reply({ content: "300 caractères maximum.", flags: MessageFlags.Ephemeral });
      textSetFor(guild.id, categorie, key, saisi);
      return goto("texts", { textsCategorie: categorie, textsSelected: key });
    }
    const modal = new ModalBuilder()
      .setCustomId(`${ID}:textbtn:${categorie}:${key}`)
      .setTitle(textLabelFor(categorie, key).slice(0, 45) || "Texte")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("value")
            .setLabel("Nouveau texte (300 caractères max)")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(300)
            .setRequired(true)
            .setValue(textValueFor(guild.id, categorie, key).slice(0, 300))
        )
      );
    return interaction.showModal(modal);
  }

  if (action === "textreset") {
    if (!can(member, "sys")) return interaction.reply({ content: "Réservé au rang sys.", flags: MessageFlags.Ephemeral });
    const [categorie, key] = interaction.customId.split(":").slice(2);
    textResetFor(guild.id, categorie, key);
    return goto("texts", { textsCategorie: categorie, textsSelected: key });
  }

  if (action === "sysadd") {
    if (!can(member, "owner")) return interaction.reply({ content: "Réservé au propriétaire du bot.", flags: MessageFlags.Ephemeral });
    accessStore.add("sys", interaction.values[0]);
    return goto("sys", {});
  }

  if (action === "sysdel") {
    if (!can(member, "owner")) return interaction.reply({ content: "Réservé au propriétaire du bot.", flags: MessageFlags.Ephemeral });
    accessStore.remove("sys", interaction.values[0]);
    return goto("sys", {});
  }

  return undefined;
}

module.exports = { config, handleConfigInteraction, CUSTOM_ID: ID };
