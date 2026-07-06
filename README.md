# Smart Productivity Assistant v9

> AI-powered Chrome extension for Salesforce developers — Chat, Monday.com tasks, SOQL queries, and GitHub operations without leaving your browser.

---

## ✨ What's New in v9

| Feature | Details |
|---|---|
| 🎨 **Dark / Light theme** | Toggle in ⚙️ Setup → Config. Live preview on switch. |
| 🎤 **Voice input (Mic)** | Click the 🎤 button in Chat to dictate your message. |
| 🔒 **SF Toggle** | Header SF toggle replaces the old chat consent dialog. |
| 📋 **Logs moved** | Logs are now inside ⚙️ Setup → Logs inner tab. |
| 👤 **Owner Key** | Your Monday user ID is now configurable in Setup → Config. |
| 💅 **Redesigned UI** | Slimmer 370px panel, gradient tabs, animated background, smooth transitions. |
| 🗂 **Modular CSS** | All styles extracted into `css/` — one file per tab. |

---

## 📁 File Structure

```
smart-assistant-v9/
│
├── manifest.json          ← MV3 manifest (CSS + JS injected via content_scripts)
├── background.js          ← Service worker: cookie-based SF session reader (UNCHANGED)
├── content.js             ← Core logic + UI builder (all business logic intact)
│
├── css/
│   ├── spa-base.css       ← Theme vars (dark/light), panel shell, FAB, tabs, header
│   ├── spa-chat.css       ← Greeting card, messages, quick actions, input row, mic
│   ├── spa-monday.css     ← Monday.com tab: inner tabs, items, filters, stats
│   ├── spa-soql.css       ← SOQL editor, toolbar, date chips, result area
│   ├── spa-git.css        ← Git tab: user card, file list, push section, commits
│   └── spa-settings.css   ← Config/Logs inner tabs, form elements, theme toggle
│
├── js/
│   └── spa-speech.js      ← Web Speech API wrapper (exposes window.__SPA_SPEECH)
│
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🚀 Quick Setup

### 1. Install the Extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `smart-assistant-v9/` folder
4. Navigate to any Salesforce URL — the **✦** FAB appears bottom-right

### 2. Configure API Keys (⚙️ Setup → Config)

| Field | Where to get it |
|---|---|
| **Groq API Key** | [console.groq.com](https://console.groq.com) — free tier, Llama 3.3 70B |
| **Monday Owner Key** | Monday.com → Avatar → Developers → **My User ID** |
| **Monday API Token** | Monday.com → Avatar → Developers → **My Access Tokens** |
| **GitHub Token** | GitHub → Settings → Developer settings → Personal access tokens |
| **GitHub Repo** | Format: `owner/repo-name` |

Click **💾 Save All**, then **🔌 Test** to verify each connection.

---

## 🗣 Features

### 💬 Chat Tab
- Ask anything — AI-powered by Groq (Llama 3.3 70B)
- Auto-detects Monday.com intent: *"what are my tasks today"*, *"create task Fix login bug"*
- If SF toggle is ON, automatically executes SOQL and interprets results
- **Mic button** (🎤): click to speak, transcript appears in input field

### 📋 Monday Tab
- **Two inner tabs**: KMTSL Tasks | KMTSL Bugs Queue
- Filter by date (Today / Yesterday / This Week / Last Week / All)
- Filter by owner (defaults to you — set your Owner Key in Setup)
- Edit item status inline with ✏️
- Create new tasks with the **+ Task** button
- Configure which columns are displayed via **⚙️ Cols**

### 📊 SOQL Tab
- Smart object + field picker
- Date filter chips (Today, Yesterday, This Week…)
- **▶ Run** — execute raw SOQL
- **✦ AI** — describe what you want in plain English, AI writes and runs the query

### 🐙 Git Tab
- Connect your GitHub account
- Load Salesforce metadata (Apex Classes, LWC, Aura, Flows, Permission Sets)
- Push selected files to any branch (or create a new branch on the fly)
- Create Pull Requests
- **☁ Backup** — archives your extension source code to a timestamped branch

### ⚙️ Setup
- **Config tab**: API keys, Owner Key, Theme toggle
- **Logs tab**: Real-time system logs, copy, clear, or **✦ Analyse** with AI

---

## 🎨 Theme System

Themes are implemented via CSS custom properties on the panel element:

```css
#spa-panel.spa-theme-dark  { --bg-panel: #0e1420; /* ... */ }
#spa-panel.spa-theme-light { --bg-panel: #ffffff; /* ... */ }
```

All child elements consume `var(--bg-panel)`, `var(--accent)`, etc., so switching class switches the entire palette instantly.

---

## 🎤 Speech Recognition

`js/spa-speech.js` wraps the Web Speech API and exposes `window.__SPA_SPEECH`:

```js
// Start listening
window.__SPA_SPEECH.start(
  (transcript, isFinal) => { /* update input */ },
  () => { /* on end */ },
  (error) => { /* on error */ }
);

// Stop listening
window.__SPA_SPEECH.stop();

// Check support
if (window.__SPA_SPEECH.supported) { ... }
```

> **Note**: Chrome requires HTTPS for microphone access. Works on Salesforce Lightning URLs out of the box.

---

## 🔒 Security Notes

- All API keys are stored in `chrome.storage.local` (encrypted by Chrome, scoped to the extension)
- The SF session token is read via `background.js` using `chrome.cookies` — this bypasses HttpOnly restrictions the same way Salesforce Inspector does
- No data is ever sent to any server except the APIs you configure (Groq, Monday, GitHub, Salesforce)

---

## 🛠 Development

### Modifying styles
Edit the relevant `css/spa-*.css` file. Changes take effect after reloading the extension in `chrome://extensions`.

### Adding a new chat intent
In `content.js`, find `handleMondayQuestion()` inside `wireEvents()` and add a new `if(lower.includes(...))` branch calling your handler.

### Changing the AI model
In `content.js`, update the `GROQ_MODEL` constant:
```js
const GROQ_MODEL = 'llama-3.3-70b-versatile'; // or 'llama-3.1-8b-instant', etc.
```

### Changing your Monday board names
Update the `MONDAY_BOARD_NAMES` constant and the board detection logic in `mapBoardsByName()`.

---

## 🐛 Troubleshooting

| Problem | Fix |
|---|---|
| ✦ FAB not visible | Check that you're on a `*.salesforce.com` or `*.force.com` URL |
| "Groq API key not set" | Go to ⚙️ Setup → Config → enter your key → Save All |
| SF toggle turns off automatically | Session not detected — refresh the Salesforce page and try again |
| Monday shows "No board found" | Your boards must contain "kmtsl" and "task"/"bug" in their names |
| Mic button not working | Chrome needs microphone permission — check `chrome://settings/content/microphone` |
| Logs show 401 errors | Your Salesforce session expired — refresh the page |

---

## 📄 License

Internal tool — not for distribution.
