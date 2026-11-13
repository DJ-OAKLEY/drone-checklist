const express = require("express");
const { Dropbox } = require("dropbox");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const dbx = new Dropbox({
  auth: process.env.DROPBOX_TOKEN
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const CHEMIN_FICHIER = "/drone/historique-vols.json";

/*
 * Récupérer l'historique
 */
app.get("/api/vols", async (req, res) => {
  try {
    const response = await dbx.filesDownload({
      path: CHEMIN_FICHIER
    });

    const contenu = response.result.fileBinary.toString("utf8");
    const vols = JSON.parse(contenu);

    res.json(vols);
  } catch (erreur) {
    if (erreur.status === 409) {
      res.json([]);
    } else {
      console.error("Erreur Dropbox :", erreur.message);
      res.status(500).json({
        erreur: "Impossible de récupérer les vols"
      });
    }
  }
});

/*
 * Ajouter un vol
 */
app.post("/api/vols", async (req, res) => {
  try {
    let vols = [];

    try {
      const response = await dbx.filesDownload({
        path: CHEMIN_FICHIER
      });

      const contenu = response.result.fileBinary.toString("utf8");
      vols = JSON.parse(contenu);
    } catch (erreur) {
      if (erreur.status !== 409) {
        throw erreur;
      }
    }

    const nouveauVol = {
      id: Date.now(),
      lieu: req.body.lieu || "",
      date: req.body.date || "",
      heureDebut: req.body.heureDebut || "",
      heureFin: req.body.heureFin || "",
      designation: req.body.designation || "",
      commentaires: req.body.commentaires || ""
    };

    vols.push(nouveauVol);

    await dbx.filesUpload({
      path: CHEMIN_FICHIER,
      contents: JSON.stringify(vols, null, 2),
      mode: {
        ".tag": "overwrite"
      }
    });

    res.status(201).json(nouveauVol);
  } catch (erreur) {
    console.error("Erreur Dropbox :", erreur.message);
    res.status(500).json({
      erreur: "Impossible d'enregistrer le vol"
    });
  }
});

/*
 * Supprimer un vol
 */
app.delete("/api/vols/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const response = await dbx.filesDownload({
      path: CHEMIN_FICHIER
    });

    const contenu = response.result.fileBinary.toString("utf8");
    let vols = JSON.parse(contenu);

    vols = vols.filter(vol => vol.id !== id);

    await dbx.filesUpload({
      path: CHEMIN_FICHIER,
      contents: JSON.stringify(vols, null, 2),
      mode: {
        ".tag": "overwrite"
      }
    });

    res.json({
      message: "Vol supprimé"
    });
  } catch (erreur) {
    console.error("Erreur Dropbox :", erreur.message);
    res.status(500).json({
      erreur: "Impossible de supprimer le vol"
    });
  }
});

/*
 * Effacer tout l'historique
 */
app.delete("/api/vols", async (req, res) => {
  try {
    await dbx.filesUpload({
      path: CHEMIN_FICHIER,
      contents: JSON.stringify([], null, 2),
      mode: {
        ".tag": "overwrite"
      }
    });

    res.json({
      message: "Historique effacé"
    });
  } catch (erreur) {
    console.error("Erreur Dropbox :", erreur.message);
    res.status(500).json({
      erreur: "Impossible d'effacer l'historique"
    });
  }
});

app.listen(PORT, () => {
  console.log(`✓ Application disponible sur http://localhost:${PORT}`);
  console.log(`✓ Fichier Dropbox utilisé : ${CHEMIN_FICHIER}`);
});
