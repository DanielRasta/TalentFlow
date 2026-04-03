import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getMatches,
  runMatching,
  dismissMatch,
  introduceMatch,
  getCompanies,
  Match,
  Company,
} from '../lib/api';
import MatchTable from '../components/MatchTable';
import EmailPreview from '../components/EmailPreview';
import JobTypeFilter from '../components/JobTypeFilter';

interface EmailDraft {
  matchId: number;
  to: string;
  subject: string;
  body: string;
}

export default function Matches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runProgress, setRunProgress] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [showDismissed, setShowDismissed] = useState(false);
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<Match | null>(null);
  const [confirmDismissId, setConfirmDismissId] = useState<number | null>(null);
  const [generatingEmailId, setGeneratingEmailId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [matchData, compData] = await Promise.all([
        getMatches({ show_dismissed: showDismissed }),
        getCompanies(),
      ]);
      setMatches(matchData);
      setCompanies(compData);
    } catch (err) {
      toast.error('Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [showDismissed]);

  const filteredMatches = matches.filter((m) => {
    if (jobTypeFilter !== 'all' && m.opportunity_job_type !== jobTypeFilter) return false;
    if (companyFilter !== 'all' && String(m.company_id) !== companyFilter) return false;
    if (statusFilter && m.status !== statusFilter) return false;
    return true;
  });

  const handleRunMatching = async () => {
    setRunning(true);
    setRunProgress('Starting AI matching...');
    try {
      const result = await runMatching();
      setRunProgress('');
      toast.success(`Matching complete: ${result.added} new matches found`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
      setRunProgress('');
    } finally {
      setRunning(false);
    }
  };

  const handleDismiss = async (match: Match) => {
    setConfirmDismissId(match.id);
  };

  const confirmDismiss = async (id: number) => {
    try {
      await dismissMatch(id);
      setMatches((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: 'dismissed' } : m))
      );
      toast.success('Match dismissed');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setConfirmDismissId(null);
    }
  };

  const handleSuggest = async (match: Match) => {
    setGeneratingEmailId(match.id);
    try {
      const draft = await introduceMatch(match.id);
      setEmailDraft({
        matchId: match.id,
        to: draft.to,
        subject: draft.subject,
        body: draft.body,
      });
    } catch (err) {
      toast.error(`Failed to generate email: ${(err as Error).message}`);
    } finally {
      setGeneratingEmailId(null);
    }
  };

  const handleExpand = (match: Match) => {
    setExpandedMatch(expandedMatch?.id === match.id ? null : match);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Matches</h1>
          <p className="text-slate-500 mt-1">AI-scored candidate-opportunity pairs</p>
        </div>
        <button
          onClick={handleRunMatching}
          disabled={running}
          className="btn-primary"
        >
          {running ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Running...
            </span>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run Matching
            </>
          )}
        </button>
      </div>

      {/* Progress bar */}
      {running && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-slate-600 mb-1">
            <span>{runProgress}</span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase mb-1 block">Company</label>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="input py-1.5 text-sm w-48"
            >
              <option value="all">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase mb-1 block">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input py-1.5 text-sm w-40"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="introduced">Introduced</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
              <input
                type="checkbox"
                checked={showDismissed}
                onChange={(e) => setShowDismissed(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              Show dismissed
            </label>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 uppercase mb-1 block">Job Type</label>
          <JobTypeFilter value={jobTypeFilter} onChange={setJobTypeFilter} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(['pending', 'introduced', 'dismissed'] as const).map((s) => {
          const count = matches.filter((m) => m.status === s).length;
          const colors = {
            pending: 'text-blue-600 bg-blue-50',
            introduced: 'text-green-600 bg-green-50',
            dismissed: 'text-red-600 bg-red-50',
          };
          return (
            <div key={s} className={`card p-4 ${colors[s]}`}>
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-sm capitalize">{s}</div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse flex gap-4">
                <div className="h-5 bg-slate-200 rounded w-32" />
                <div className="h-5 bg-slate-200 rounded w-40" />
                <div className="h-5 bg-slate-200 rounded w-28" />
                <div className="h-5 bg-slate-200 rounded w-12" />
                <div className="h-5 bg-slate-200 rounded flex-1" />
              </div>
            ))}
          </div>
        ) : (
          <MatchTable
            matches={filteredMatches}
            onDismiss={handleDismiss}
            onSuggest={handleSuggest}
            onExpand={handleExpand}
          />
        )}
      </div>

      {/* Generating email spinner */}
      {generatingEmailId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 text-center">
            <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-700 font-medium">Drafting email with AI...</p>
          </div>
        </div>
      )}

      {/* Expanded Match Details */}
      {expandedMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Match Details</h2>
              <button onClick={() => setExpandedMatch(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Candidate</div>
                  <div className="font-medium text-slate-900">{expandedMatch.candidate_name}</div>
                  <div className="text-sm text-slate-500">{expandedMatch.candidate_headline}</div>
                  {expandedMatch.candidate_email && (
                    <div className="text-xs text-slate-500">{expandedMatch.candidate_email}</div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Role</div>
                  <div className="font-medium text-slate-900">{expandedMatch.opportunity_title}</div>
                  <div className="text-sm text-slate-500">{expandedMatch.company_name}</div>
                  <div className="text-xs text-slate-500 capitalize">{expandedMatch.opportunity_job_type}</div>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase mb-1">AI Reasoning</div>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">
                  {expandedMatch.reasoning || 'No reasoning provided'}
                </p>
              </div>
              {expandedMatch.candidate_skills && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Skills</div>
                  <div className="flex flex-wrap gap-1">
                    {expandedMatch.candidate_skills.split(',').map((s) => s.trim()).filter(Boolean).map((skill) => (
                      <span key={skill} className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-slate-200 gap-3">
              <button onClick={() => setExpandedMatch(null)} className="btn-secondary">Close</button>
              {expandedMatch.status === 'pending' && (
                <button
                  onClick={() => { setExpandedMatch(null); handleSuggest(expandedMatch); }}
                  className="btn-primary"
                >
                  Suggest Candidate
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dismiss Confirmation */}
      {confirmDismissId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Dismiss Match?</h3>
            <p className="text-sm text-slate-600 mb-6">
              This match will be marked as dismissed. You can still view it by enabling "Show dismissed".
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDismissId(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => confirmDismiss(confirmDismissId)}
                className="btn-danger"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      {emailDraft && (
        <EmailPreview
          matchId={emailDraft.matchId}
          to={emailDraft.to}
          subject={emailDraft.subject}
          body={emailDraft.body}
          onClose={() => setEmailDraft(null)}
          onSent={() => {
            setMatches((prev) =>
              prev.map((m) =>
                m.id === emailDraft.matchId ? { ...m, status: 'introduced' } : m
              )
            );
            setEmailDraft(null);
          }}
        />
      )}
    </div>
  );
}
