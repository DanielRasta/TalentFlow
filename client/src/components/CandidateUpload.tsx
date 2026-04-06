import { useState, useRef, useEffect } from 'react';
import { uploadCandidate, uploadCandidateFile, createCandidate, updateCandidate, parseProfileText, getCandidateSources, Candidate, ParsedResume } from '../lib/api';
import toast from 'react-hot-toast';

interface CandidateUploadProps {
  onSuccess: (candidate: Candidate) => void;
  onClose: () => void;
  candidate?: Candidate; // when set, component is in edit mode
}

const JOB_TYPE_OPTIONS = ['engineering', 'sales', 'marketing', 'design', 'product', 'operations', 'finance', 'data', 'hr', 'other'];
const SENIORITY_OPTIONS = ['junior', 'mid', 'senior', 'lead', 'director', 'vp', 'c-level'];

const EXECUTIVE_SENIORITIES = ['vp', 'c-level'];

const defaultForm = {
  name: '',
  email: '',
  phone: '',
  linkedin_url: '',
  headline: '',
  skills: '',
  experience_years: '',
  job_types: [] as string[],
  seniority: '',
  location: '',
  source: '',
  notes: '',
  expires_at: '',
  resume_path: '',
  resume_text: '',
  is_executive: false,
};

export default function CandidateUpload({ onSuccess, onClose, candidate }: CandidateUploadProps) {
  const isEdit = !!candidate;
  const [mode, setMode] = useState<'choose' | 'upload' | 'manual' | 'linkedin'>(isEdit ? 'upload' : 'choose');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [linkedinText, setLinkedinText] = useState('');
  const [parsingLinkedin, setParsingLinkedin] = useState(false);
  const [historicalSources, setHistoricalSources] = useState<string[]>([]);

  useEffect(() => {
    getCandidateSources().then(setHistoricalSources).catch(() => {});
  }, []);
  const [uploading, setUploading] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() =>
    candidate ? {
      name: candidate.name || '',
      email: candidate.email || '',
      phone: candidate.phone || '',
      linkedin_url: candidate.linkedin_url || '',
      headline: candidate.headline || '',
      skills: candidate.skills || '',
      experience_years: String(candidate.experience_years || ''),
      job_types: candidate.job_types ? candidate.job_types.split(',').map(s => s.trim()).filter(Boolean) : [],
      seniority: candidate.seniority || '',
      location: candidate.location || '',
      source: candidate.source || '',
      is_executive: !!candidate.is_executive,
      notes: candidate.notes || '',
      expires_at: candidate.expires_at || '',
      resume_path: candidate.resume_path || '',
      resume_text: candidate.resume_text || '',
    } : defaultForm
  );
  const [parsedData, setParsedData] = useState<ParsedResume | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cvFileRef = useRef<HTMLInputElement>(null);

  const cvFilename = (resumePath: string | null | undefined) => {
    if (!resumePath) return null;
    return resumePath.split('/').pop() || null;
  };

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCvUploading(true);
    try {
      const result = await uploadCandidateFile(file);
      setForm((f) => ({ ...f, resume_path: result.resume_path }));
      toast.success('CV uploaded');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCvUploading(false);
      if (cvFileRef.current) cvFileRef.current.value = '';
    }
  };

  // Default expiry: 90 days from now
  const defaultExpiry = () => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().split('T')[0];
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadCandidate(file);

      if (result.parsed) {
        setParsedData(result.parsed);
        setForm({
          name: result.parsed.name || '',
          email: result.parsed.email || '',
          phone: result.parsed.phone || '',
          linkedin_url: result.parsed.linkedin_url || '',
          headline: result.parsed.headline || '',
          skills: Array.isArray(result.parsed.skills) ? result.parsed.skills.join(', ') : '',
          experience_years: String(result.parsed.experience_years || ''),
          job_types: Array.isArray(result.parsed.job_types) ? result.parsed.job_types : [],
          seniority: result.parsed.seniority || '',
          location: result.parsed.location || '',
          notes: '',
          expires_at: defaultExpiry(),
          resume_path: result.resume_path || '',
          resume_text: result.resume_text || '',
          source: '',
          is_executive: EXECUTIVE_SENIORITIES.includes((result.parsed.seniority || '').toLowerCase()),
        });
        toast.success('Resume parsed successfully — please review and save');
      } else {
        toast.error(result.error || 'Could not parse resume — please fill in manually');
        setForm({ ...defaultForm, resume_path: result.resume_path, resume_text: result.resume_text, expires_at: defaultExpiry() });
      }
      setMode('upload');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleLinkedinParse = async () => {
    if (!linkedinText.trim()) {
      toast.error('Please paste the profile text first');
      return;
    }
    setParsingLinkedin(true);
    try {
      const result = await parseProfileText(linkedinText, linkedinUrl);
      setParsedData(result.parsed);
      setForm({
        name: result.parsed.name || '',
        email: result.parsed.email || '',
        phone: result.parsed.phone || '',
        linkedin_url: result.parsed.linkedin_url || linkedinUrl || '',
        headline: result.parsed.headline || '',
        skills: Array.isArray(result.parsed.skills) ? result.parsed.skills.join(', ') : '',
        experience_years: String(result.parsed.experience_years || ''),
        job_types: Array.isArray(result.parsed.job_types) ? result.parsed.job_types : [],
        seniority: result.parsed.seniority || '',
        location: result.parsed.location || '',
        notes: '',
        expires_at: defaultExpiry(),
        resume_path: '',
        resume_text: linkedinText,
        source: '',
        is_executive: EXECUTIVE_SENIORITIES.includes((result.parsed.seniority || '').toLowerCase()),
      });
      setMode('upload');
      toast.success('Profile parsed — please review and save');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setParsingLinkedin(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        linkedin_url: form.linkedin_url || undefined,
        headline: form.headline || undefined,
        skills: form.skills || undefined,
        experience_years: form.experience_years ? parseInt(form.experience_years) : undefined,
        job_types: form.job_types.length > 0 ? form.job_types.join(', ') : undefined,
        seniority: form.seniority || undefined,
        location: form.location || undefined,
        notes: form.notes || undefined,
        expires_at: form.expires_at || undefined,
        resume_path: form.resume_path || undefined,
        resume_text: form.resume_text || undefined,
        source: form.source || (parsedData ? 'pdf_upload' : 'manual'),
        is_executive: form.is_executive ? 1 : 0,
      };
      const saved = isEdit
        ? await updateCandidate(candidate!.id, payload as any)
        : await createCandidate(payload as any);
      toast.success(isEdit ? 'Candidate updated' : 'Candidate added');
      onSuccess(saved);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleJobType = (jt: string) => {
    setForm((f) => ({
      ...f,
      job_types: f.job_types.includes(jt)
        ? f.job_types.filter((x) => x !== jt)
        : [...f.job_types, jt],
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">{isEdit ? 'Edit Candidate' : 'Add Candidate'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode Selection */}
        {mode === 'choose' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
            <div className="grid grid-cols-3 gap-4 w-full max-w-xl">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-colors group"
              >
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center group-hover:bg-indigo-200">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="font-medium text-slate-900 text-sm">Upload PDF</div>
                  <div className="text-slate-500 text-xs mt-1">AI parses resume</div>
                </div>
              </button>

              <button
                onClick={() => { setLinkedinUrl(''); setLinkedinText(''); setMode('linkedin'); }}
                className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-colors group"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200">
                  <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </div>
                <div className="text-center">
                  <div className="font-medium text-slate-900 text-sm">LinkedIn Profile</div>
                  <div className="text-slate-500 text-xs mt-1">Paste profile text</div>
                </div>
              </button>

              <button
                onClick={() => { setForm({ ...defaultForm, expires_at: defaultExpiry() }); setMode('manual'); }}
                className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-colors group"
              >
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-indigo-100">
                  <svg className="w-6 h-6 text-slate-600 group-hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="font-medium text-slate-900 text-sm">Manual Entry</div>
                  <div className="text-slate-500 text-xs mt-1">Fill in details</div>
                </div>
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileUpload}
            />
            {uploading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Parsing resume with AI...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LinkedIn mode */}
        {mode === 'linkedin' && (
          <div className="flex-1 overflow-auto p-6 space-y-4">
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
              <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              <span>Open the LinkedIn profile in your browser, select all text on the page <strong>(Cmd+A → Cmd+C)</strong>, then paste it below. Claude will extract the candidate's details automatically.</span>
            </div>

            <div>
              <label className="label">LinkedIn Profile URL</label>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className="input"
                placeholder="https://linkedin.com/in/username"
              />
            </div>

            <div>
              <label className="label">Paste Profile Text *</label>
              <textarea
                value={linkedinText}
                onChange={(e) => setLinkedinText(e.target.value)}
                className="input resize-none font-mono text-xs"
                rows={10}
                placeholder="Paste the full text copied from the LinkedIn profile page here..."
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={() => setMode('choose')} className="btn-secondary">Back</button>
              <button
                type="button"
                onClick={handleLinkedinParse}
                disabled={parsingLinkedin || !linkedinText.trim()}
                className="btn-primary"
              >
                {parsingLinkedin ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Parsing with AI...
                  </span>
                ) : 'Extract Profile'}
              </button>
            </div>
          </div>
        )}

        {/* Form (both upload review and manual) */}
        {(mode === 'upload' || mode === 'manual') && (
          <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-6 space-y-4">
            {parsedData && (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-lg text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Resume parsed by AI — please review the fields below
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Jane Smith" required />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" placeholder="jane@example.com" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Phone</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" placeholder="+1 555 000 0000" />
              </div>
              <div>
                <label className="label">LinkedIn URL</label>
                <input type="url" value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} className="input" placeholder="https://linkedin.com/in/..." />
              </div>
            </div>

            <div>
              <label className="label">Headline</label>
              <input type="text" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} className="input" placeholder="Senior Software Engineer with 8 years in fintech" />
            </div>

            <div>
              <label className="label">Skills (comma-separated)</label>
              <input type="text" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} className="input" placeholder="React, TypeScript, Node.js, PostgreSQL" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Experience (years)</label>
                <input type="number" value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: e.target.value })} className="input" placeholder="5" min="0" max="50" />
              </div>
              <div>
                <label className="label">Seniority</label>
                <select
                  value={form.seniority}
                  onChange={(e) => {
                    const s = e.target.value;
                    setForm({ ...form, seniority: s, is_executive: EXECUTIVE_SENIORITIES.includes(s.toLowerCase()) });
                  }}
                  className="input"
                >
                  <option value="">Select...</option>
                  {SENIORITY_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Location</label>
                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input" placeholder="San Francisco, CA" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_executive"
                checked={form.is_executive}
                onChange={(e) => setForm({ ...form, is_executive: e.target.checked })}
                className="w-4 h-4 accent-indigo-600"
              />
              <label htmlFor="is_executive" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                👔 Executive (VP / C-Level)
              </label>
            </div>

            <div>
              <label className="label">Job Types</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {JOB_TYPE_OPTIONS.map((jt) => (
                  <button
                    key={jt}
                    type="button"
                    onClick={() => toggleJobType(jt)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      form.job_types.includes(jt)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {jt}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Expires At</label>
                <input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="input" />
              </div>
            </div>

            <div>
              <label className="label">Source</label>
              <input
                type="text"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                className="input"
                placeholder="e.g. TechCrunch Disrupt, LinkedIn, Referral from John"
                list="source-suggestions"
              />
              <datalist id="source-suggestions">
                {historicalSources.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>

            <div>
              <label className="label">CV / Resume (PDF)</label>
              <div className="flex items-center gap-3">
                {form.resume_path ? (
                  <div className="flex items-center gap-2 flex-1 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="truncate">{cvFilename(form.resume_path)}</span>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, resume_path: '' })}
                      className="ml-auto text-green-600 hover:text-red-500 shrink-0"
                      title="Remove CV"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <span className="text-sm text-slate-400 flex-1">No CV attached</span>
                )}
                <button
                  type="button"
                  onClick={() => cvFileRef.current?.click()}
                  disabled={cvUploading}
                  className="btn-secondary btn-sm shrink-0"
                >
                  {cvUploading ? 'Uploading...' : form.resume_path ? 'Replace' : 'Attach PDF'}
                </button>
              </div>
              <input ref={cvFileRef} type="file" accept=".pdf" className="hidden" onChange={handleCvUpload} />
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input resize-none" rows={2} placeholder="Any additional notes..." />
            </div>

            <div className="flex items-center justify-between pt-2">
              {!isEdit && (
                <button
                  type="button"
                  onClick={() => { setMode('choose'); setParsedData(null); setForm(defaultForm); setLinkedinUrl(''); setLinkedinText(''); }}
                  className="btn-secondary"
                >
                  Back
                </button>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Candidate'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
