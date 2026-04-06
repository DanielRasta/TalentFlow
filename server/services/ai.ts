import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-6';

/** Strip markdown code fences that Claude sometimes wraps JSON in. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

export interface ParsedResume {
  name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  headline: string;
  skills: string[];
  experience_years: number;
  job_types: string[];
  seniority: string;
  location: string | null;
}

export interface MatchScore {
  score: number;
  reasoning: string;
}

export interface ParsedJob {
  title: string;
  department: string | null;
  job_type: string;
  seniority: string;
  location: string | null;
  description: string;
  source_url: string | null;
}

export async function parseResume(resumeText: string): Promise<ParsedResume> {
  const prompt = `You are parsing a resume/CV. Extract the following structured data as JSON:
{
  "name": "string",
  "email": "string or null",
  "phone": "string or null",
  "linkedin_url": "string or null",
  "headline": "one-line professional summary, max 100 chars",
  "skills": ["skill1", "skill2", ...],
  "experience_years": number,
  "job_types": ["engineering", "sales", ...],
  "seniority": "junior|mid|senior|lead|director|vp|c-level",
  "location": "string or null"
}
Resume text:
---
${resumeText}
---
Return ONLY valid JSON, no other text.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from AI');
  }

  const jsonText = extractJson(content.text);
  return JSON.parse(jsonText) as ParsedResume;
}

export async function scoreMatch(
  candidate: {
    name: string;
    headline: string | null;
    skills: string | null;
    experience_years: number | null;
    job_types: string | null;
    seniority: string | null;
    location: string | null;
  },
  opportunity: {
    title: string;
    department: string | null;
    job_type: string | null;
    seniority: string | null;
    location: string | null;
    description: string | null;
  }
): Promise<MatchScore> {
  const prompt = `You are an expert recruiter evaluating candidate-job fit.
Think broadly about transferable skills.
Rate the match from 0.0 to 1.0 and explain in 1-2 sentences.
Candidate: ${JSON.stringify(candidate)}
Opportunity: ${JSON.stringify(opportunity)}
Return ONLY valid JSON: { "score": 0.0-1.0, "reasoning": "string" }`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from AI');
  }

  const jsonText = extractJson(content.text);
  return JSON.parse(jsonText) as MatchScore;
}

export async function draftIntroductionEmail(
  company: {
    name: string;
    contact_name: string | null;
    contact_email: string | null;
  },
  opportunity: {
    title: string;
    description: string | null;
  },
  candidate: {
    name: string;
    email: string | null;
    phone: string | null;
    linkedin_url: string | null;
    headline: string | null;
    skills: string | null;
    experience_years: number | null;
  }
): Promise<{ subject: string; body: string }> {
  // Build the contact block so the AI can embed it naturally
  const contactLines: string[] = [];
  if (candidate.linkedin_url) contactLines.push(`LinkedIn: ${candidate.linkedin_url}`);
  if (candidate.email)        contactLines.push(`Email: ${candidate.email}`);
  if (candidate.phone)        contactLines.push(`Phone: ${candidate.phone}`);
  const contactBlock = contactLines.length > 0 ? contactLines.join(' | ') : 'No contact details on file';

  const prompt = `You are a VC sending a short, punchy candidate suggestion to a portfolio company. The candidate does NOT know about this email. Our AI matchmaking system flagged this person for the role.

INPUTS
Contact: ${company.contact_name || 'Hi'}
Company: ${company.name}
Role: ${opportunity.title}
Candidate: ${candidate.name}
Headline: ${candidate.headline || 'N/A'}
Top skills: ${candidate.skills || 'N/A'}
Contact details: ${contactBlock}

RULES
- 3–4 sentences MAX — no fluff, no filler, no interpretation
- First sentence: who you are suggesting and for which role
- Second sentence: one sharp reason why they fit based on the AI reasoning
- Third sentence (or inline): ALL available contact details (${contactBlock}) — embed every non-null contact naturally
- Do NOT use bullet points or headers
- Stay objective and factual, do not recommand, push, urge, or solicitate in any way
- Do mention that you are using an AI internal system, and that the engine flagged this as a match from your pool of recommanded candidates

Output ONLY the email body, no subject line.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from AI');
  }

  const body = content.text.trim();
  const subject = `Candidate Suggestion: ${candidate.name} for ${opportunity.title} at ${company.name}`;

  return { subject, body };
}

export async function parseJobsFromPage(pageText: string): Promise<ParsedJob[]> {
  const prompt = `You are parsing a careers/jobs page. Extract all job openings as a JSON array.
For each job, capture the direct URL to the individual job posting if available.
[
  {
    "title": "string",
    "department": "string or null",
    "job_type": "engineering|sales|marketing|design|operations|finance|product|data|hr|other",
    "seniority": "junior|mid|senior|lead|director|vp|c-level",
    "location": "string or null",
    "description": "string",
    "source_url": "string or null"
  }
]
Page content:
---
${pageText}
---
Return ONLY valid JSON array.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from AI');
  }

  const jsonText = extractJson(content.text);
  return JSON.parse(jsonText) as ParsedJob[];
}
