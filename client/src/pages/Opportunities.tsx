import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getOpportunities,
  getCompanies,
  createOpportunity,
  deleteOpportunity,
  toggleOpportunityActive,
  refreshAllJobs,
  Opportunity,
  Company,
} from '../lib/api';
import JobTypeFilter from '../components/JobTypeFilter';

type ViewMode = 'company' | 'type';

const SENIORITY_OPTIONS = ['junior', 'mid', 'senior', 'lead', 'director', 'vp', 'c-level'];
const JOB_TYPE_OPTIONS = ['engineering', 'sales', 'marketing', 'design', 'product', 'operations', 'finance', 'data', 'hr', 'other'];

export default function Opportunities() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('company');
  const [jobTypeFilter, setJobTypeFilter] = useState('all');
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    company_id: '',
    title: '',
    department: '',
    job_type: '',
    seniority: '',
    location: '',
    description: '',
    source_url: '',
  });
  const [savingAdd, setSavingAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [opps, comps] = await Promise.all([getOpportunities(), getCompanies()]);
      setOpportunities(opps);
      setCompanies(comps);
    } catch (err) {
      toast.error('Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredOpps = opportunities.filter((o) =>
    jobTypeFilter === 'all' || o.job_type === jobTypeFilter
  );

  const handleToggleActive = async (id: number) => {
    try {
      const updated = await toggleOpportunityActive(id);
      setOpportunities((prev) => prev.map((o) => (o.id === id ? updated : o)));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this opportunity?')) return;
    try {
      await deleteOpportunity(id);
      setOpportunities((prev) => prev.filter((o) => o.id !== id));
      toast.success('Opportunity deleted');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    try {
      await refreshAllJobs();
      toast.success('All jobs refreshed');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRefreshingAll(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.company_id || !addForm.title) {
      toast.error('Company and title are required');
      return;
    }
    setSavingAdd(true);
    try {
      const opp = await createOpportunity({
        company_id: parseInt(addForm.company_id),
        title: addForm.title,
        department: addForm.department || undefined,
        job_type: addForm.job_type || undefined,
        seniority: addForm.seniority || undefined,
        location: addForm.location || undefined,
        description: addForm.description || undefined,
        source_url: addForm.source_url || undefined,
      } as any);
      setOpportunities((prev) => [opp, ...prev]);
      toast.success('Opportunity added');
      setShowAddForm(false);
      setAddForm({ company_id: '', title: '', department: '', job_type: '', seniority: '', location: '', description: '', source_url: '' });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingAdd(false);
    }
  };

  // Group by company for company view
  const byCompany = filteredOpps.reduce<Record<string, Opportunity[]>>((acc, opp) => {
    const key = opp.company_name || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(opp);
    return acc;
  }, {});

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Opportunities</h1>
          <p className="text-slate-500 mt-1">{opportunities.length} total opportunities</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefreshAll}
            disabled={refreshingAll}
            className="btn-secondary"
          >
            {refreshingAll ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                Refreshing All...
              </span>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh All Jobs
              </>
            )}
          </button>
          <button onClick={() => setShowAddForm(true)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Opportunity
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => setViewMode('company')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'company' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            By Company
          </button>
          <button
            onClick={() => setViewMode('type')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-l border-slate-200 ${
              viewMode === 'type' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            By Job Type
          </button>
        </div>
        <JobTypeFilter value={jobTypeFilter} onChange={setJobTypeFilter} />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-40 mb-3" />
              <div className="space-y-2">
                <div className="h-4 bg-slate-100 rounded" />
                <div className="h-4 bg-slate-100 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredOpps.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-10 h-10 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-slate-500 text-sm">No opportunities found</p>
        </div>
      ) : viewMode === 'company' ? (
        <div className="space-y-6">
          {Object.entries(byCompany).map(([companyName, opps]) => (
            <div key={companyName} className="card overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900">{companyName}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{opps.length} role{opps.length !== 1 ? 's' : ''}</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="table-header">Title</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">Seniority</th>
                    <th className="table-header">Location</th>
                    <th className="table-header">Source</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {opps.map((opp) => (
                    <OppRow key={opp.id} opp={opp} onToggle={handleToggleActive} onDelete={handleDelete} />
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="table-header">Title</th>
                <th className="table-header">Company</th>
                <th className="table-header">Type</th>
                <th className="table-header">Seniority</th>
                <th className="table-header">Location</th>
                <th className="table-header">Source</th>
                <th className="table-header">Status</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOpps.map((opp) => (
                <OppRow key={opp.id} opp={opp} onToggle={handleToggleActive} onDelete={handleDelete} showCompany />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Opportunity Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Add Opportunity</h2>
              <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Company *</label>
                <select value={addForm.company_id} onChange={(e) => setAddForm({ ...addForm, company_id: e.target.value })} className="input" required>
                  <option value="">Select company...</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Title *</label>
                <input type="text" value={addForm.title} onChange={(e) => setAddForm({ ...addForm, title: e.target.value })} className="input" placeholder="Senior Software Engineer" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Job Type</label>
                  <select value={addForm.job_type} onChange={(e) => setAddForm({ ...addForm, job_type: e.target.value })} className="input">
                    <option value="">Select...</option>
                    {JOB_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Seniority</label>
                  <select value={addForm.seniority} onChange={(e) => setAddForm({ ...addForm, seniority: e.target.value })} className="input">
                    <option value="">Select...</option>
                    {SENIORITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Department</label>
                  <input type="text" value={addForm.department} onChange={(e) => setAddForm({ ...addForm, department: e.target.value })} className="input" placeholder="Engineering" />
                </div>
                <div>
                  <label className="label">Location</label>
                  <input type="text" value={addForm.location} onChange={(e) => setAddForm({ ...addForm, location: e.target.value })} className="input" placeholder="Remote, NYC" />
                </div>
              </div>
              <div>
                <label className="label">Source URL</label>
                <input type="url" value={addForm.source_url} onChange={(e) => setAddForm({ ...addForm, source_url: e.target.value })} className="input" placeholder="https://..." />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} className="input resize-none" rows={4} placeholder="Job description..." />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={savingAdd} className="btn-primary">
                  {savingAdd ? 'Adding...' : 'Add Opportunity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function OppRow({
  opp,
  onToggle,
  onDelete,
  showCompany,
}: {
  opp: Opportunity;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  showCompany?: boolean;
}) {
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="table-cell">
        <div className="font-medium text-slate-900">{opp.title}</div>
        {opp.department && <div className="text-xs text-slate-500">{opp.department}</div>}
      </td>
      {showCompany && <td className="table-cell text-slate-700">{opp.company_name}</td>}
      <td className="table-cell">
        {opp.job_type ? (
          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 capitalize">
            {opp.job_type}
          </span>
        ) : '—'}
      </td>
      <td className="table-cell capitalize text-slate-600">{opp.seniority || '—'}</td>
      <td className="table-cell text-slate-600">{opp.location || '—'}</td>
      <td className="table-cell">
        {opp.source_url ? (
          <a href={opp.source_url} target="_blank" rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-700 text-xs">
            View posting
          </a>
        ) : (
          <span className="text-xs text-slate-400 capitalize">{opp.source}</span>
        )}
      </td>
      <td className="table-cell">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          opp.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {opp.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="table-cell">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(opp.id)}
            className="btn-secondary btn-sm"
          >
            {opp.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={() => onDelete(opp.id)}
            className="btn-danger btn-sm"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
