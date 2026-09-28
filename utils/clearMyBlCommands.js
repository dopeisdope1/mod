const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");
const { report } = require("./moderation/actions");
const zinkillerStore = require("./zinkillerStore");
const { applyAccent } = require("./customizePanel");

// "ClearMyBL" — commande DM (sans préfixe serveur, tapée directement au bot
// en message privé : "clearmybl") : lève IMMÉDIATEMENT la blacklist de
// l'expéditeur sur tous les serveurs gérés par ce bot où elle s'applique
// (utils/zinkillerStore.js) — auto-service, aucune approbation staff (voir
// référence fournie : "Tes entrées blacklist ont été supprimées").

function carte(guildIdPourAccent, texte) {
  const container = applyAccent(new ContainerBuilder(), guildIdPourAccent);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent("## ClearMyBL"));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(texte));
  return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

/** Déclenchée sur un message privé (DM) dont le contenu est "clearmybl". */
async function demanderClearMyBL(client, message) {
  const userId = message.author.id;
  const guildsConcernes = client.guilds.cache.filter((g) => zinkillerStore.isZinkilled(g.id, userId));

  if (!guildsConcernes.size) {
    return message.reply(carte(null, "Tu n'es dans la liste noire persistante d'aucun serveur géré par ce bot.")).catch(() => {});
  }

  let retirees = 0;
  for (const guild of guildsConcernes.values()) {
    const entry = zinkillerStore.remove(guild.id, userId);
    if (!entry) continue;
    try {
      await guild.bans.remove(userId, "ClearMyBL — levée par l'utilisateur");
    } catch (err) {
      zinkillerStore.add(guild.id, userId, entry);
      continue;
    }
    retirees += 1;

    await report(client, {
      guildId: guild.id,
      title: "Blacklist retirée — ClearMyBL",
      fields: [
        { label: "Cible", value: `<@${userId}> (${userId})` },
        ...(entry.grade ? [{ label: "Grade appliqué", value: entry.grade }] : []),
        { label: "Ban sur ny", value: "levé" },
      ],
      action: "clearmybl",
      targetId: userId,
      targetTag: message.author.tag,
      moderator: client.user,
      channelId: null,
    }).catch(() => {});
  }

  return message
    .reply(carte(null, `Tes entrées blacklist ont été supprimées.\n**Entrées retirées** : ${retirees}`))
    .catch(() => {});
}

module.exports = { demanderClearMyBL };
