import { parseJobsFromPage, ParsedJob } from './ai';
import db from '../db';

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<string> {
  const fetch = (await import('node-fetch')).default;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal as any,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VCTalentMatch/1.0)',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function stripHtml(html: string): string {
  // Remove script and style tags and their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Replace block-level elements with newlines
  text = text.replace(/<\/(div|p|h[1-6]|li|tr|br)>/gi, '\n');
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

export async function fetchAndParseJobs(company: {
  id: number;
  name: string;
  website: string | null;
}): Promise<ParsedJob[]> {
  if (!company.website) {
    console.log(`No website for company ${company.name}, skipping scrape`);
    return [];
  }

  const baseUrl = company.website.replace(/\/$/, '');
  const paths = ['', '/careers', '/jobs', '/openings', '/join', '/work-with-us'];

  let pageText = '';

  for (const p of paths) {
    const url = `${baseUrl}${p}`;
    try {
      const html = await fetchWithTimeout(url);
      const text = stripHtml(html);
      // Take a reasonable chunk to avoid token limits
      pageText += `\n\n=== ${url} ===\n${text.substring(0, 8000)}`;
    } catch (err) {
      // Try next path
      console.log(`Failed to fetch ${url}: ${(err as Error).message}`);
    }
  }

  if (!pageText.trim()) {
    console.log(`No content fetched for ${company.name}`);
    return [];
  }

  // Limit total text sent to AI
  const truncated = pageText.substring(0, 16000);

  try {
    const jobs = await parseJobsFromPage(truncated);
    return jobs;
  } catch (err) {
    console.error(`Failed to parse jobs for ${company.name}:`, err);
    return [];
  }
}

export async function refreshCompanyJobs(companyId: number): Promise<{
  added: number;
  deactivated: number;
}> {
  const company = db
    .prepare('SELECT id, name, website FROM companies WHERE id = ?')
    .get(companyId) as { id: number; name: string; website: string | null } | undefined;

  if (!company) {
    throw new Error(`Company ${companyId} not found`);
  }

  const jobs = await fetchAndParseJobs(company);

  if (jobs.length === 0) {
    return { added: 0, deactivated: 0 };
  }

  let added = 0;
  const seenTitles = new Set<string>();

  for (const job of jobs) {
    seenTitles.add(job.title.toLowerCase().trim());

    // Try to find existing opportunity by title + company
    const existing = db
      .prepare(
        'SELECT id FROM opportunities WHERE company_id = ? AND LOWER(TRIM(title)) = LOWER(TRIM(?))'
      )
      .get(companyId, job.title) as { id: number } | undefined;

    if (existing) {
      // Update last_seen_at and re-activate if it was inactive
      db.prepare(
        `UPDATE opportunities
         SET last_seen_at = datetime('now'), is_active = 1,
             description = COALESCE(?, description),
             source_url = COALESCE(?, source_url),
             location = COALESCE(?, location)
         WHERE id = ?`
      ).run(job.description || null, job.source_url || null, job.location || null, existing.id);
    } else {
      // Insert new opportunity
      db.prepare(
        `INSERT INTO opportunities (company_id, title, department, job_type, seniority, location, description, source_url, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scraped')`
      ).run(
        companyId,
        job.title,
        job.department || null,
        job.job_type || null,
        job.seniority || null,
        job.location || null,
        job.description || null,
        job.source_url || null
      );
      added++;
    }
  }

  // Mark opportunities not seen in this scrape as inactive
  const allActive = db
    .prepare(
      "SELECT id, title FROM opportunities WHERE company_id = ? AND is_active = 1 AND source = 'scraped'"
    )
    .all(companyId) as { id: number; title: string }[];

  let deactivated = 0;
  for (const opp of allActive) {
    if (!seenTitles.has(opp.title.toLowerCase().trim())) {
      db.prepare("UPDATE opportunities SET is_active = 0 WHERE id = ?").run(opp.id);
      deactivated++;
    }
  }

  return { added, deactivated };
}
