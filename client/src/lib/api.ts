// Typed API wrapper for VC Talent Match

export interface Company {
  id: number;
  name: string;
  website: string | null;
  linkedin_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  logo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  open_roles?: number;
}

export interface Opportunity {
  id: number;
  company_id: number;
  title: string;
  department: string | null;
  job_type: string | null;
  seniority: string | null;
  location: string | null;
  description: string | null;
  source_url: string | null;
  source: string;
  is_active: number;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  company_name?: string;
  company_contact_email?: string;
}

export interface Candidate {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  resume_path: string | null;
  resume_text: string | null;
  headline: string | null;
  skills: string | null;
  experience_years: number | null;
  job_types: string | null;
  seniority: string | null;
  location: string | null;
  notes: string | null;
  source: string;
  expires_at: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: number;
  candidate_id: number;
  opportunity_id: number;
  score: number | null;
  reasoning: string | null;
  status: string;
  dismissed_at: string | null;
  introduced_at: string | null;
  created_at: string;
  candidate_name?: string;
  candidate_headline?: string;
  candidate_email?: string;
  candidate_linkedin?: string;
  candidate_skills?: string;
  candidate_seniority?: string;
  opportunity_title?: string;
  opportunity_job_type?: string;
  opportunity_location?: string;
  company_id?: number;
  company_name?: string;
  company_contact_email?: string;
  company_contact_name?: string;
}

export interface Introduction {
  id: number;
  match_id: number;
  to_email: string;
  subject: string;
  body: string;
  created_at: string;
  candidate_name?: string;
  opportunity_title?: string;
  company_name?: string;
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

export interface UploadResult {
  resume_path: string;
  resume_text: string;
  parsed: ParsedResume | null;
  error?: string;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Companies
export const getCompanies = () => request<Company[]>('/api/companies');
export const createCompany = (data: Partial<Company>) =>
  request<Company>('/api/companies', { method: 'POST', body: JSON.stringify(data) });
export const updateCompany = (id: number, data: Partial<Company>) =>
  request<Company>(`/api/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCompany = (id: number) =>
  request<{ success: boolean }>(`/api/companies/${id}`, { method: 'DELETE' });
export const refreshCompanyJobs = (id: number) =>
  request<{ success: boolean; added: number; deactivated: number }>(
    `/api/companies/${id}/refresh`,
    { method: 'POST' }
  );
export const refreshAllJobs = () =>
  request<{ success: boolean; results: any[] }>('/api/companies/refresh-all', { method: 'POST' });

// Opportunities
export const getOpportunities = (params?: {
  company_id?: number;
  job_type?: string;
  is_active?: boolean;
}) => {
  const query = new URLSearchParams();
  if (params?.company_id) query.set('company_id', String(params.company_id));
  if (params?.job_type) query.set('job_type', params.job_type);
  if (params?.is_active !== undefined) query.set('is_active', String(params.is_active));
  const qs = query.toString();
  return request<Opportunity[]>(`/api/opportunities${qs ? `?${qs}` : ''}`);
};
export const createOpportunity = (data: Partial<Opportunity>) =>
  request<Opportunity>('/api/opportunities', { method: 'POST', body: JSON.stringify(data) });
export const updateOpportunity = (id: number, data: Partial<Opportunity>) =>
  request<Opportunity>(`/api/opportunities/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteOpportunity = (id: number) =>
  request<{ success: boolean }>(`/api/opportunities/${id}`, { method: 'DELETE' });
export const toggleOpportunityActive = (id: number) =>
  request<Opportunity>(`/api/opportunities/${id}/toggle-active`, { method: 'PATCH' });

// Candidates
export const getCandidates = (status?: 'active' | 'expired' | 'all') => {
  const query = status && status !== 'all' ? `?status=${status}` : '';
  return request<Candidate[]>(`/api/candidates${query}`);
};
export const createCandidate = (data: Partial<Candidate>) =>
  request<Candidate>('/api/candidates', { method: 'POST', body: JSON.stringify(data) });
export const uploadCandidate = (file: File) => {
  const formData = new FormData();
  formData.append('resume', file);
  return fetch('/api/candidates/upload', { method: 'POST', body: formData }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json() as Promise<UploadResult>;
  });
};
export const updateCandidate = (id: number, data: Partial<Candidate>) =>
  request<Candidate>(`/api/candidates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCandidate = (id: number) =>
  request<{ success: boolean }>(`/api/candidates/${id}`, { method: 'DELETE' });
export const reactivateCandidate = (id: number, expires_at?: string) =>
  request<Candidate>(`/api/candidates/${id}/reactivate`, {
    method: 'PATCH',
    body: JSON.stringify({ expires_at }),
  });

// Matches
export const getMatches = (params?: {
  company_id?: number;
  job_type?: string;
  status?: string;
  show_dismissed?: boolean;
}) => {
  const query = new URLSearchParams();
  if (params?.company_id) query.set('company_id', String(params.company_id));
  if (params?.job_type) query.set('job_type', params.job_type);
  if (params?.status) query.set('status', params.status);
  if (params?.show_dismissed) query.set('show_dismissed', 'true');
  const qs = query.toString();
  return request<Match[]>(`/api/matches${qs ? `?${qs}` : ''}`);
};
export const runMatching = () =>
  request<{ message: string; added: number; skipped: number; errors?: string[] }>(
    '/api/matches/run',
    { method: 'POST' }
  );
export const dismissMatch = (id: number) =>
  request<{ success: boolean }>(`/api/matches/${id}/dismiss`, { method: 'POST' });
export const introduceMatch = (id: number) =>
  request<{ to: string; subject: string; body: string }>(`/api/matches/${id}/introduce`, {
    method: 'POST',
  });
export const getIntroduction = (matchId: number) =>
  request<Introduction>(`/api/matches/${matchId}/introduction`);

// Introductions
export const getIntroductions = () => request<Introduction[]>('/api/introductions');
export const logIntroduction = (data: {
  match_id: number;
  to_email: string;
  subject: string;
  body: string;
}) =>
  request<Introduction>('/api/introductions', { method: 'POST', body: JSON.stringify(data) });
