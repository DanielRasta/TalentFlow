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
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<\/(div|p|h[1-6]|li|tr|br)>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

// --- ATS direct-API fetchers ---

/** Try to detect and fetch from a known ATS embedded in the page HTML. */
async function tryAtsApiFetch(html: string): Promise<ParsedJob[] | null> {
  // Greenhouse
  const gh = html.match(/boards-api\.greenhouse\.io\/v1\/boards\/([a-zA-Z0-9_-]+)/);
  if (gh) {
    const slug = gh[1];
    console.log(`Detected Greenhouse board: ${slug}`);
    return fetchGreenhouseJobs(slug);
  }

  // Lever
  const lever = html.match(/jobs\.lever\.co\/([a-zA-Z0-9_-]+)/);
  if (lever) {
    const slug = lever[1];
    console.log(`Detected Lever board: ${slug}`);
    return fetchLeverJobs(slug);
  }

  // Ashby
  const ashby = html.match(/jobs\.ashbyhq\.com\/([a-zA-Z0-9_-]+)/);
  if (ashby) {
    const slug = ashby[1];
    console.log(`Detected Ashby board: ${slug}`);
    return fetchAshbyJobs(slug);
  }

  // Workable
  const workable = html.match(/apply\.workable\.com\/([a-zA-Z0-9_-]+)/);
  if (workable) {
    const slug = workable[1];
    console.log(`Detected Workable board: ${slug}`);
    return fetchWorkableJobs(slug);
  }

  return null;
}

async function fetchGreenhouseJobs(slug: string): Promise<ParsedJob[]> {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
  if (!res.ok) throw new Error(`Greenhouse API error: ${res.status}`);
  const data = await res.json() as { jobs: any[] };
  return (data.jobs || []).map((j: any) => ({
    title: j.title || '',
    department: j.departments?.[0]?.name || null,
    job_type: inferJobType(j.title, j.departments?.[0]?.name),
    seniority: inferSeniority(j.title),
    location: j.location?.name || null,
    description: stripHtml(j.content || '').substring(0, 1000),
    source_url: j.absolute_url || null,
  }));
}

async function fetchLeverJobs(slug: string): Promise<ParsedJob[]> {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!res.ok) throw new Error(`Lever API error: ${res.status}`);
  const data = await res.json() as any[];
  return (Array.isArray(data) ? data : []).map((j: any) => ({
    title: j.text || '',
    department: j.categories?.department || null,
    job_type: inferJobType(j.text, j.categories?.department),
    seniority: inferSeniority(j.text),
    location: j.categories?.location || j.country || null,
    description: j.descriptionPlain?.substring(0, 1000) || '',
    source_url: j.hostedUrl || null,
  }));
}

async function fetchAshbyJobs(slug: string): Promise<ParsedJob[]> {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch(`https://jobs.ashbyhq.com/api/non-user-graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      operationName: 'ApiJobBoardWithTeams',
      variables: { organizationHostedJobsPageName: slug },
      query: `query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
        jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {
          jobPostings { id title department { name } isRemote locationName descriptionHtml externalLink }
        }
      }`,
    }),
  });
  if (!res.ok) throw new Error(`Ashby API error: ${res.status}`);
  const data = await res.json() as any;
  const postings = data?.data?.jobBoard?.jobPostings || [];
  return postings.map((j: any) => ({
    title: j.title || '',
    department: j.department?.name || null,
    job_type: inferJobType(j.title, j.department?.name),
    seniority: inferSeniority(j.title),
    location: j.isRemote ? 'Remote' : (j.locationName || null),
    description: stripHtml(j.descriptionHtml || '').substring(0, 1000),
    source_url: j.externalLink || `https://jobs.ashbyhq.com/${slug}/${j.id}`,
  }));
}

async function fetchWorkableJobs(slug: string): Promise<ParsedJob[]> {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch(`https://apply.workable.com/api/v3/accounts/${slug}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '', location: [], department: [], worktype: [], remote: [] }),
  });
  if (!res.ok) throw new Error(`Workable API error: ${res.status}`);
  const data = await res.json() as any;
  return (data.results || []).map((j: any) => ({
    title: j.title || '',
    department: j.department || null,
    job_type: inferJobType(j.title, j.department),
    seniority: inferSeniority(j.title),
    location: j.location?.city || j.location?.country || null,
    description: '',
    source_url: `https://apply.workable.com/${slug}/j/${j.shortcode}`,
  }));
}

/** Infer job_type from title/department text. */
function inferJobType(title: string, department?: string | null): string {
  const text = `${title} ${department || ''}`.toLowerCase();
  if (/engineer|developer|devops|backend|frontend|full.?stack|software|data|ml|ai|infra|security/.test(text)) return 'engineering';
  if (/sales|account exec|business dev|revenue|closing/.test(text)) return 'sales';
  if (/market|growth|content|seo|brand|demand/.test(text)) return 'marketing';
  if (/design|ux|ui|product design|visual/.test(text)) return 'design';
  if (/product manager|pm\b|product owner/.test(text)) return 'product';
  if (/finance|account|fp&a|controller|cfo/.test(text)) return 'finance';
  if (/hr|people|recruit|talent|hrbp/.test(text)) return 'hr';
  if (/operations|ops|program manager|project manager/.test(text)) return 'operations';
  if (/data|analyst|analytics|bi\b/.test(text)) return 'data';
  return 'other';
}

/** Infer seniority from title text. */
function inferSeniority(title: string): string {
  const t = title.toLowerCase();
  if (/\bcto\b|\bceo\b|\bcpo\b|\bcfo\b|\bcoo\b|\bc-level/.test(t)) return 'c-level';
  if (/\bvp\b|vice president/.test(t)) return 'vp';
  if (/\bdirector\b/.test(t)) return 'director';
  if (/\blead\b|\bstaff\b|\bprincipal\b/.test(t)) return 'lead';
  if (/\bsenior\b|\bsr\.?\b/.test(t)) return 'senior';
  if (/\bjunior\b|\bjr\.?\b/.test(t)) return 'junior';
  return 'mid';
}

const UNSUPPORTED_WARNING = 'No job listings could be found automatically. This company\'s jobs may be hosted on a platform that requires a login or loads dynamically. Please add openings manually or paste individual job descriptions.';

/** Detect platforms we can't auto-scrape and return a user-friendly warning. */
function detectUnsupportedPlatform(html: string, allUrls: string[]): string | null {
  const combined = html.toLowerCase() + ' ' + allUrls.join(' ').toLowerCase();

  // Rippling ATS — fully JS-rendered, no public API
  if (/rippling-ats\.com/.test(combined) || /rippling\.com\/job-board/.test(combined)) {
    return UNSUPPORTED_WARNING;
  }

  // LinkedIn-only: careers page links to LinkedIn but has no known ATS embed
  const hasOnlyLinkedIn =
    combined.includes('linkedin.com/company') &&
    !combined.includes('greenhouse.io') &&
    !combined.includes('lever.co') &&
    !combined.includes('ashbyhq.com') &&
    !combined.includes('workable.com') &&
    !combined.includes('comeet.') &&
    !combined.includes('smartrecruiters.') &&
    !combined.includes('bamboohr.');

  if (hasOnlyLinkedIn) {
    return UNSUPPORTED_WARNING;
  }

  return null;
}

async function fetchAndParseJobsWithWarning(company: {
  id: number;
  name: string;
  website: string | null;
}): Promise<{ jobs: ParsedJob[]; warning?: string }> {
  if (!company.website) return { jobs: [] };

  const baseUrl = company.website.replace(/\/$/, '');
  const paths = ['', '/careers', '/jobs', '/openings', '/join', '/work-with-us'];
  const fetchedUrls: string[] = [];
  let rawHtml = '';

  for (const p of paths) {
    const url = `${baseUrl}${p}`;
    try {
      const html = await fetchWithTimeout(url);
      rawHtml += html;
      fetchedUrls.push(url);
    } catch (_) { /* skip */ }
  }

  const warning = detectUnsupportedPlatform(rawHtml, fetchedUrls) ?? undefined;
  if (warning) return { jobs: [], warning };

  const jobs = await fetchAndParseJobs(company);
  return { jobs };
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
  let rawHtml = '';

  for (const p of paths) {
    const url = `${baseUrl}${p}`;
    try {
      const html = await fetchWithTimeout(url);
      rawHtml += html;
      const text = stripHtml(html);
      pageText += `\n\n=== ${url} ===\n${text.substring(0, 8000)}`;
    } catch (err) {
      console.log(`Failed to fetch ${url}: ${(err as Error).message}`);
    }
  }

  if (!pageText.trim()) {
    console.log(`No content fetched for ${company.name}`);
    return [];
  }

  // Try ATS API first — more reliable than scraping dynamic pages
  try {
    const atsJobs = await tryAtsApiFetch(rawHtml);
    if (atsJobs && atsJobs.length > 0) {
      console.log(`Found ${atsJobs.length} jobs via ATS API for ${company.name}`);
      return atsJobs;
    }
  } catch (err) {
    console.warn(`ATS API fetch failed for ${company.name}, falling back to AI scrape:`, (err as Error).message);
  }

  // Fallback: send page text to Claude AI
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
  warning?: string;
}> {
  const company = db
    .prepare('SELECT id, name, website FROM companies WHERE id = ?')
    .get(companyId) as { id: number; name: string; website: string | null } | undefined;

  if (!company) {
    throw new Error(`Company ${companyId} not found`);
  }

  const { jobs, warning } = await fetchAndParseJobsWithWarning(company);

  if (jobs.length === 0) {
    return { added: 0, deactivated: 0, warning };
  }

  let added = 0;
  const seenTitles = new Set<string>();

  for (const job of jobs) {
    seenTitles.add(job.title.toLowerCase().trim());

    const existing = db
      .prepare(
        'SELECT id FROM opportunities WHERE company_id = ? AND LOWER(TRIM(title)) = LOWER(TRIM(?))'
      )
      .get(companyId, job.title) as { id: number } | undefined;

    if (existing) {
      db.prepare(
        `UPDATE opportunities
         SET last_seen_at = datetime('now'), is_active = 1,
             description = COALESCE(?, description),
             source_url = COALESCE(?, source_url),
             location = COALESCE(?, location)
         WHERE id = ?`
      ).run(job.description || null, job.source_url || null, job.location || null, existing.id);
    } else {
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

  return { added, deactivated, warning };
}
