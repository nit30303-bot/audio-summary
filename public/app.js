const loginScreen = document.getElementById("login-screen");
const appEl = document.getElementById("app");
const loginPassword = document.getElementById("login-password");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");

function showApp() {
  loginScreen.hidden = true;
  appEl.hidden = false;
}

function showLogin() {
  appEl.hidden = true;
  loginScreen.hidden = false;
  loginPassword.focus();
}

async function checkSession() {
  try {
    const res = await fetch("/api/session");
    const data = await res.json();
    data.authenticated ? showApp() : showLogin();
  } catch {
    showLogin();
  }
}

async function doLogin() {
  loginError.hidden = true;
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: loginPassword.value }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      loginPassword.value = "";
      showApp();
    } else {
      loginError.textContent = data.error || "Password errata.";
      loginError.hidden = false;
    }
  } catch {
    loginError.textContent = "Errore di connessione. Riprova.";
    loginError.hidden = false;
  }
}

loginBtn.addEventListener("click", doLogin);
loginPassword.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});

checkSession();

const dropArea = document.getElementById("drop-area");
const fileInput = document.getElementById("file-input");
const browseBtn = document.getElementById("browse-btn");
const fileNameEl = document.getElementById("file-name");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");
const resultSection = document.getElementById("result-section");
const resultEl = document.getElementById("result");
const copyBtn = document.getElementById("copy-btn");
const downloadBtn = document.getElementById("download-btn");

let selectedFile = null;

browseBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

["dragenter", "dragover"].forEach((evt) => {
  dropArea.addEventListener(evt, (e) => {
    e.preventDefault();
    dropArea.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((evt) => {
  dropArea.addEventListener(evt, (e) => {
    e.preventDefault();
    dropArea.classList.remove("dragover");
  });
});

dropArea.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});

function setFile(file) {
  if (!file.type.startsWith("audio/")) {
    showStatus("Il file selezionato non è un audio.", "error");
    return;
  }
  selectedFile = file;
  fileNameEl.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
  submitBtn.disabled = false;
  hideStatus();
  resultSection.hidden = true;
}

submitBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  submitBtn.disabled = true;
  resultSection.hidden = true;
  showStatus(
    '<span class="spinner"></span>Elaborazione in corso… per audio lunghi (1h+) può richiedere qualche minuto, non chiudere la pagina.',
    "loading"
  );

  const formData = new FormData();
  formData.append("audio", selectedFile);

  try {
    const res = await fetch("/api/summarize", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (res.status === 401) {
      hideStatus();
      showLogin();
      return;
    }
    if (!res.ok) {
      throw new Error(data.error || "Errore sconosciuto durante l'elaborazione.");
    }

    hideStatus();
    resultEl.textContent = data.summary;
    resultSection.hidden = false;
  } catch (err) {
    showStatus(err.message, "error");
  } finally {
    submitBtn.disabled = false;
  }
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(resultEl.textContent);
    const original = copyBtn.textContent;
    copyBtn.textContent = "✅ Copiato!";
    setTimeout(() => (copyBtn.textContent = original), 1500);
  } catch {
    showStatus("Impossibile copiare automaticamente: seleziona e copia il testo manualmente.", "error");
  }
});

downloadBtn.addEventListener("click", () => {
  const blob = new Blob([resultEl.textContent], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "riassunto-lezione.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

function showStatus(html, type) {
  statusEl.innerHTML = html;
  statusEl.className = `status ${type}`;
  statusEl.hidden = false;
}

function hideStatus() {
  statusEl.hidden = true;
}
