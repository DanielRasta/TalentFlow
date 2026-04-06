import { Router, Request, Response } from 'express';
import db from '../db';
import { scoreMatch, draftIntroductionEmail } from '../services/ai';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

const MATCH_THRESHOLD = parseFloat(process.env.MATCH_THRESHOLD || '0.4');

// GET /api/matches
router.get('/', (req: Request, res: Response) => {
  const { company_id, job_type, status, show_dismissed } = req.query;

  let query = `
    SELECT m.*,
      c.name as candidate_name, c.headline as candidate_headline,
      c.email as candidate_email, c.linkedin_url as candidate_linkedin,
      c.skills as candidate_skills, c.seniority as candidate_seniority,
      o.title as opportunity_title, o.job_type as opportunity_job_type,
      o.location as opportunity_location, o.company_id,
      comp.name as company_name, comp.contact_email as company_contact_email,
      comp.contact_name as company_contact_name
    FROM matches m
    JOIN candidates c ON m.candidate_id = c.id
    JOIN opportunities o ON m.opportunity_id = o.id
    JOIN companies comp ON o.company_id = comp.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (company_id) {
    query += ' AND o.company_id = ?';
    params.push(company_id);
  }

  if (job_type && job_type !== 'all') {
    query += ' AND o.job_type = ?';
    params.push(job_type);
  }

  if (status) {
    query += ' AND m.status = ?';
    params.push(status);
  } else if (show_dismissed !== 'true') {
    query += " AND m.status != 'dismissed'";
  }

  query += ' ORDER BY m.score DESC, m.created_at DESC';

  const matches = db.prepare(query).all(...params);
  return res.json(matches);
});

// POST /api/matches/run
router.post('/run', async (req: Request, res: Response) => {
  const candidates = db
    .prepare('SELECT * FROM candidates WHERE is_active = 1')
    .all() as any[];

  const opportunities = db
    .prepare(
      `SELECT o.*, c.name as company_name FROM opportunities o
       JOIN companies c ON o.company_id = c.id
       WHERE o.is_active = 1`
    )
    .all() as any[];

  if (candidates.length === 0 || opportunities.length === 0) {
    return res.json({ message: 'No candidates or opportunities to match', added: 0 });
  }

  let added = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const candidate of candidates) {
    for (const opportunity of opportunities) {
      // Skip if match already exists
      const existing = db
        .prepare('SELECT id FROM matches WHERE candidate_id = ? AND opportunity_id = ?')
        .get(candidate.id, opportunity.id);

      if (existing) {
        skipped++;
        continue;
      }

      try {
        const result = await scoreMatch(
          {
            name: candidate.name,
            headline: candidate.headline,
            skills: candidate.skills,
            experience_years: candidate.experience_years,
            job_types: candidate.job_types,
            seniority: candidate.seniority,
            location: candidate.location,
          },
          {
            title: opportunity.title,
            department: opportunity.department,
            job_type: opportunity.job_type,
            seniority: opportunity.seniority,
            location: opportunity.location,
            description: opportunity.description,
          }
        );

        if (result.score >= MATCH_THRESHOLD) {
          db.prepare(
            `INSERT OR IGNORE INTO matches (candidate_id, opportunity_id, score, reasoning)
             VALUES (?, ?, ?, ?)`
          ).run(candidate.id, opportunity.id, result.score, result.reasoning);
          added++;
        }
      } catch (err) {
        const errMsg = `Match ${candidate.id}x${opportunity.id}: ${(err as Error).message}`;
        errors.push(errMsg);
        console.error(errMsg);
      }
    }
  }

  return res.json({
    message: 'Matching complete',
    added,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
});

// POST /api/matches/:id/dismiss
router.post('/:id/dismiss', (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM matches WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Match not found' });
  }

  db.prepare(
    "UPDATE matches SET status = 'dismissed', dismissed_at = datetime('now') WHERE id = ?"
  ).run(id);

  return res.json({ success: true });
});

// POST /api/matches/:id/introduce
router.post('/:id/introduce', async (req: Request, res: Response) => {
  const { id } = req.params;

  const match = db
    .prepare(
      `SELECT m.*,
        c.name as candidate_name, c.email as candidate_email,
        c.phone as candidate_phone, c.linkedin_url as candidate_linkedin,
        c.headline as candidate_headline, c.skills as candidate_skills,
        c.experience_years as candidate_experience_years,
        o.title as opportunity_title, o.description as opportunity_description,
        comp.name as company_name, comp.contact_name as company_contact_name,
        comp.contact_email as company_contact_email
       FROM matches m
       JOIN candidates c ON m.candidate_id = c.id
       JOIN opportunities o ON m.opportunity_id = o.id
       JOIN companies comp ON o.company_id = comp.id
       WHERE m.id = ?`
    )
    .get(id) as any;

  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }

  try {
    const { subject, body } = await draftIntroductionEmail(
      {
        name: match.company_name,
        contact_name: match.company_contact_name,
        contact_email: match.company_contact_email,
      },
      {
        title: match.opportunity_title,
        description: match.opportunity_description,
      },
      {
        name: match.candidate_name,
        email: match.candidate_email,
        phone: match.candidate_phone,
        linkedin_url: match.candidate_linkedin,
        headline: match.candidate_headline,
        skills: match.candidate_skills,
        experience_years: match.candidate_experience_years,
      }
    );

    return res.json({
      to: match.company_contact_email,
      subject,
      body,
    });
  } catch (err) {
    console.error('Error generating introduction:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/matches/:id/introduction
router.get('/:id/introduction', (req: Request, res: Response) => {
  const { id } = req.params;

  const introduction = db
    .prepare('SELECT * FROM introductions WHERE match_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(id);

  if (!introduction) {
    return res.status(404).json({ error: 'No introduction found for this match' });
  }

  return res.json(introduction);
});

export default router;
