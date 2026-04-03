import { Router, Request, Response } from 'express';
import db from '../db';
import { refreshCompanyJobs } from '../services/scraper';

const router = Router();

// GET /api/companies
router.get('/', (req: Request, res: Response) => {
  const companies = db
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM opportunities o WHERE o.company_id = c.id AND o.is_active = 1) as open_roles
       FROM companies c
       ORDER BY c.name ASC`
    )
    .all();
  res.json(companies);
});

// POST /api/companies
router.post('/', (req: Request, res: Response) => {
  const { name, website, linkedin_url, contact_name, contact_email, logo_url, notes } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const result = db
    .prepare(
      `INSERT INTO companies (name, website, linkedin_url, contact_name, contact_email, logo_url, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      website || null,
      linkedin_url || null,
      contact_name || null,
      contact_email || null,
      logo_url || null,
      notes || null
    );

  const company = db
    .prepare('SELECT * FROM companies WHERE id = ?')
    .get(result.lastInsertRowid);
  return res.status(201).json(company);
});

// PUT /api/companies/:id
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, website, linkedin_url, contact_name, contact_email, logo_url, notes } = req.body;

  const existing = db.prepare('SELECT id FROM companies WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Company not found' });
  }

  db.prepare(
    `UPDATE companies
     SET name = ?, website = ?, linkedin_url = ?, contact_name = ?, contact_email = ?,
         logo_url = ?, notes = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    name,
    website || null,
    linkedin_url || null,
    contact_name || null,
    contact_email || null,
    logo_url || null,
    notes || null,
    id
  );

  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
  return res.json(company);
});

// DELETE /api/companies/:id
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM companies WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Company not found' });
  }

  db.prepare('DELETE FROM companies WHERE id = ?').run(id);
  return res.json({ success: true });
});

// POST /api/companies/:id/refresh
router.post('/:id/refresh', async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM companies WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Company not found' });
  }

  try {
    const result = await refreshCompanyJobs(Number(id));
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error refreshing company jobs:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/companies/refresh-all
router.post('/refresh-all', async (req: Request, res: Response) => {
  const companies = db.prepare('SELECT id FROM companies').all() as { id: number }[];

  const results: { companyId: number; added: number; deactivated: number; error?: string }[] = [];

  for (const company of companies) {
    try {
      const result = await refreshCompanyJobs(company.id);
      results.push({ companyId: company.id, ...result });
    } catch (err) {
      results.push({ companyId: company.id, added: 0, deactivated: 0, error: (err as Error).message });
    }
  }

  return res.json({ success: true, results });
});

export default router;
