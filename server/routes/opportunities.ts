import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

// GET /api/opportunities
router.get('/', (req: Request, res: Response) => {
  const { company_id, job_type, is_active } = req.query;

  let query = `
    SELECT o.*, c.name as company_name, c.contact_email as company_contact_email
    FROM opportunities o
    JOIN companies c ON o.company_id = c.id
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

  if (is_active !== undefined) {
    query += ' AND o.is_active = ?';
    params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
  }

  query += ' ORDER BY c.name ASC, o.title ASC';

  const opportunities = db.prepare(query).all(...params);
  res.json(opportunities);
});

// POST /api/opportunities/batch
router.post('/batch', (req: Request, res: Response) => {
  const { company_id, rows } = req.body;

  if (!company_id) return res.status(400).json({ error: 'company_id is required' });
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'rows must be a non-empty array' });

  const company = db.prepare('SELECT id FROM companies WHERE id = ?').get(company_id);
  if (!company) return res.status(404).json({ error: 'Company not found' });

  const insert = db.prepare(
    `INSERT INTO opportunities (company_id, title, department, job_type, seniority, location, source_url, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'csv')`
  );

  let added = 0;
  const errors: string[] = [];

  const insertAll = db.transaction((items: any[]) => {
    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      if (!row.title?.trim()) { errors.push(`Row ${i + 1}: title is required`); continue; }
      try {
        insert.run(
          company_id,
          row.title.trim(),
          row.department?.trim() || null,
          row.job_type?.trim() || null,
          row.seniority?.trim() || null,
          row.location?.trim() || null,
          row.source_url?.trim() || null,
        );
        added++;
      } catch (err) {
        errors.push(`Row ${i + 1}: ${(err as Error).message}`);
      }
    }
  });
  insertAll(rows);

  return res.json({ added, errors });
});

// POST /api/opportunities
router.post('/', (req: Request, res: Response) => {
  const {
    company_id, title, department, job_type, seniority, location,
    description, source_url, source
  } = req.body;

  if (!company_id || !title) {
    return res.status(400).json({ error: 'company_id and title are required' });
  }

  const company = db.prepare('SELECT id FROM companies WHERE id = ?').get(company_id);
  if (!company) {
    return res.status(404).json({ error: 'Company not found' });
  }

  const result = db
    .prepare(
      `INSERT INTO opportunities (company_id, title, department, job_type, seniority, location, description, source_url, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      company_id,
      title,
      department || null,
      job_type || null,
      seniority || null,
      location || null,
      description || null,
      source_url || null,
      source || 'manual'
    );

  const opportunity = db
    .prepare(
      `SELECT o.*, c.name as company_name FROM opportunities o
       JOIN companies c ON o.company_id = c.id WHERE o.id = ?`
    )
    .get(result.lastInsertRowid);
  return res.status(201).json(opportunity);
});

// PUT /api/opportunities/:id
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    title, department, job_type, seniority, location,
    description, source_url, is_active
  } = req.body;

  const existing = db.prepare('SELECT id FROM opportunities WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Opportunity not found' });
  }

  db.prepare(
    `UPDATE opportunities
     SET title = ?, department = ?, job_type = ?, seniority = ?, location = ?,
         description = ?, source_url = ?, is_active = ?
     WHERE id = ?`
  ).run(
    title,
    department || null,
    job_type || null,
    seniority || null,
    location || null,
    description || null,
    source_url || null,
    is_active !== undefined ? (is_active ? 1 : 0) : 1,
    id
  );

  const opportunity = db
    .prepare(
      `SELECT o.*, c.name as company_name FROM opportunities o
       JOIN companies c ON o.company_id = c.id WHERE o.id = ?`
    )
    .get(id);
  return res.json(opportunity);
});

// DELETE /api/opportunities/:id
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM opportunities WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Opportunity not found' });
  }

  db.prepare('DELETE FROM opportunities WHERE id = ?').run(id);
  return res.json({ success: true });
});

// PATCH /api/opportunities/:id/toggle-active
router.patch('/:id/toggle-active', (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT id, is_active FROM opportunities WHERE id = ?').get(id) as {
    id: number;
    is_active: number;
  } | undefined;

  if (!existing) {
    return res.status(404).json({ error: 'Opportunity not found' });
  }

  const newActive = existing.is_active ? 0 : 1;
  db.prepare('UPDATE opportunities SET is_active = ? WHERE id = ?').run(newActive, id);

  const opportunity = db
    .prepare(
      `SELECT o.*, c.name as company_name FROM opportunities o
       JOIN companies c ON o.company_id = c.id WHERE o.id = ?`
    )
    .get(id);
  return res.json(opportunity);
});

export default router;
