import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DB_PATH || './data/vc-talent.db';
const resolvedPath = path.resolve(dbPath);

// Ensure the directory exists
const dir = path.dirname(resolvedPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(resolvedPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run migrations
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    website       TEXT,
    linkedin_url  TEXT,
    contact_name  TEXT,
    contact_email TEXT,
    logo_url      TEXT,
    notes         TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS opportunities (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    department      TEXT,
    job_type        TEXT,
    seniority       TEXT,
    location        TEXT,
    description     TEXT,
    source_url      TEXT,
    source          TEXT DEFAULT 'manual',
    is_active       INTEGER DEFAULT 1,
    first_seen_at   TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at    TEXT NOT NULL DEFAULT (datetime('now')),
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_opportunities_company ON opportunities(company_id);
  CREATE INDEX IF NOT EXISTS idx_opportunities_job_type ON opportunities(job_type);
  CREATE INDEX IF NOT EXISTS idx_opportunities_active ON opportunities(is_active);

  CREATE TABLE IF NOT EXISTS candidates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    email           TEXT,
    phone           TEXT,
    linkedin_url    TEXT,
    resume_path     TEXT,
    resume_text     TEXT,
    headline        TEXT,
    skills          TEXT,
    experience_years INTEGER,
    job_types       TEXT,
    seniority       TEXT,
    location        TEXT,
    notes           TEXT,
    source          TEXT DEFAULT 'manual',
    expires_at      TEXT,
    is_active       INTEGER DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_candidates_active ON candidates(is_active);
  CREATE INDEX IF NOT EXISTS idx_candidates_expires ON candidates(expires_at);

  CREATE TABLE IF NOT EXISTS matches (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id    INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    opportunity_id  INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    score           REAL,
    reasoning       TEXT,
    status          TEXT DEFAULT 'pending',
    dismissed_at    TEXT,
    introduced_at   TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(candidate_id, opportunity_id)
  );

  CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
  CREATE INDEX IF NOT EXISTS idx_matches_candidate ON matches(candidate_id);
  CREATE INDEX IF NOT EXISTS idx_matches_opportunity ON matches(opportunity_id);

  CREATE TABLE IF NOT EXISTS introductions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id        INTEGER NOT NULL REFERENCES matches(id),
    to_email        TEXT NOT NULL,
    subject         TEXT NOT NULL,
    body            TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrations for new columns
try { db.exec(`ALTER TABLE candidates ADD COLUMN is_executive INTEGER DEFAULT 0`); } catch {}

export default db;
