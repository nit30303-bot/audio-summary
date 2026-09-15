import express from "express";
import multer from "multer";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MAX_FILE_SIZE = 300 * 1024 * 1024; // 300MB, sufficiente per audio di 1h+
const SITE_PASSWORD = process.env.SITE_PASSWORD;

if (!process.env.GEMINI_API_KEY) {
  console.warn(
    "ATTENZIONE: variabile GEMINI_API_KEY non impostata. Imposta il file .env prima di usare il sito."
  );
}
if (!SITE_PASSWORD) {
  console.warn(
    "ATTENZIONE: SITE_PASSWORD non impostata. Il sito sarà accessibile a chiunque abbia il link, senza password."
  );
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function safeCompare(a, b) {
  const bufA = Buffer.from(a || "", "utf8");
  const bufB = Buffer.from(b || "", "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const SESSION_COOKIE = "session_token";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 giorni
const validSessions = new Set();

function isValidSession(req) {
  if (!SITE_PASSWORD) return true;
  const token = req.cookies?.[SESSION_COOKIE];
  return Boolean(token && validSessions.has(token));
}

function requireSession(req, res, next) {
  if (isValidSession(req)) return next();
  res.status(401).json({ error: "Accesso richiesto: effettua di nuovo l'accesso." });
}

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Formato non supportato: carica un file audio (mp3, wav, m4a, ogg, flac...)."));
    }
  },
});

const app = express();
app.set("trust proxy", 1);
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/login", express.json(), (req, res) => {
  const password = req.body?.password;
  if (!SITE_PASSWORD || safeCompare(password, SITE_PASSWORD)) {
    const token = crypto.randomBytes(32).toString("hex");
    validSessions.add(token);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.secure,
      maxAge: SESSION_MAX_AGE,
    });
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Password errata." });
});

app.get("/api/session", (req, res) => {
  res.json({ authenticated: isValidSession(req) });
});

const PROMPT = `Sei un assistente che aiuta uno studente a ripassare per un esame.
Ascolta attentamente questo audio di una lezione e produci un riassunto in ITALIANO, ben organizzato, con questa struttura:

1. **Titolo/argomento generale** della lezione.
2. **Riassunto per punti**, suddiviso per argomenti/sezioni nell'ordine in cui vengono trattati, con i concetti principali spiegati in modo chiaro e sintetico.
3. **Termini e definizioni chiave** evidenziati in grassetto.
4. Eventuali **date, formule, nomi o numeri importanti** menzionati.
5. Una breve sezione finale con 3-5 **domande di autoverifica** per ripassare.

Usa elenchi puntati, sii chiaro e completo ma evita ripetizioni inutili. Se l'audio contiene parti poco comprensibili, ignorale senza inventare contenuti.`;

app.post("/api/summarize", requireSession, (req, res) => {
  upload.single("audio")(req, res, async (err) => {
    if (err) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "File troppo grande (limite 300MB)."
          : err.message || "Errore nel caricamento del file.";
      return res.status(400).json({ error: message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Nessun file audio ricevuto." });
    }
    if (!process.env.GEMINI_API_KEY) {
      await safeUnlink(req.file.path);
      return res.status(500).json({ error: "Chiave API Gemini non configurata sul server." });
    }

    let uploadedFile;
    try {
      uploadedFile = await ai.files.upload({
        file: req.file.path,
        config: { mimeType: req.file.mimetype },
      });

      let fileInfo = uploadedFile;
      while (fileInfo.state === "PROCESSING") {
        await new Promise((r) => setTimeout(r, 3000));
        fileInfo = await ai.files.get({ name: uploadedFile.name });
      }
      if (fileInfo.state !== "ACTIVE") {
        throw new Error("Il file audio non è stato elaborato correttamente da Gemini.");
      }

      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: PROMPT },
              { fileData: { fileUri: fileInfo.uri, mimeType: fileInfo.mimeType } },
            ],
          },
        ],
      });

      res.json({ summary: response.text });
      ai.files.delete({ name: fileInfo.name }).catch(() => {});
    } catch (e) {
      console.error(e);
      res.status(500).json({
        error: "Errore durante l'elaborazione dell'audio: " + (e.message || String(e)),
      });
      if (uploadedFile?.name) {
        ai.files.delete({ name: uploadedFile.name }).catch(() => {});
      }
    } finally {
      await safeUnlink(req.file.path);
    }
  });
});

async function safeUnlink(p) {
  try {
    await fs.unlink(p);
  } catch {
    // file già rimosso o inesistente, nessun problema
  }
}

app.listen(PORT, () => {
  console.log(`Server avviato su http://localhost:${PORT}`);
});
