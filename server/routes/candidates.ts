import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db';
import { parseResume } from '../services/ai';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

const uploadDir = path.resolve('./server/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

function getDefaultExpiryDate(): string {
  const days = parseInt(process.env.DEFAULT_EXPIRY_DAYS || '90');
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

// GET /api/candidates
router.get('/', (req: Request, res: Response) => {
  const { status } = req.query;

  let query = 'SELECT * FROM candidates WHERE 1=1';
  const params: any[] = [];

  if (status === 'active') {
    query += ' AND is_active = 1';
  } else if (status === 'expired') {
    query += ' AND is_active = 0';
  }

  query += ' ORDER BY created_at DESC';

  const candidates = db.prepare(query).all(...params);
  return res.json(candidates);
});

// POST /api/candidates
router.post('/', (req: Request, res: Response) => {
  const {
    name, email, phone, linkedin_url, headline, skills, experience_years,
    job_types, seniority, location, notes, source, expires_at
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const expiresAt = expires_at || getDefaultExpiryDate();

  const result = db
    .prepare(
      `INSERT INTO candidates (name, email, phone, linkedin_url, headline, skills, experience_years,
        job_types, seniority, location, notes, source, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      email || null,
      phone || null,
      linkedin_url || null,
      headline || null,
      Array.isArray(skills) ? skills.join(', ') : (skills || null),
      experience_years || null,
      Array.isArray(job_types) ? job_types.join(', ') : (job_types || null),
      seniority || null,
      location || null,
      notes || null,
      source || 'manual',
      expiresAt
    );

  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json(candidate);
});

// POST /api/candidates/upload
router.post('/upload', upload.single('resume'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const pdfParse = (await import('pdf-parse')).default;
    const fileBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(fileBuffer);
    const resumeText = pdfData.text;

    let parsed;
    try {
      parsed = await parseResume(resumeText);
    } catch (aiErr) {
      console.error('AI parsing failed:', aiErr);
      // Return the file path and raw text so front-end can do manual entry
      return res.json({
        resume_path: req.file.path,
        resume_text: resumeText,
        parsed: null,
        error: 'AI parsing failed, please fill in details manually',
      });
    }

    return res.json({
      resume_path: req.file.path,
      resume_text: resumeText,
      parsed,
    });
  } catch (err) {
    console.error('Error processing PDF:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /api/candidates/:id
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    name, email, phone, linkedin_url, resume_path, resume_text, headline, skills,
    experience_years, job_types, seniority, location, notes, source, expires_at, is_active
  } = req.body;

  const existing = db.prepare('SELECT id FROM candidates WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Candidate not found' });
  }

  db.prepare(
    `UPDATE candidates
     SET name = ?, email = ?, phone = ?, linkedin_url = ?, resume_path = ?, resume_text = ?,
         headline = ?, skills = ?, experience_years = ?, job_types = ?, seniority = ?,
         location = ?, notes = ?, source = ?, expires_at = ?, is_active = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    name,
    email || null,
    phone || null,
    linkedin_url || null,
    resume_path || null,
    resume_text || null,
    headline || null,
    Array.isArray(skills) ? skills.join(', ') : (skills || null),
    experience_years || null,
    Array.isArray(job_types) ? job_types.join(', ') : (job_types || null),
    seniority || null,
    location || null,
    notes || null,
    source || 'manual',
    expires_at || null,
    is_active !== undefined ? (is_active ? 1 : 0) : 1,
    id
  );

  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
  return res.json(candidate);
});

// DELETE /api/candidates/:id
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT id, resume_path FROM candidates WHERE id = ?').get(id) as {
    id: number;
    resume_path: string | null;
  } | undefined;

  if (!existing) {
    return res.status(404).json({ error: 'Candidate not found' });
  }

  // Delete resume file if it exists
  if (existing.resume_path && fs.existsSync(existing.resume_path)) {
    fs.unlinkSync(existing.resume_path);
  }

  db.prepare('DELETE FROM candidates WHERE id = ?').run(id);
  return res.json({ success: true });
});

// PATCH /api/candidates/:id/reactivate
router.patch('/:id/reactivate', (req: Request, res: Response) => {
  const { id } = req.params;
  const { expires_at } = req.body;

  const existing = db.prepare('SELECT id FROM candidates WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Candidate not found' });
  }

  const newExpiresAt = expires_at || getDefaultExpiryDate();

  db.prepare(
    `UPDATE candidates SET is_active = 1, expires_at = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(newExpiresAt, id);

  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
  return res.json(candidate);
});

export default router;
