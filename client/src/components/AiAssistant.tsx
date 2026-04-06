import { useEffect, useState } from 'react';
import { useCopilotReadable, useCopilotAction } from '@copilotkit/react-core';
import { CopilotPopup } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import {
  getCandidates, createCandidate, updateCandidate, deleteCandidate,
  getOpportunities, createOpportunity, updateOpportunity, deleteOpportunity,
  getCompanies, getMatches, runMatching,
  Candidate, Opportunity, Company, Match,
} from '../lib/api';
import toast from 'react-hot-toast';

export default function AiAssistant() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  const refresh = async () => {
    const [c, o, co, m] = await Promise.all([
      getCandidates('all'),
      getOpportunities(),
      getCompanies(),
      getMatches({ status: 'pending' }),
    ]);
    setCandidates(c);
    setOpportunities(o);
    setCompanies(co);
    setMatches(m);
  };

  useEffect(() => { refresh(); }, []);

  // --- Context for the AI ---

  useCopilotReadable({
    description: 'All candidates in the talent pipeline, including name, email, headline, skills, seniority, location, source, and status',
    value: candidates.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      headline: c.headline,
      skills: c.skills,
      seniority: c.seniority,
      location: c.location,
      source: c.source,
      is_active: c.is_active,
      is_executive: c.is_executive,
      expires_at: c.expires_at,
    })),
  });

  useCopilotReadable({
    description: 'All open job opportunities across portfolio companies, including title, company, department, seniority, location, and job type',
    value: opportunities.map(o => ({
      id: o.id,
      company_id: o.company_id,
      company_name: o.company_name,
      title: o.title,
      department: o.department,
      job_type: o.job_type,
      seniority: o.seniority,
      location: o.location,
      is_active: o.is_active,
    })),
  });

  useCopilotReadable({
    description: 'Existing candidate-opportunity matches with scores (0-1), sorted by score descending. Use this to answer questions about matches, top matches, or best-fit candidates.',
    value: matches
      .slice()
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .map(m => ({
        id: m.id,
        score: m.score,
        candidate_name: m.candidate_name,
        candidate_headline: m.candidate_headline,
        candidate_skills: m.candidate_skills,
        candidate_seniority: m.candidate_seniority,
        opportunity_title: m.opportunity_title,
        opportunity_location: m.opportunity_location,
        reasoning: m.reasoning,
        status: m.status,
      })),
  });

  useCopilotReadable({
    description: 'Portfolio companies tracked in the system',
    value: companies.map(c => ({
      id: c.id,
      name: c.name,
      website: c.website,
      open_roles: c.open_roles,
    })),
  });

  // --- Candidate actions ---

  useCopilotAction({
    name: 'addCandidate',
    description: 'Add a new candidate to the talent pipeline',
    parameters: [
      { name: 'name', type: 'string', description: 'Full name', required: true },
      { name: 'email', type: 'string', description: 'Email address' },
      { name: 'phone', type: 'string', description: 'Phone number' },
      { name: 'headline', type: 'string', description: 'Professional headline or current title' },
      { name: 'skills', type: 'string', description: 'Comma-separated list of skills' },
      { name: 'seniority', type: 'string', description: 'One of: junior, mid, senior, lead, director, vp, c-level' },
      { name: 'location', type: 'string', description: 'City or country' },
      { name: 'source', type: 'string', description: 'Where/how the candidate was sourced' },
      { name: 'notes', type: 'string', description: 'Additional notes about the candidate' },
      { name: 'is_executive', type: 'boolean', description: 'True if the candidate is VP or C-Level' },
    ],
    handler: async (data) => {
      try {
        const candidate = await createCandidate(data as any);
        setCandidates(prev => [candidate, ...prev]);
        toast.success(`Added ${candidate.name}`);
        return `✓ Added candidate "${candidate.name}" (ID: ${candidate.id})`;
      } catch (err) {
        return `Error: ${(err as Error).message}`;
      }
    },
  });

  useCopilotAction({
    name: 'updateCandidate',
    description: 'Update an existing candidate\'s details. Use the candidate ID.',
    parameters: [
      { name: 'id', type: 'number', description: 'Candidate ID', required: true },
      { name: 'name', type: 'string', description: 'Full name' },
      { name: 'email', type: 'string', description: 'Email address' },
      { name: 'headline', type: 'string', description: 'Professional headline' },
      { name: 'skills', type: 'string', description: 'Comma-separated skills' },
      { name: 'seniority', type: 'string', description: 'One of: junior, mid, senior, lead, director, vp, c-level' },
      { name: 'location', type: 'string', description: 'Location' },
      { name: 'source', type: 'string', description: 'Source' },
      { name: 'notes', type: 'string', description: 'Notes' },
      { name: 'is_executive', type: 'boolean', description: 'Executive flag' },
    ],
    handler: async ({ id, ...fields }) => {
      try {
        const updated = await updateCandidate(id, fields as any);
        setCandidates(prev => prev.map(c => c.id === id ? updated : c));
        toast.success(`Updated ${updated.name}`);
        return `✓ Updated candidate "${updated.name}"`;
      } catch (err) {
        return `Error: ${(err as Error).message}`;
      }
    },
  });

  useCopilotAction({
    name: 'deleteCandidate',
    description: 'Delete a candidate by ID',
    parameters: [
      { name: 'id', type: 'number', description: 'Candidate ID to delete', required: true },
    ],
    handler: async ({ id }) => {
      try {
        const candidate = candidates.find(c => c.id === id);
        await deleteCandidate(id);
        setCandidates(prev => prev.filter(c => c.id !== id));
        toast.success(`Deleted ${candidate?.name ?? 'candidate'}`);
        return `✓ Deleted candidate "${candidate?.name ?? id}"`;
      } catch (err) {
        return `Error: ${(err as Error).message}`;
      }
    },
  });

  // --- Opportunity actions ---

  useCopilotAction({
    name: 'addOpportunity',
    description: 'Add a new job opportunity to a portfolio company',
    parameters: [
      { name: 'company_id', type: 'number', description: 'Company ID (from the companies list)', required: true },
      { name: 'title', type: 'string', description: 'Job title', required: true },
      { name: 'department', type: 'string', description: 'Department (e.g. Engineering, Sales)' },
      { name: 'job_type', type: 'string', description: 'Job type (e.g. engineering, sales, marketing)' },
      { name: 'seniority', type: 'string', description: 'Seniority level' },
      { name: 'location', type: 'string', description: 'Location or Remote' },
      { name: 'description', type: 'string', description: 'Job description' },
    ],
    handler: async (data) => {
      try {
        const opp = await createOpportunity(data as any);
        setOpportunities(prev => [opp, ...prev]);
        toast.success(`Added opportunity: ${opp.title}`);
        return `✓ Added opportunity "${opp.title}" (ID: ${opp.id})`;
      } catch (err) {
        return `Error: ${(err as Error).message}`;
      }
    },
  });

  useCopilotAction({
    name: 'updateOpportunity',
    description: 'Update an existing job opportunity',
    parameters: [
      { name: 'id', type: 'number', description: 'Opportunity ID', required: true },
      { name: 'title', type: 'string', description: 'Job title' },
      { name: 'department', type: 'string', description: 'Department' },
      { name: 'job_type', type: 'string', description: 'Job type' },
      { name: 'seniority', type: 'string', description: 'Seniority level' },
      { name: 'location', type: 'string', description: 'Location' },
      { name: 'description', type: 'string', description: 'Job description' },
    ],
    handler: async ({ id, ...fields }) => {
      try {
        const updated = await updateOpportunity(id, fields as any);
        setOpportunities(prev => prev.map(o => o.id === id ? updated : o));
        toast.success(`Updated: ${updated.title}`);
        return `✓ Updated opportunity "${updated.title}"`;
      } catch (err) {
        return `Error: ${(err as Error).message}`;
      }
    },
  });

  useCopilotAction({
    name: 'deleteOpportunity',
    description: 'Delete a job opportunity by ID',
    parameters: [
      { name: 'id', type: 'number', description: 'Opportunity ID to delete', required: true },
    ],
    handler: async ({ id }) => {
      try {
        const opp = opportunities.find(o => o.id === id);
        await deleteOpportunity(id);
        setOpportunities(prev => prev.filter(o => o.id !== id));
        toast.success(`Deleted: ${opp?.title ?? 'opportunity'}`);
        return `✓ Deleted opportunity "${opp?.title ?? id}"`;
      } catch (err) {
        return `Error: ${(err as Error).message}`;
      }
    },
  });

  // --- Matching ---

  useCopilotAction({
    name: 'runMatching',
    description: 'Run the AI matching algorithm to find candidate-opportunity matches',
    parameters: [],
    handler: async () => {
      try {
        const result = await runMatching();
        const updated = await getMatches({ status: 'pending' });
        setMatches(updated);
        toast.success(`Matching complete: ${result.added} new matches`);
        return `✓ Matching complete — ${result.added} new matches found, ${result.skipped} skipped. The matches context has been refreshed.`;
      } catch (err) {
        return `Error: ${(err as Error).message}`;
      }
    },
  });

  return (
    <CopilotPopup
      instructions={`You are TalentFlow AI, an intelligent assistant for a VC talent matching platform. You help users manage their talent pipeline.

You have access to:
- All candidates with their details (name, skills, seniority, location, etc.)
- All job opportunities at portfolio companies
- All portfolio companies
- Existing matches (pre-scored candidate-opportunity pairs, sorted by score descending)

You can:
- Add, update, or delete candidates
- Add, update, or delete job opportunities
- Run the AI matching algorithm to find NEW matches (only call runMatching when explicitly asked to run/generate matches)

IMPORTANT: To answer questions about existing matches (e.g. "highest score matches", "best fits", "top matches"), read the matches context directly — do NOT call runMatching. Only call runMatching when the user explicitly asks to run or generate new matches.

Be concise, helpful, and proactive. When listing records, summarize the most relevant fields clearly.`}
      labels={{
        title: '✨ TalentFlow AI',
        initial: "Hi! I'm your AI talent assistant. I can help you manage candidates, opportunities, and find the best matches. What would you like to do?",
      }}
    />
  );
}
