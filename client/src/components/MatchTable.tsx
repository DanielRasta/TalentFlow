import { Match } from '../lib/api';

interface MatchTableProps {
  matches: Match[];
  onDismiss: (match: Match) => void;
  onSuggest: (match: Match) => void;
  onExpand: (match: Match) => void;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-400 text-sm">—</span>;

  const pct = Math.round(score * 100);
  const colorClass =
    score >= 0.8
      ? 'bg-green-100 text-green-800'
      : score >= 0.6
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-orange-100 text-orange-800';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>
      {pct}%
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-blue-100 text-blue-700',
    introduced: 'bg-green-100 text-green-700',
    dismissed: 'bg-red-100 text-red-700',
  };
  const cls = map[status] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function MatchTable({ matches, onDismiss, onSuggest, onExpand }: MatchTableProps) {
  if (matches.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <p className="text-sm">No matches found</p>
        <p className="text-xs text-slate-400 mt-1">Run matching to find candidate-opportunity pairs</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="table-header">Candidate</th>
            <th className="table-header">Role</th>
            <th className="table-header">Company</th>
            <th className="table-header">Score</th>
            <th className="table-header">Reasoning</th>
            <th className="table-header">Status</th>
            <th className="table-header">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {matches.map((match) => (
            <tr key={match.id} className="hover:bg-slate-50 transition-colors">
              <td className="table-cell">
                <div>
                  <div className="font-medium text-slate-900">{match.candidate_name}</div>
                  {match.candidate_seniority && (
                    <div className="text-xs text-slate-500 capitalize">{match.candidate_seniority}</div>
                  )}
                </div>
              </td>
              <td className="table-cell">
                <div>
                  <div className="font-medium text-slate-900">{match.opportunity_title}</div>
                  {match.opportunity_job_type && (
                    <div className="text-xs text-slate-500 capitalize">{match.opportunity_job_type}</div>
                  )}
                </div>
              </td>
              <td className="table-cell font-medium text-slate-900">{match.company_name}</td>
              <td className="table-cell">
                <ScoreBadge score={match.score} />
              </td>
              <td className="table-cell max-w-xs">
                <p className="text-xs text-slate-600 line-clamp-2">{match.reasoning || '—'}</p>
              </td>
              <td className="table-cell">
                <StatusPill status={match.status} />
              </td>
              <td className="table-cell">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onExpand(match)}
                    className="btn-secondary btn-sm"
                    title="View details"
                  >
                    View
                  </button>
                  {match.status === 'pending' && (
                    <>
                      <button
                        onClick={() => onSuggest(match)}
                        className="btn-primary btn-sm"
                        title="Send suggestion email"
                      >
                        Suggest
                      </button>
                      <button
                        onClick={() => onDismiss(match)}
                        className="btn-danger btn-sm"
                        title="Dismiss match"
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                  {match.status === 'introduced' && (
                    <button
                      onClick={() => onSuggest(match)}
                      className="btn-secondary btn-sm"
                      title="Resend email"
                    >
                      Resend
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
