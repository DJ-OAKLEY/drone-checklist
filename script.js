const tabButtons = document.querySelectorAll(".tab-button");
const tabContents = document.querySelectorAll(".tab-content");
const form = document.getElementById("flightForm");
const historyBody = document.getElementById("flightHistory");
const clearHistoryButton = document.getElementById("clearHistory");
const resetChecklistButton = document.getElementById("resetChecklist");
const exportButton = document.getElementById("exportData");
const successMessage = document.getElementById("successMessage");
const dropboxTokenInput = document.getElementById("dropboxToken");
const saveTokenButton = document.getElementById("saveToken");
const clearTokenButton = document.getElementById("clearToken");
const loadingMessage = document.getElementById("loadingMessage");
const tableContainer = document.getElementById("tableContainer");

const STORAGE_FLIGHTS = "droneFlights";
const STORAGE_CHECKLIST = "droneChecklist";
const STORAGE_TOKEN = "dropboxToken";

let flights = JSON.parse(localStorage.getItem(STORAGE_FLIGHTS)) || [];

/* GESTION DES ONGLETS */
tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.tab;
    tabButtons.forEach(btn => btn.classList.remove("active"));
    tabContents.forEach(content => content.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(targetId).classList.add("active");
    if (targetId === "flightsTab") chargerVols();
  });
});

/* GESTION CHECKLIST */
document.querySelectorAll("[data-action]").forEach(button => {
  button.addEventListener("click", () => {
    const cardIndex = button.dataset.card;
    const checklists = document.querySelectorAll(`.checklist[data-card="${cardIndex}"]`);
    const checked = button.dataset.action === "select";
    checklists.forEach(checklist => {
      checklist.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.checked = checked;
      });
    });
    sauvegarderChecklist();
  });
});

resetChecklistButton.addEventListener("click", () => {
  if (confirm("Décocher toutes les cases ?")) {
    document.querySelectorAll('.checklist input[type="checkbox"]').forEach(input => {
      input.checked = false;
    });
    sauvegarderChecklist();
    afficherSucces("Checklist réinitialisée.");
  }
});

const checklistInputs = document.querySelectorAll('.checklist input[type="checkbox"]');

function sauvegarderChecklist() {
  const etat = {};
  checklistInputs.forEach(input => { etat[input.id] = input.checked; });
  localStorage.setItem(STORAGE_CHECKLIST, JSON.stringify(etat));
}

function chargerChecklist() {
  const etat = JSON.parse(localStorage.getItem(STORAGE_CHECKLIST)) || {};
  checklistInputs.forEach(input => { input.checked = etat[input.id] || false; });
}

checklistInputs.forEach(input => input.addEventListener("change", sauvegarderChecklist));

/* GESTION TOKEN DROPBOX */
function chargerToken() {
  const token = localStorage.getItem(STORAGE_TOKEN);
  if (token) dropboxTokenInput.value = token;
}

saveTokenButton.addEventListener("click", () => {
  const token = dropboxTokenInput.value.trim();
  if (!token) {
    alert("Veuillez entrer un token Dropbox.");
    return;
  }
  localStorage.setItem(STORAGE_TOKEN, token);
  afficherSucces("Token Dropbox enregistré !");
});

clearTokenButton.addEventListener("click", () => {
  if (confirm("Êtes-vous sûr de vouloir effacer le token ?")) {
    localStorage.removeItem(STORAGE_TOKEN);
    dropboxTokenInput.value = "";
    afficherSucces("Token effacé.");
  }
});

function obtenirToken() {
  return localStorage.getItem(STORAGE_TOKEN);
}

/* MESSAGES */
function afficherSucces(message) {
  successMessage.textContent = "✓ " + message;
  successMessage.classList.add("show");
  setTimeout(() => successMessage.classList.remove("show"), 3000);
}

function securiserTexte(texte) {
  return String(texte)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* API DROPBOX */
async function appelDropbox(methode, chemin, contenu = null) {
  const token = obtenirToken();
  if (!token) {
    throw new Error("Token Dropbox non configuré. Allez dans l'onglet Historique et configurez votre token.");
  }

  if (methode === "POST" && contenu) {
    const response = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify({
          path: chemin,
          mode: { ".tag": "overwrite" },
          autorename: false,
          mute: false,
          strict_conflict: false
        }),
        "Content-Type": "application/octet-stream"
      },
      body: contenu
    });
    if (!response.ok) throw new Error(`Erreur Dropbox: ${response.status}`);
    return response.json();
  }

  if (methode === "GET") {
    const response = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify({ path: chemin })
      }
    });
    if (response.status === 409) return null;
    if (!response.ok) throw new Error(`Erreur Dropbox: ${response.status}`);
    return JSON.parse(await response.text());
  }
}

/* GESTION VOLS */
async function chargerVols() {
  loadingMessage.style.display = "block";
  tableContainer.style.display = "none";
  try {
    if (!obtenirToken()) {
      historyBody.innerHTML = '<tr><td colspan="9" class="empty-message">⚠️ Configurez d\'abord votre token Dropbox en haut de cette page.</td></tr>';
      return;
    }
    flights = await appelDropbox("GET", "/drone/historique-vols.json") || [];
    afficherVols();
  } catch (erreur) {
    console.error(erreur);
    historyBody.innerHTML = `<tr><td colspan="9" class="empty-message">❌ Erreur : ${securiserTexte(erreur.message)}</td></tr>`;
  } finally {
    loadingMessage.style.display = "none";
    tableContainer.style.display = "block";
  }
}

function afficherVols() {
  historyBody.innerHTML = "";
  if (flights.length === 0) {
    historyBody.innerHTML = '<tr><td colspan="9" class="empty-message">Aucun vol enregistré.</td></tr>';
    return;
  }
  flights.forEach((vol, index) => {
    const droneName = `${securiserTexte(vol.droneBrand || "-")} ${securiserTexte(vol.droneModel || "-")}`.trim();
    const droneSerial = securiserTexte(vol.droneSerial || "-");
    const ligne = document.createElement("tr");
    ligne.innerHTML = `
      <td><strong>${droneName}</strong></td>
      <td><code>${droneSerial}</code></td>
      <td>${securiserTexte(vol.lieu)}</td>
      <td>${securiserTexte(vol.date)}</td>
      <td>${securiserTexte(vol.heureDebut)}</td>
      <td>${securiserTexte(vol.heureFin)}</td>
      <td>${securiserTexte(vol.designation)}</td>
      <td>${securiserTexte(vol.commentaires || "-")}</td>
      <td><button type="button" class="danger" data-delete="${index}" style="padding:.4rem .7rem;font-size:.85rem">Supprimer</button></td>`;
    historyBody.appendChild(ligne);
  });
  historyBody.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", () => supprimerVol(Number(button.dataset.delete)));
  });
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const heureDebut = document.getElementById("startTime").value;
  const heureFin = document.getElementById("endTime").value;
  if (heureFin < heureDebut) {
    alert("L'heure de fin doit être postérieure à l'heure de début.");
    return;
  }
  const vol = {
    droneBrand: document.getElementById("droneBrand").value.trim(),
    droneModel: document.getElementById("droneModel").value.trim(),
    droneSerial: document.getElementById("droneSerial").value.trim(),
    lieu: document.getElementById("location").value.trim(),
    date: document.getElementById("date").value,
    heureDebut,
    heureFin,
    designation: document.getElementById("designation").value.trim(),
    commentaires: document.getElementById("comments").value.trim()
  };
  flights.push(vol);
  try {
    await appelDropbox("POST", "/drone/historique-vols.json", JSON.stringify(flights, null, 2));
    form.reset();
    afficherSucces("Vol enregistré dans Dropbox ✓");
    afficherVols();
  } catch (erreur) {
    console.error(erreur);
    flights.pop();
    alert("Erreur : " + erreur.message);
  }
});

async function supprimerVol(index) {
  if (!confirm("Supprimer ce vol ?")) return;
  const volsAvantSuppression = [...flights];
  flights.splice(index, 1);
  try {
    await appelDropbox("POST", "/drone/historique-vols.json", JSON.stringify(flights, null, 2));
    afficherSucces("Vol supprimé.");
    afficherVols();
  } catch (erreur) {
    console.error(erreur);
    flights = volsAvantSuppression;
    alert("Erreur : " + erreur.message);
  }
}

clearHistoryButton.addEventListener("click", async () => {
  if (flights.length === 0) return;
  if (!confirm("Êtes-vous sûr ? Cette action est irréversible.")) return;
  const volsAvantEffacement = flights;
  flights = [];
  try {
    await appelDropbox("POST", "/drone/historique-vols.json", JSON.stringify([], null, 2));
    afficherSucces("Historique effacé.");
    afficherVols();
  } catch (erreur) {
    console.error(erreur);
    flights = volsAvantEffacement;
    alert("Erreur : " + erreur.message);
  }
});

exportButton.addEventListener("click", () => {
  const donnees = { vols: flights, dateExport: new Date().toLocaleString("fr-FR") };
  const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `historique-vols-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  afficherSucces("Données téléchargées !");
});

/* INITIALISATION */
chargerToken();
chargerChecklist();
