const fs = require("fs");
const path = require("path");

// Écriture atomique (fichier temporaire + rename) pour ne jamais laisser un
// JSON à moitié écrit sur le disque en cas de coupure/redémarrage — même
// patron que le bot principal (discord-music-bot/utils/jsonFile.js).

function ecrireJson(chemin, donnees) {
  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  const temporaire = `${chemin}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    fs.writeFileSync(temporaire, JSON.stringify(donnees, null, 2));
    fs.renameSync(temporaire, chemin);
  } catch (err) {
    try {
      fs.unlinkSync(temporaire);
    } catch {
      // déjà absent
    }
    throw err;
  }
}

function preserver(chemin, brut) {
  if (!brut) return null;
  const copie = `${chemin}.corrompu-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  try {
    fs.writeFileSync(copie, brut);
    return copie;
  } catch (err) {
    console.error(`[jsonFile] impossible de conserver ${chemin} : ${err.message}`);
    return null;
  }
}

function lireJson(chemin) {
  const brut = fs.readFileSync(chemin, "utf8");
  try {
    return JSON.parse(brut);
  } catch (err) {
    const copie = preserver(chemin, brut);
    console.error(
      `[jsonFile] ${chemin} est illisible (${err.message}). ` +
        (copie
          ? `Les données d'origine sont conservées dans ${copie} — le bot repart à vide pour ce fichier.`
          : "Les données d'origine n'ont PAS pu être conservées.")
    );
    throw err;
  }
}

module.exports = { lireJson, ecrireJson, preserver };
