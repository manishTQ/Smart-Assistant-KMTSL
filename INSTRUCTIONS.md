# Installation & First-Run Instructions
## Smart Productivity Assistant v9

---

## STEP 1 — Load the Extension in Chrome

1. Unzip the `smart-assistant-v9.zip` (or use the folder directly)
2. Open Chrome and go to: `chrome://extensions`
3. Turn on **Developer mode** using the toggle in the top-right corner
4. Click **Load unpacked**
5. Select the `smart-assistant-v9` folder
6. You should see **Smart Productivity Assistant** appear in your extensions list with a ✦ icon

---

## STEP 2 — Open a Salesforce Page

Navigate to any Salesforce Lightning page, for example:
- `https://yourorg.lightning.force.com/`
- `https://yourorg.my.salesforce.com/`

You should see a small **✦** button in the bottom-right corner of the page.

> If you don't see it, check the Console (F12) for errors and ensure the URL matches the host_permissions in manifest.json.

---

## STEP 3 — Enter Your API Keys

1. Click the **✦** FAB button to open the panel
2. Click the **⚙️** tab (rightmost tab)
3. Make sure you're on the **Config** inner tab

Fill in the following fields:

### 🟢 Groq AI (Required for Chat)
- **API Key**: Get a free key at https://console.groq.com
  - Sign up → API Keys → Create API Key → copy it
  - Starts with `gsk_`

### 👤 Monday Owner Key (Required for task filtering)
- **User ID**: Your numeric Monday.com user ID
  - In Monday: click your Avatar → Developers → scroll to "Your User ID"
  - It's a number like `84681170`
  - This filters tasks/bugs to show ONLY yours

### 🔗 Monday.com API Token (Required for Monday tab)
- **API Token**: Your Monday personal access token
  - In Monday: Avatar → Developers → My Access Tokens → Show
  - Starts with `eyJhbGciOi...`

### 🔗 GitHub Token (Required for Git tab)
- **Personal Access Token**: Contact TQ Admin to get the Repository Token
  - New token (classic) → check `repo` scope → Generate
  - Starts with `ghp_`
- **Default Repo**: Format `owner/repo-name` e.g. `manish-team/kmtsl-app`

4. Click **💾 Save All**
5. Click **🔌 Test** — all items should show ✅

---

## STEP 4 — Connect Salesforce (Optional)

To use SOQL and AI-powered Salesforce features:

1. Make sure you're logged into Salesforce in the same browser
2. In the panel header, click the **SF** toggle to turn it ON (it turns green)
3. If your session is detected, you'll see a ✅ confirmation in chat
4. If not, try refreshing the Salesforce page and toggling again

---

## STEP 5 — Try Your First Actions

### Chat
- Type: **"what are my tasks today"** → shows your Monday tasks
- Type: **"what are my bugs pending"** → shows open bugs assigned to you
- Type: **"create task Fix login bug for PR #42"** → creates a Monday task
- Type: **"summarise my work"** → AI summary of your tasks

### Voice Input
- Click the 🎤 mic button → speak your message → it appears in the input field
- Press Enter or click ➤ to send

### Quick Actions
- Click **My tasks today** / **Pending bugs** / **Create task** for instant queries

### Monday Tab
- Switch between **KMTSL Tasks** and **KMTSL Bugs Queue** inner tabs
- Use date filter chips: Today / Yesterday / This Week / All
- Click ✏️ on any item to update its status inline

### SOQL Tab
1. Select an object from the dropdown (e.g. Contract)
2. Edit the query or type in plain English
3. Click **▶ Run** to execute, or **✦ AI** to auto-generate + run

### Git Tab
1. Your GitHub profile loads automatically (if token is set)
2. Select a **Repo** and **Branch**
3. Choose a Metadata Type and click **Load ↓** to browse files (SF toggle must be ON)
4. Check files to include, set a commit message, click **↑ Push selected**
5. Click **☁ Backup** to snapshot your extension source to a timestamped branch

---

## STEP 6 — Customise the Theme

1. Go to **⚙️ Setup → Config**
2. Toggle the **🎨 Appearance** switch:
   - 🌙 Left (DARK) = dark navy theme  
   - ☀️ Right (LIGHT) = clean white theme
3. The change is instant and saved automatically when you click **💾 Save All**

---

## STEP 7 — Check the Logs

1. Go to **⚙️ Setup → Logs** inner tab
2. All system activity is logged here in real time
3. Click **✦ Analyse** to send the latest logs to AI for diagnosis
4. Click **📋 Copy All** to copy logs for sharing

---

## Troubleshooting Quick Reference

| Issue | Solution |
|---|---|
| Panel doesn't open | Refresh the Salesforce page; check chrome://extensions for errors |
| "Groq API key not set" | ⚙️ Setup → Config → enter key → Save All |
| SF toggle reverts to OFF | Session expired — refresh Salesforce page |
| Monday shows wrong tasks | Check Owner Key matches your Monday User ID |
| Mic button does nothing | Allow microphone in chrome://settings/content/microphone |
| No boards found in Monday | Board names must contain "kmtsl" + "task" or "bug" |
| Git tab shows auth error | Token missing `repo` scope — regenerate it |

---

## Updating the Extension

1. Make your changes to the source files
2. Go to `chrome://extensions`
3. Click the **↻ refresh** icon on the extension card
4. Reload the Salesforce page

---

*Smart Productivity Assistant v9 — Built for Manish & the KMTSL team*
