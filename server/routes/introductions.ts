import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

// GET /api/introductions
router.get('/', (req: Request, res: Response) => {
  const introductions = db
    .prepare(
      `SELECT i.*,
        m.candidate_id, m.opportunity_id,
        c.name as candidate_name,
        o.title as opportunity_title,
        comp.name as company_name
       FROM introductions i
       JOIN matches m ON i.match_id = m.id
       JOIN candidates c ON m.candidate_id = c.id
       JOIN opportunities o ON m.opportunity_id = o.id
       JOIN companies comp ON o.company_id = comp.id
       ORDER BY i.created_at DESC`
    )
    .all();

  return res.json(introductions);
});

// POST /api/introductions
router.post('/', (req: Request, res: Response) => {
  const { match_id, to_email, subject, body } = req.body;

  if (!match_id || !to_email || !subject || !body) {
    return res.status(400).json({ error: 'match_id, to_email, subject, and body are required' });
  }

  const match = db.prepare('SELECT id FROM matches WHERE id = ?').get(match_id);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }

  const result = db
    .prepare(
      'INSERT INTO introductions (match_id, to_email, subject, body) VALUES (?, ?, ?, ?)'
    )
    .run(match_id, to_email, subject, body);

  // Update match status to introduced
  db.prepare(
    "UPDATE matches SET status = 'introduced', introduced_at = datetime('now') WHERE id = ?"
  ).run(match_id);

  const introduction = db
    .prepare('SELECT * FROM introductions WHERE id = ?')
    .get(result.lastInsertRowid);
  return res.status(201).json(introduction);
});

export default router;
