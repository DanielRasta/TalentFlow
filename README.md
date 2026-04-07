# TalentFlow

An AI-powered tool that helps venture capitalists connect talented people in their network with open roles at portfolio companies — automatically.

---

## What This Does

As a VC, you know great people who are looking for their next role. You also know which of your portfolio companies are hiring. Today, making those connections relies on memory and manual emails.

This app changes that. You build a private list of candidates (upload their resume or fill in a quick form), keep track of open roles across your portfolio, and let Claude AI figure out who is a good fit for what. When there's a strong match, the app drafts a short email to the company's hiring team — you review it, edit if needed, and send it from your own inbox.

Everything stays private on your computer. No logins, no third-party databases, no data sharing.

**What you can do:**
- Add candidates from your network (upload a PDF resume or paste linkedin profile — AI analyze it for you)
- Track open roles at each portfolio company (paste a job description or let the app scrape the careers page)
- Run AI matching across all candidates × all open roles with one click
- Review AI-scored matches with an explanation of why each is a fit
- Generate a polished candidate suggestion email to the company in seconds
- See which candidates are about to expire from your active pool (everyone gets a 90-day window by default)
- Communicate with the app using an internal secured chat (powerd by [CopilotKit](https://www.copilotkit.ai/))

---

## Before You Start

You need two things installed on your computer before running this app for the first time. Both are free.

### 1. Node.js

Node.js is the engine that runs the app.

1. Go to **https://nodejs.org**
2. Click the big green **"LTS"** download button (LTS = stable version)
3. Open the downloaded file and follow the installer steps
4. When it finishes, open **Terminal** (Mac: press `Command + Space`, type "Terminal", press Enter)
5. Type this and press Enter to confirm it worked:
   ```
   node --version
   ```
   You should see something like `v20.11.0`. Any number is fine.

### 2. An Anthropic API Key

This app uses Claude AI for matching and email drafting. You need an API key (like a password that lets the app talk to Claude).

1. Go to **https://console.anthropic.com**
2. Sign up or log in
3. Click **"API Keys"** in the left sidebar
4. Click **"Create Key"**, give it any name (e.g. "VC Talent Match")
5. Copy the key — it starts with `sk-ant-...`
6. **Save it somewhere safe.** You won't be able to see it again after closing that page.

> **Note:** The Anthropic API is a paid service billed by usage!

---

## Installation

You only need to do this once.

### Step 1 — Download the project

If you have Git installed:
```
git clone https://github.com/your-username/vc-talent-match.git
cd vc-talent-match
```

Or download the ZIP from GitHub, unzip it, and open Terminal directed to that folder.

### Step 2 — Install dependencies

In Terminal, paste this and press Enter:
```
npm run install:all
```

This downloads all the code libraries the app needs. It will take about a minute. You'll see a lot of text scroll by — that's normal.

### Step 3 — Add your API key

The app needs your Anthropic API key to work. There's a template file called `.env.example` that shows what's needed.

In Terminal:
```
cp .env.example .env
```

Now open the `.env` file in any text editor and replace the placeholder with your real key:

```
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

Save the file. That's it — you never need to touch this file again.

> **Important:** The `.env` file is listed in `.gitignore`, which means it will never be accidentally uploaded to GitHub. Your API key stays on your computer only.

---

## Running the App

Every time you want to use the app, open Terminal, navigate to the project folder, and run:

```
npm run dev
```

You'll see some startup messages. After about 5 seconds, open your web browser and go to:

```
http://localhost:5173
```

The app will be running there. It looks and works like a normal website — just one that lives on your computer instead of the internet.

To stop the app, go back to Terminal and press `Control + C`.

> **Port note:** The client is locked to port **5173**. If something else is already using that port when you run `npm run dev`, Vite will exit immediately with:
> ```
> Error: Port 5173 is already in use
> ```
> To fix it, find and stop the process using port 5173 (on Mac: `lsof -ti :5173 | xargs kill`), then try again.

If you want to take the extra mile, you can also host it as a service on your device or ship it to the cloud. I decided not to provide it as the app is not secured nor compliant by design and should be accessed with intention.

---

## Running as a Background Service (macOS)

Instead of manually running `npm run dev` every time, you can install TalentFlow as a **login service** that starts automatically when you log in and is always available at **http://localhost:5173**.

### Install

```bash
bash scripts/setup-service.sh
```

That's it. The script:
- Creates a macOS LaunchAgent (`~/Library/LaunchAgents/com.talentflow.app.plist`)
- Starts the app immediately
- Configures it to auto-start on every login
- Writes logs to `~/Library/Logs/TalentFlow/`

### Manage the service

| Action | Command |
|--------|---------|
| Stop | `launchctl unload ~/Library/LaunchAgents/com.talentflow.app.plist` |
| Start | `launchctl load ~/Library/LaunchAgents/com.talentflow.app.plist` |
| Check status | `launchctl list \| grep talentflow` |
| View logs | `tail -f ~/Library/Logs/TalentFlow/stdout.log` |
| View errors | `tail -f ~/Library/Logs/TalentFlow/stderr.log` |

### Uninstall

```bash
bash scripts/uninstall-service.sh
```

This stops the service and removes the plist. Your app files and database are untouched.

---

## Quick Start Guide

**First time setup:**
1. Go to **Companies** → add your portfolio companies (name, website, hiring contact email)
2. For each company, click **"Refresh Jobs"** to auto-fetch their open roles, add roles manually, or in a batch.
3. Go to **Candidates** → add people from your network (upload a PDF resume, paste LinkedIn content, or fill in manually)
4. Go to **Matches** → click **"Run Matching"** — Claude scores every candidate against every open role
5. Review the matches, dismiss weak ones, and click **"Suggest"** on the good ones to draft an email

---

## Project Structure (for the developers)

```
vc-talent-match/
├── server/          # Node.js + Express API (TypeScript)
│   ├── routes/      # REST endpoints for all entities
│   ├── services/    # Claude AI, web scraper, expiry TTL
│   └── uploads/     # Stored resume PDFs (gitignored)
├── client/          # React + Vite + Tailwind frontend
│   └── src/
│       ├── pages/   # Dashboard, Companies, Opportunities, Candidates, Matches
│       └── lib/     # Typed API client
└── data/            # SQLite database file (gitignored)
```

**Stack:** React · TypeScript · Tailwind CSS · Node.js · Express · SQLite · Anthropic Claude API

---

## Privacy & Data

All data — candidates, companies, match scores, emails — is stored in a single SQLite file on your computer (`data/vc-talent.db`). Nothing is sent to any server except the text you explicitly send to Claude for AI processing (resume text, job descriptions, match scoring). No candidate data ever leaves your machine in any other way. Which is also part of the `.gitignore` file so it stays on your device.

---

## License

MIT — free to use, modify, and distribute. See [LICENSE](LICENSE).
