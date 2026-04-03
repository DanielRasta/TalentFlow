# VC Talent Match

A personal AI-powered tool for venture capitalists to match talented candidates from their network to open roles at portfolio companies.

The VC sits at the intersection of two valuable networks — great people looking for jobs, and portfolio companies that are hiring. This app automates the discovery, scoring, and outreach that today happens manually via memory and email.

![Matches screen showing AI-scored candidate-opportunity pairs](https://github.com/user-attachments/assets/placeholder)

## Features

- **Candidate management** — Add candidates manually or by uploading a PDF resume. Claude AI parses the resume and extracts structured data (skills, seniority, experience, job types) for you to review and save.
- **Portfolio company & jobs tracking** — Add portfolio companies and their open roles. Fetch jobs automatically by scraping a company's careers page, or paste in a job description manually.
- **AI matching** — Run batch matching across all active candidates × open roles. Claude scores each pair 0–1 and explains its reasoning. Only matches scoring ≥ 0.4 are surfaced.
- **Candidate suggestion emails** — For any match, generate a polished draft email to the company's hiring contact suggesting the candidate. One click opens it in your mail client via `mailto:`. The candidate is never CC'd — this is a one-way suggestion to the company.
- **Expiry / TTL system** — Candidates have a configurable expiry date (default 90 days). Expiring-soon candidates get a warning badge; expired ones are filtered out of matching but can be reactivated.
- **Introduction log** — Every sent email is logged for audit purposes.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | SQLite via `better-sqlite3` |
| AI | Anthropic Claude API (`claude-sonnet-4-5`) |
| PDF parsing | `pdf-parse` |
| File uploads | `multer` |
| Email | `mailto:` links (no SMTP config needed) |

Single-user app — no authentication, no multi-tenancy. SQLite means zero database ops: your data is one file.

## Getting Started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Installation

```bash
git clone https://github.com/your-username/vc-talent-match.git
cd vc-talent-match

# Install all dependencies (root + client)
npm run install:all

# Configure environment
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...
```

### Running

```bash
npm run dev
```

This starts both servers concurrently:
- **Client** — http://localhost:5173
- **API** — http://localhost:3001

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required. Your Anthropic API key. |
| `PORT` | `3001` | Port for the Express API server. |
| `DB_PATH` | `./data/vc-talent.db` | Path to the SQLite database file. |
| `DEFAULT_EXPIRY_DAYS` | `90` | How many days until a candidate expires. |
| `MATCH_THRESHOLD` | `0.4` | Minimum AI match score (0–1) to save a match. |

## Project Structure

```
vc-talent-match/
├── server/
│   ├── index.ts              # Express entry point
│   ├── db.ts                 # SQLite schema & migrations
│   ├── routes/               # REST API route handlers
│   │   ├── companies.ts
│   │   ├── opportunities.ts
│   │   ├── candidates.ts
│   │   ├── matches.ts
│   │   └── introductions.ts
│   ├── services/
│   │   ├── ai.ts             # Claude API: resume parse, match score, email draft, job scrape
│   │   ├── scraper.ts        # Fetches & parses company careers pages
│   │   └── expiry.ts         # TTL middleware for candidate expiry
│   └── uploads/              # Stored resume PDFs
├── client/
│   └── src/
│       ├── pages/            # Dashboard, Companies, Opportunities, Candidates, Matches
│       ├── components/       # Layout, forms, modals, badges
│       └── lib/api.ts        # Typed fetch wrapper for all API calls
└── data/
    └── vc-talent.db          # SQLite database (auto-created on first run)
```

## How It Works

### Adding Candidates

Upload a PDF resume or fill in a form manually. For PDF uploads, the resume text is extracted and sent to Claude, which returns structured JSON (name, email, skills, headline, seniority, job types, experience). You review and edit the parsed fields before saving.

### Fetching Jobs

Each portfolio company has a "Refresh Jobs" button. The backend fetches the company's website and tries common careers page paths (`/careers`, `/jobs`, `/openings`). The page HTML is stripped and sent to Claude, which extracts structured job listings including direct links to individual postings. You review the results before they're saved.

### Running Matches

Click "Run Matching" on the Matches page. The app iterates every active candidate × every active open role (skipping pairs already scored) and calls Claude on each pair. Claude considers transferable skills broadly — a sales person might fit a BD role, a PM might fit customer success, etc. Matches are scored 0–1 with a short reasoning sentence. Only matches ≥ 0.4 threshold are stored.

### Suggesting a Candidate

For any pending match, click "Suggest". Claude drafts a short email to the company's hiring contact explaining why this candidate could be a fit, including the candidate's LinkedIn and email. The email transparently notes it was generated by an AI matching system. You preview and edit the draft, then "Open in Mail" fires a `mailto:` link pre-filled with the subject and body.

**Note:** The candidate is never CC'd or notified. This is a one-way signal from you to the company.

## Seed Data

To import initial companies:

```bash
# Create seed-companies.json in the project root
[
  {
    "name": "Acme Corp",
    "website": "https://acme.com",
    "contact_name": "Jane Smith",
    "contact_email": "jane@acme.com"
  }
]
```

Place PDF resumes in a `seed-resumes/` folder. A seed script can bulk-import them through the AI resume parser — or add candidates one at a time through the UI.

## Non-Goals (v1)

- Multi-user / authentication
- SMTP email sending (uses `mailto:` only)
- LinkedIn API integration (manual paste only)
- Automated scheduled scraping
- Candidate-facing portal
- Mobile-optimized UI

## License

MIT — see [LICENSE](LICENSE).
