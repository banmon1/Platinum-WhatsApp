# Platinum WhatsApp

A universal Expo application with a persistent Node.js service for WhatsApp QR pairing, paced outbound campaigns, and optional OpenAI customer replies.

## Project map

```text
Platinum WhatsApp/
├─ apps/
│  ├─ client/                 Expo + React Native Web interface
│  │  ├─ app/                File-based screens and web routes
│  │  ├─ src/components/     Shared universal UI
│  │  ├─ src/context/        Live API state and polling
│  │  └─ assets/             App icon and platform assets
│  ├─ server/                 Node.js + TypeScript service
│  │  ├─ src/app.ts           Reusable API and internal server startup
│  │  ├─ src/index.ts         Standalone development entry point
│  │  ├─ src/whatsapp.ts      Baileys QR session and messaging
│  │  ├─ src/campaign-worker.ts Durable 10-minute queue
│  │  ├─ src/ai.ts            OpenAI response pipeline
│  │  ├─ src/database.ts      SQLite schema and persistence
│  │  └─ data/                Local runtime data, ignored by Git
│  └─ desktop/                Electron Windows application
│     ├─ src/main.mjs         Internal server + custom desktop window
│     ├─ src/preload.cjs      Safe custom-window controls
│     ├─ assets/              Transparent icon, ICO, and splash
│     └─ scripts/             Windows packaging preparation
├─ .env.example
└─ package.json               All workspace commands
```

## Application routes

- `/connect` — generate/scan QR, view session status, disconnect safely.
- `/campaign` — enter opted-in numbers and one message, Run/Stop/Resume.
- `/ai` — save the API key, model, prompt, and enable automatic replies.
- `/activity` — inspect campaign, delivery, incoming-message, and AI events.

The Windows build has no server-address screen. It starts a private loopback service automatically on a free internal port and opens the interface against that port.

## Windows installer

The ready installer is generated at `apps/desktop/release/Platinum-WhatsApp-Setup-1.0.1.exe`.

```powershell
npm run build:windows
```

The installer creates the Start menu and desktop shortcuts. The installed application uses the custom rounded icon, shows the pulsing acid-yellow splash, and uses the in-app minimize, maximize, and close buttons. Persistent WhatsApp credentials, the encrypted OpenAI key, campaigns, and activity are stored under the current Windows user's application-data folder.

## Start locally

Requirements: Node.js 24 or newer and npm.

```powershell
npm install
npm run dev
```

This development command exposes the API on `http://localhost:8787`; that address is only for developers. End users of the Windows installer never enter or see it.

## First use

1. Open Connect and generate the QR.
2. In WhatsApp on the dedicated business phone, open **Settings → Linked Devices → Link a Device** and scan it.
3. Open Campaign, add only customers who opted in, write the message, confirm permission, and Run.
4. Open AI Replies, enter an OpenAI API key and a detailed prompt, then enable and save.

The API key is encrypted before it reaches SQLite and is never returned to the client. If `APP_SECRET` is not set, the server generates `apps/server/data/nabilo-secret.key`; back up this file together with the database.

## Verification and builds

```powershell
npm run check
npm run build:windows
npm run android -w @platinum/client
npm run ios -w @platinum/client
```

`npm run check` type-checks both apps, runs server tests, compiles the backend, and exports every web route. iOS native compilation requires macOS or EAS Build. `apps/client/eas.json` contains development, preview, and production profiles.

## Operating notes

- The first campaign message sends immediately; every later attempt is scheduled ten minutes after the previous attempt.
- Campaign and recipient state is stored in SQLite, so a running campaign continues after a server restart.
- Groups, broadcasts, status messages, and messages sent by the linked account are excluded from AI replies.
- On Windows, the backend starts and closes with the desktop application automatically.
- Future Android/iOS builds can reuse the Expo interface, but the persistent Baileys service must remain on an always-on backend that those mobile builds can reach.
- QR/Baileys is an unofficial WhatsApp Web integration. Use a dedicated number, honor opt-out requests, and message only recipients who gave permission.
