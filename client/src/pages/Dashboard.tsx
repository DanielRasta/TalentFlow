import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCandidates, getOpportunities, getMatches, Candidate, Match } from '../lib/api';

interface Stats {
  activeCandidates: number;
  expiringSoon: number;
  openOpportunities: number;
  pendingMatches: number;
}

function StatCard({
  label,
  value,
  color,
  to,
}: {
  label: string;
  value: number | string;
  color: string;
  to: string;
}) {
  return (
    <Link to={to} className="card p-6 hover:shadow-md transition-shadow block">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
    </Link>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-400">—</span>;
  const pct = Math.round(score * 100);
  const colorClass =
    score >= 0.8 ? 'text-green-700' : score >= 0.6 ? 'text-yellow-700' : 'text-orange-700';
  return <span className={`font-semibold ${colorClass}`}>{pct}%</span>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    activeCandidates: 0,
    expiringSoon: 0,
    openOpportunities: 0,
    pendingMatches: 0,
  });
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [candidates, opportunities, matches] = await Promise.all([
          getCandidates('active'),
          getOpportunities({ is_active: true }),
          getMatches(),
        ]);

        const now = new Date();
        const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const expiringSoon = candidates.filter((c: Candidate) => {
          if (!c.expires_at) return false;
          const exp = new Date(c.expires_at);
          return exp >= now && exp <= sevenDays;
        }).length;

        const pendingMatches = matches.filter((m: Match) => m.status === 'pending').length;

        setStats({
          activeCandidates: candidates.length,
          expiringSoon,
          openOpportunities: opportunities.length,
          pendingMatches,
        });

        // Top 5 matches by score
        const sorted = [...matches]
          .filter((m: Match) => m.score !== null)
          .sort((a: Match, b: Match) => (b.score || 0) - (a.score || 0))
          .slice(0, 5);
        setRecentMatches(sorted);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Overview of your talent matching pipeline</p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-8 bg-slate-200 rounded w-16 mb-2" />
              <div className="h-4 bg-slate-100 rounded w-32" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            label="Active Candidates"
            value={stats.activeCandidates}
            color="text-indigo-600"
            to="/candidates"
          />
          <StatCard
            label="Expiring Soon (7 days)"
            value={stats.expiringSoon}
            color="text-yellow-600"
            to="/candidates"
          />
          <StatCard
            label="Open Opportunities"
            value={stats.openOpportunities}
            color="text-green-600"
            to="/opportunities"
          />
          <StatCard
            label="Pending Matches"
            value={stats.pendingMatches}
            color="text-blue-600"
            to="/matches"
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Recent Matches */}
        <div className="col-span-2 card">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Top Matches</h2>
            <Link to="/matches" className="text-sm text-indigo-600 hover:text-indigo-700">
              View all
            </Link>
          </div>
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse flex gap-4">
                  <div className="h-4 bg-slate-200 rounded flex-1" />
                  <div className="h-4 bg-slate-200 rounded w-20" />
                  <div className="h-4 bg-slate-200 rounded w-16" />
                </div>
              ))}
            </div>
          ) : recentMatches.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <p className="text-sm">No matches yet</p>
              <Link to="/matches" className="text-sm text-indigo-600 hover:underline mt-1 block">
                Run matching to get started
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentMatches.map((match) => (
                <div key={match.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 text-sm truncate">
                      {match.candidate_name}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {match.opportunity_title} at {match.company_name}
                    </div>
                  </div>
                  <ScoreBadge score={match.score} />
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      match.status === 'pending'
                        ? 'bg-blue-100 text-blue-700'
                        : match.status === 'introduced'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {match.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900">Quick Actions</h2>
          </div>
          <div className="p-6 space-y-3">
            <Link
              to="/candidates"
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-700">Add Candidate</span>
            </Link>
            <Link
              to="/companies"
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-700">Add Company</span>
            </Link>
            <Link
              to="/matches"
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-700">Run Matching</span>
            </Link>
            <Link
              to="/opportunities"
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-700">Refresh Jobs</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
