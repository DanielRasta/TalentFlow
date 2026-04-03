import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getCompanies, deleteCompany, refreshCompanyJobs, Company } from '../lib/api';
import CompanyForm from '../components/CompanyForm';

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | undefined>(undefined);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getCompanies();
      setCompanies(data);
    } catch (err) {
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    try {
      await deleteCompany(id);
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      toast.success('Company deleted');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleRefresh = async (id: number) => {
    setRefreshingId(id);
    try {
      const result = await refreshCompanyJobs(id);
      toast.success(`Jobs refreshed: +${result.added} added, ${result.deactivated} deactivated`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleFormSuccess = (company: Company) => {
    if (editCompany) {
      setCompanies((prev) => prev.map((c) => (c.id === company.id ? company : c)));
    } else {
      setCompanies((prev) => [...prev, company]);
    }
    setShowForm(false);
    setEditCompany(undefined);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
          <p className="text-slate-500 mt-1">Portfolio companies and hiring contacts</p>
        </div>
        <button
          onClick={() => { setEditCompany(undefined); setShowForm(true); }}
          className="btn-primary"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Company
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse flex gap-4">
                <div className="h-5 bg-slate-200 rounded flex-1" />
                <div className="h-5 bg-slate-200 rounded w-32" />
                <div className="h-5 bg-slate-200 rounded w-28" />
                <div className="h-5 bg-slate-200 rounded w-16" />
              </div>
            ))}
          </div>
        ) : companies.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-10 h-10 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-slate-500 text-sm">No companies yet</p>
            <button onClick={() => setShowForm(true)} className="btn-primary mt-3">
              Add your first company
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="table-header">Company</th>
                <th className="table-header">Website</th>
                <th className="table-header">Contact</th>
                <th className="table-header">Contact Email</th>
                <th className="table-header">Open Roles</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-slate-50 transition-colors">
                  <td className="table-cell">
                    <div className="font-medium text-slate-900">{company.name}</div>
                    {company.notes && (
                      <div className="text-xs text-slate-500 truncate max-w-xs">{company.notes}</div>
                    )}
                  </td>
                  <td className="table-cell">
                    {company.website ? (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-700 text-sm truncate block max-w-[180px]"
                      >
                        {company.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      <span className="text-slate-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="table-cell text-slate-700">{company.contact_name || '—'}</td>
                  <td className="table-cell">
                    {company.contact_email ? (
                      <a
                        href={`mailto:${company.contact_email}`}
                        className="text-indigo-600 hover:text-indigo-700 text-sm"
                      >
                        {company.contact_email}
                      </a>
                    ) : (
                      <span className="text-slate-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      (company.open_roles || 0) > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {company.open_roles || 0}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRefresh(company.id)}
                        disabled={refreshingId === company.id}
                        className="btn-secondary btn-sm"
                        title="Refresh jobs from website"
                      >
                        {refreshingId === company.id ? (
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />
                            Refreshing
                          </span>
                        ) : (
                          'Refresh Jobs'
                        )}
                      </button>
                      <button
                        onClick={() => { setEditCompany(company); setShowForm(true); }}
                        className="btn-secondary btn-sm"
                      >
                        Edit
                      </button>
                      {confirmDeleteId === company.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(company.id)}
                            className="btn-danger btn-sm"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="btn-secondary btn-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(company.id)}
                          className="btn-danger btn-sm"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <CompanyForm
          company={editCompany}
          onSuccess={handleFormSuccess}
          onClose={() => { setShowForm(false); setEditCompany(undefined); }}
        />
      )}
    </div>
  );
}
