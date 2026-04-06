import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getOpportunities,
  getCompanies,
  createOpportunity,
  deleteOpportunity,
  toggleOpportunityActive,
  refreshAllJobs,
  batchCreateOpportunities,
  Opportunity,
  Company,
} from '../lib/api';
import JobTypeFilter from '../components/JobTypeFilter';

// ── CSV helpers ──────────────────────────────────────────────────────────────

const CSV_TEMPLATE_HEADERS = ['Title', 'Department', 'Type', 'Seniority', 'Location', 'Link to position'];

function downloadCsvTemplate() {
  const content = CSV_TEMPLATE_HEADERS.join(',') + '\n';
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'opportunities-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

interface CsvRow { title: string; department: string; job_type: string; seniority: string; location: string; source_url: string; }

function parseCsvRow(line: string): string[] {
  const fields: string[] = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { fields.push(cur); cur = ''; }
    else { cur += ch; }
  }
  fields.push(cur);
  return fields;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvRow(lines[0]).map(h => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvRow(lines[i]).map(v => v.trim());
    if (vals.every(v => !v)) continue;
    rows.push({
      title:      vals[idx('title')] ?? '',
      department: vals[idx('department')] ?? '',
      job_type:   vals[idx('type')] ?? '',
      seniority:  vals[idx('seniority')] ?? '',
      location:   vals[idx('location')] ?? '',
      source_url: vals[idx('link to position')] ?? '',
    });
  }
  return rows;
}

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

  // CSV upload state
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvCompanyId, setCsvCompanyId] = useState('');
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvFilename, setCsvFilename] = useState('');
  const [csvDragging, setCsvDragging] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const csvFileRef = useRef<HTMLInputElement>(null);

  const handleCsvFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) { toast.error('Please upload a .csv file'); return; }
    setCsvFilename(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = parseCsv(e.target?.result as string);
      setCsvRows(rows);
      if (rows.length === 0) toast.error('No data rows found in the CSV');
    };
    reader.readAsText(file);
  };

  const handleCsvUpload = async () => {
    if (!csvCompanyId) { toast.error('Please select a company'); return; }
    if (csvRows.length === 0) { toast.error('No rows to upload'); return; }
    setUploadingCsv(true);
    try {
      const result = await batchCreateOpportunities(parseInt(csvCompanyId), csvRows);
      toast.success(`Added ${result.added} opportunit${result.added === 1 ? 'y' : 'ies'}`);
      if (result.errors.length > 0) toast.error(`${result.errors.length} row(s) skipped: ${result.errors[0]}`);
      setShowCsvModal(false);
      setCsvCompanyId(''); setCsvRows([]); setCsvFilename('');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingCsv(false);
    }
  };

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
          <button onClick={() => setShowCsvModal(true)} className="btn-secondary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload CSV
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

      {/* Upload CSV Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Import Opportunities from CSV</h2>
              <button onClick={() => { setShowCsvModal(false); setCsvRows([]); setCsvFilename(''); setCsvCompanyId(''); }}
                className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Company selector */}
              <div>
                <label className="label">Company *</label>
                <select value={csvCompanyId} onChange={(e) => setCsvCompanyId(e.target.value)} className="input">
                  <option value="">Select company...</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Template download */}
              <div className="flex items-center justify-between rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-indigo-900">CSV Format</p>
                  <p className="text-xs text-indigo-600 mt-0.5">
                    Columns: Title, Department, Type, Seniority, Location, Link to position
                  </p>
                </div>
                <button onClick={downloadCsvTemplate}
                  className="flex items-center gap-1.5 text-sm font-medium text-indigo-700 hover:text-indigo-900 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download template
                </button>
              </div>

              {/* File upload area */}
              <div>
                <label className="label">CSV File</label>
                <div
                  onClick={() => csvFileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setCsvDragging(true); }}
                  onDragLeave={() => setCsvDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault(); setCsvDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleCsvFile(file);
                  }}
                  className={`cursor-pointer rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
                    csvDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                  }`}
                >
                  {csvFilename ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-700">
                      <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="font-medium">{csvFilename}</span>
                      <span className="text-slate-400">— click to replace</span>
                    </div>
                  ) : (
                    <div>
                      <svg className="w-8 h-8 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <p className="text-sm text-slate-500">Drop your CSV here, or <span className="text-indigo-600 font-medium">browse</span></p>
                    </div>
                  )}
                </div>
                <input
                  ref={csvFileRef} type="file" accept=".csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); e.target.value = ''; }}
                />
              </div>

              {/* Preview */}
              {csvRows.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    <span className="text-green-600 font-semibold">{csvRows.length}</span> row{csvRows.length !== 1 ? 's' : ''} parsed
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-48">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          {['Title', 'Department', 'Type', 'Seniority', 'Location', 'Link'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-slate-500 border-b border-slate-200">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {csvRows.slice(0, 10).map((row, i) => (
                          <tr key={i} className={!row.title ? 'bg-red-50' : ''}>
                            <td className="px-3 py-1.5 text-slate-900 font-medium max-w-[160px] truncate">
                              {row.title || <span className="text-red-500 italic">missing</span>}
                            </td>
                            <td className="px-3 py-1.5 text-slate-600 max-w-[100px] truncate">{row.department || '—'}</td>
                            <td className="px-3 py-1.5 text-slate-600">{row.job_type || '—'}</td>
                            <td className="px-3 py-1.5 text-slate-600">{row.seniority || '—'}</td>
                            <td className="px-3 py-1.5 text-slate-600 max-w-[120px] truncate">{row.location || '—'}</td>
                            <td className="px-3 py-1.5 text-slate-600 max-w-[100px] truncate">
                              {row.source_url ? (
                                <a href={row.source_url} target="_blank" rel="noopener noreferrer"
                                  className="text-indigo-600 hover:underline">link</a>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvRows.length > 10 && (
                      <p className="text-xs text-slate-400 px-3 py-2 bg-slate-50 border-t border-slate-200">
                        …and {csvRows.length - 10} more row{csvRows.length - 10 !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button type="button"
                  onClick={() => { setShowCsvModal(false); setCsvRows([]); setCsvFilename(''); setCsvCompanyId(''); }}
                  className="btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleCsvUpload}
                  disabled={uploadingCsv || csvRows.length === 0 || !csvCompanyId}
                  className="btn-primary"
                >
                  {uploadingCsv
                    ? 'Importing...'
                    : csvRows.length > 0
                      ? `Import ${csvRows.length} Opportunit${csvRows.length === 1 ? 'y' : 'ies'}`
                      : 'Import'}
                </button>
              </div>
            </div>
          </div>
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
