import { useState, useEffect, useRef, type FormEvent } from 'react';
import { API_URL } from '../App';
import type { UserInfo } from '../App';
import './DashboardPage.css';

interface Report {
  id: number;
  report_uid: string;
  status: string;
  client_representative: string;
  facility_name: string;
  auditor_name: string;
  auditor_id: number;
  created_at: string;
  updated_at: string;
}

interface DashboardPageProps {
  user: UserInfo;
  onLogout: () => void;
  onManageUsers?: () => void;
  onOpenReport?: (id: number) => void;
}

export default function DashboardPage({ user, onLogout, onManageUsers, onOpenReport }: DashboardPageProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewReport, setShowNewReport] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    loadReports();
  }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const loadReports = async () => {
    try {
      const res = await fetch(`${API_URL}/api/reports/`, { headers });
      if (!res.ok) throw new Error();
      setReports(await res.json());
    } catch {
      console.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this report? This cannot be undone.')) return;
    try {
      await fetch(`${API_URL}/api/reports/${id}`, { method: 'DELETE', headers });
      setReports(prev => prev.filter(r => r.id !== id));
    } catch {
      alert('Failed to delete report');
    }
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    not_started: { label: 'Not Started', color: '#8c8c8c', bg: '#f0f0f0' },
    in_progress: { label: 'In Progress', color: '#1677ff', bg: '#e6f4ff' },
    completed: { label: 'Completed', color: '#52c41a', bg: '#f6ffed' },
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1 className="logo">PowerDB</h1>
        <div className="header-right">
          <button className="btn-new-report" onClick={() => setShowNewReport(true)}>
            + New Report
          </button>
          <div className="profile-wrapper" ref={profileRef}>
            <button className="profile-trigger" onClick={() => setProfileOpen(!profileOpen)}>
              <span className="avatar">{user.full_name.charAt(0).toUpperCase()}</span>
              <span className="profile-name">{user.full_name}</span>
              <span className="chevron">{profileOpen ? '▲' : '▼'}</span>
            </button>
            {profileOpen && (
              <div className="profile-dropdown">
                <div className="profile-info">
                  <p className="profile-fullname">{user.full_name}</p>
                  <p className="profile-email">{user.email}</p>
                  <p className="profile-detail">Phone: {user.phone || '—'}</p>
                  <p className="profile-detail">Role: <span className={`role-tag role-${user.role}`}>{user.role}</span></p>
                </div>
                <div className="profile-divider" />
                {onManageUsers && (
                  <button className="profile-menu-item" onClick={() => { setProfileOpen(false); onManageUsers(); }}>
                    Manage Users
                  </button>
                )}
                <button className="profile-menu-item profile-signout" onClick={onLogout}>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        {showNewReport && (
          <NewReportModal
            headers={headers}
            onClose={() => setShowNewReport(false)}
            onCreated={(report) => {
              setReports(prev => [report, ...prev]);
              setShowNewReport(false);
            }}
          />
        )}

        <div className="reports-header">
          <h2>Reports</h2>
          <span className="report-count">{reports.length} total</span>
        </div>

        {loading ? (
          <p className="loading-text">Loading reports...</p>
        ) : reports.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">No reports yet</p>
            <p className="empty-sub">Click "+ New Report" to create your first power audit report.</p>
          </div>
        ) : (
          <div className="report-cards">
            {reports.map(r => {
              const sc = statusConfig[r.status] || statusConfig.not_started;
              return (
                <div className="report-card" key={r.id} onClick={() => onOpenReport?.(r.id)}>
                  <div className="card-top">
                    <span className="card-uid">{r.report_uid}</span>
                    <span className="card-status" style={{ color: sc.color, background: sc.bg }}>
                      {sc.label}
                    </span>
                  </div>
                  <h3 className="card-facility">{r.facility_name}</h3>
                  <div className="card-details">
                    <p><span className="detail-label">Client Rep:</span> {r.client_representative}</p>
                    <p><span className="detail-label">Auditor:</span> {r.auditor_name}</p>
                    <p><span className="detail-label">Created:</span> {new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                  {(user.role === 'super' || user.role === 'admin') && (
                    <div className="card-actions">
                      <button className="btn-card-delete" onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}>Delete</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}


// ---------- New Report Modal ----------

function NewReportModal({
  headers,
  onClose,
  onCreated,
}: {
  headers: Record<string, string>;
  onClose: () => void;
  onCreated: (report: Report) => void;
}) {
  const [clientRep, setClientRep] = useState('');
  const [facility, setFacility] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientRep.trim()) { setError('Client representative is required'); return; }
    if (!facility.trim()) { setError('Facility name is required'); return; }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/reports/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          client_representative: clientRep.trim(),
          facility_name: facility.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to create report');
      }
      onCreated(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h3>Create New Report</h3>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-msg">{error}</div>}
          <div className="form-group">
            <label>Facility Name *</label>
            <input value={facility} onChange={e => setFacility(e.target.value)} placeholder="e.g. Building A, Plant 3" />
          </div>
          <div className="form-group">
            <label>Client Representative *</label>
            <input value={clientRep} onChange={e => setClientRep(e.target.value)} placeholder="Contact person name" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
