# Riassunto Lezioni AI

Sito web: carichi un file audio di una lezione (anche di 1h+) e Gemini AI genera un riassunto per punti pronto per il ripasso.

## 1. Ottieni una API key Gemini (gratuita)

1. Vai su https://aistudio.google.com/apikey
2. Accedi con un account Google e clicca "Create API key"
3. Copia la chiave generata

Nota: questa è diversa dall'abbonamento Gemini Advanced/Plus. È una chiave per sviluppatori, con una fascia gratuita generosa e poi a consumo (pochi centesimi per un'ora di audio).

## 2. Avvio in locale

```
npm install
copy .env.example .env
```

Apri `.env` e incolla la tua chiave in `GEMINI_API_KEY=`. Imposta anche `SITE_PASSWORD` con la password che vuoi usare per proteggere l'accesso al sito (obbligatoria per l'uso online, vedi punto 3).

```
npm start
```

Apri http://localhost:3000, carica un audio e prova.

## 3. Deploy online (Render.com, piano gratuito)

1. Crea un repository su GitHub e caricaci questa cartella (il file `.env` non verrà incluso grazie a `.gitignore` — non condividere mai la tua API key pubblicamente).
2. Vai su https://render.com, crea un account e collega GitHub.
3. "New" → "Web Service" → seleziona il repository.
4. Build Command: `npm install`
5. Start Command: `npm start`
6. In "Environment" aggiungi le variabili `GEMINI_API_KEY` e `SITE_PASSWORD` con i tuoi valori.
7. Deploy. Dopo qualche minuto avrai un URL pubblico (es. `https://tuo-nome.onrender.com`).

Note:
- Nel piano gratuito Render il servizio "si addormenta" dopo ~15 minuti di inattività: la prima richiesta successiva impiega 30-50 secondi in più per "svegliarsi". Per un uso personale va benissimo.
- L'URL non è indicizzato su Google, quindi in pratica ci arriva solo chi ha il link. In più, ogni visitatore deve inserire la password impostata in `SITE_PASSWORD` (il browser mostra un normale popup di accesso: come nome utente lascia vuoto o scrivi qualsiasi cosa, come password metti quella scelta). Condividi link e password solo con chi deve usarlo — chiunque le conosca può generare riassunti a tue spese.
- Puoi cambiare la password quando vuoi modificando `SITE_PASSWORD` su Render (Environment → Save, poi redeploy automatico).

## Formati audio supportati

mp3, wav, m4a, ogg, flac e altri formati audio comuni. Limite di dimensione: 300MB (più che sufficiente per diverse ore di registrazione).
