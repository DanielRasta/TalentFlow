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
                <th className="table-header">Skills</th>
                <th className="table-header">Seniority</th>
                <th className="table-header">Location</th>
                <th className="table-header">Expires</th>
                <th className="table-header">Status</th>
                <th className="table-header">Actions</th>
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
                        <div className="font-medium text-slate-900">{candidate.name}</div>
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
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-1">
                        {parseSkills(candidate.skills).map((skill) => (
                          <span
                            key={skill}
                            className="inline-flex px-1.5 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                        {(candidate.skills?.split(',').length || 0) > 5 && (
                          <span className="text-xs text-slate-400">
                            +{(candidate.skills?.split(',').length || 0) - 5}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell capitalize text-slate-600">
                      {candidate.seniority || '—'}
                    </td>
                    <td className="table-cell text-slate-600">{candidate.location || '—'}</td>
                    <td className="table-cell">
                      {candidate.expires_at
                        ? new Date(candidate.expires_at).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="table-cell">
                      <ExpiryBadge expiresAt={candidate.expires_at} isActive={candidate.is_active} />
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedId(expandedId === candidate.id ? null : candidate.id)}
                          className="btn-secondary btn-sm"
                        >
                          {expandedId === candidate.id ? 'Hide' : 'View'}
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
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-3 gap-6 text-sm">
                          <div>
                            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Contact</div>
                            {candidate.phone && <div className="text-slate-700">{candidate.phone}</div>}
                            {candidate.linkedin_url && (
                              <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer"
                                className="text-indigo-600 hover:underline text-xs">LinkedIn</a>
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
          onSuccess={(candidate) => {
            setCandidates((prev) => [candidate, ...prev]);
            setShowUpload(false);
          }}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}
