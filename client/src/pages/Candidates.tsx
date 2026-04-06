import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getCandidates, deleteCandidate, reactivateCandidate, Candidate } from '../lib/api';
import CandidateUpload from '../components/CandidateUpload';
import ExpiryBadge from '../components/ExpiryBadge';

type Tab = 'active' | 'expired' | 'all';

export default function Candidates() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('active');
  const [showUpload, setShowUpload] = useState(false);
  const [editCandidate, setEditCandidate] = useState<Candidate | undefined>(undefined);
  const [reactivatingId, setReactivatingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = async (t: Tab = tab) => {
    setLoading(true);
    try {
      const data = await getCandidates(t);
      setCandidates(data);
    } catch (err) {
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(tab); }, [tab]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this candidate?')) return;
    try {
      await deleteCandidate(id);
      setCandidates((prev) => prev.filter((c) => c.id !== id));
      toast.success('Candidate deleted');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleReactivate = async (id: number) => {
    setReactivatingId(id);
    try {
      const updated = await reactivateCandidate(id);
      setCandidates((prev) => prev.map((c) => (c.id === id ? updated : c)));
      toast.success('Candidate reactivated');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setReactivatingId(null);
    }
  };

  const isExpiringSoon = (c: Candidate) => {
    if (!c.expires_at || !c.is_active) return false;
    const now = new Date();
    const exp = new Date(c.expires_at);
    const days = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 7;
  };

  const parseSkills = (skills: string | null): string[] => {
    if (!skills) return [];
    return skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Candidates</h1>
          <p className="text-slate-500 mt-1">Manage your talent pipeline</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Candidate
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(['active', 'expired', 'all'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse flex gap-4 items-center">
                <div className="w-10 h-10 bg-slate-200 rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-slate-200 rounded w-40" />
                  <div className="h-3 bg-slate-100 rounded w-64" />
                </div>
              </div>
            ))}
          </div>
        ) : candidates.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-10 h-10 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-slate-500 text-sm">No candidates in this view</p>
            {tab === 'active' && (
              <button onClick={() => setShowUpload(true)} className="btn-primary mt-3">
                Add first candidate
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="table-header">Name</th>
                <th className="table-header">Headline</th>
                <th className="table-header">Location</th>
                <th className="table-header">Source</th>
                <th className="table-header">Status</th>
                <th className="table-header sticky right-0 bg-slate-50 shadow-[-1px_0_0_#e2e8f0]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((candidate) => (
                <>
                  <tr
                    key={candidate.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      isExpiringSoon(candidate) ? 'bg-yellow-50/50' : ''
                    }`}
                  >
                    <td className="table-cell">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-900">{candidate.name}</span>
                          {!!candidate.is_executive && (
                            <span title="Executive (VP / C-Level)" className="text-base leading-none">👔</span>
                          )}
                          {candidate.linkedin_url && (
                            <a
                              href={candidate.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open LinkedIn profile"
                              className="text-[#0A66C2] hover:opacity-75 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                              </svg>
                            </a>
                          )}
                        </div>
                        {candidate.email && (
                          <div className="text-xs text-slate-500">{candidate.email}</div>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <p className="text-sm text-slate-600 max-w-xs truncate">
                        {candidate.headline || '—'}
                      </p>
                    </td>
                    <td className="table-cell text-slate-600">{candidate.location || '—'}</td>
                    <td className="table-cell">
                      <span className="text-xs text-slate-500">{candidate.source || '—'}</span>
                    </td>
                    <td className="table-cell">
                      <ExpiryBadge expiresAt={candidate.expires_at} isActive={candidate.is_active} />
                    </td>
                    <td className="table-cell sticky right-0 bg-white shadow-[-1px_0_0_#e2e8f0]">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedId(expandedId === candidate.id ? null : candidate.id)}
                          className="btn-secondary btn-sm"
                        >
                          {expandedId === candidate.id ? 'Hide' : 'View'}
                        </button>
                        <button
                          onClick={() => setEditCandidate(candidate)}
                          className="btn-secondary btn-sm"
                        >
                          Edit
                        </button>
                        {!candidate.is_active && (
                          <button
                            onClick={() => handleReactivate(candidate.id)}
                            disabled={reactivatingId === candidate.id}
                            className="btn-primary btn-sm"
                          >
                            {reactivatingId === candidate.id ? 'Reactivating...' : 'Reactivate'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(candidate.id)}
                          className="btn-danger btn-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === candidate.id && (
                    <tr key={`${candidate.id}-expanded`} className="bg-slate-50">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="grid grid-cols-3 gap-6 text-sm">
                          <div>
                            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Contact</div>
                            {candidate.phone && <div className="text-slate-700">{candidate.phone}</div>}
                            {candidate.linkedin_url && (
                              <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer"
                                className="text-indigo-600 hover:underline text-xs">LinkedIn</a>
                            )}
                            {candidate.resume_path && (
                              <a
                                href={`/uploads/${candidate.resume_path.split('/').pop()}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-indigo-600 hover:underline text-xs mt-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                                </svg>
                                Download CV
                              </a>
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Experience</div>
                            <div className="text-slate-700">
                              {candidate.experience_years ? `${candidate.experience_years} years` : '—'}
                            </div>
                            <div className="text-xs text-slate-500 capitalize">{candidate.job_types || '—'}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Notes</div>
                            <div className="text-slate-600 text-xs">{candidate.notes || 'No notes'}</div>
                          </div>
                          {candidate.skills && (
                            <div className="col-span-3">
                              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">All Skills</div>
                              <div className="flex flex-wrap gap-1">
                                {candidate.skills.split(',').map((s) => s.trim()).filter(Boolean).map((skill) => (
                                  <span key={skill} className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-medium">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showUpload && (
        <CandidateUpload
          onSuccess={(c) => {
            setCandidates((prev) => [c, ...prev]);
            setShowUpload(false);
          }}
          onClose={() => setShowUpload(false)}
        />
      )}

      {editCandidate && (
        <CandidateUpload
          candidate={editCandidate}
          onSuccess={(updated) => {
            setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setEditCandidate(undefined);
          }}
          onClose={() => setEditCandidate(undefined)}
        />
      )}
    </div>
  );
}
