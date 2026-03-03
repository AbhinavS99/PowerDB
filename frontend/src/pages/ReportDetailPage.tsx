import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { API_URL } from '../App';
import type { UserInfo } from '../App';
import './ReportDetailPage.css';

interface Report {
  id: number; report_uid: string; status: string;
  client_representative: string; facility_name: string;
  auditor_name: string; created_at: string;
}

interface ConnectionSummary {
  id: number; account_number: number; entry_date: string | null;
  billing_account_no: string | null; sanctioned_cd_kva: number | null;
  is_diesel_generator: boolean; is_solar: boolean;
  bill_count: number; total_bill: number | null;
}

interface Props {
  reportId: number; user: UserInfo; onBack: () => void;
  onOpenConnection: (connId: number) => void;
}

export default function ReportDetailPage({ reportId, user, onBack, onOpenConnection }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingConn, setAddingConn] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const token = localStorage.getItem('token');
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const showMsg = (t: string, type: 'success' | 'error') => { setMsg({ text: t, type }); setTimeout(() => setMsg(null), 4000); };

  const loadData = useCallback(async () => {
    try {
      const [rr, cr] = await Promise.all([
        fetch(`${API_URL}/api/reports/${reportId}`, { headers: h }),
        fetch(`${API_URL}/api/reports/${reportId}/connections`, { headers: h }),
      ]);
      if (rr.ok) setReport(await rr.json());
      if (cr.ok) setConnections(await cr.json());
    } catch { showMsg('Failed to load', 'error'); }
    finally { setLoading(false); }
  }, [reportId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddConn = async () => {
    setAddingConn(true);
    try {
      const r = await fetch(`${API_URL}/api/reports/${reportId}/connections`, { method: 'POST', headers: h, body: '{}' });
      if (!r.ok) throw new Error((await r.json()).detail);
      await loadData(); showMsg('Connection added', 'success');
    } catch (e: any) { showMsg(e.message, 'error'); }
    finally { setAddingConn(false); }
  };

  const handleDeleteConn = async (e: React.MouseEvent, c: ConnectionSummary) => {
    e.stopPropagation();
    if (!confirm(`Delete Connection ${c.account_number} and all its data?`)) return;
    try {
      await fetch(`${API_URL}/api/reports/${reportId}/connections/${c.id}`, { method: 'DELETE', headers: h });
      await loadData(); showMsg('Connection deleted', 'success');
    } catch { showMsg('Failed to delete', 'error'); }
  };

  const sc: Record<string, { label: string; color: string; bg: string }> = {
    not_started: { label: 'Not Started', color: '#8c8c8c', bg: '#f0f0f0' },
    in_progress: { label: 'In Progress', color: '#1677ff', bg: '#e6f4ff' },
    completed: { label: 'Completed', color: '#52c41a', bg: '#f6ffed' },
  };

  if (loading) return <div className="rd-loading">Loading report...</div>;
  if (!report) return <div className="rd-loading">Report not found.</div>;
  const st = sc[report.status] || sc.not_started;

  return (
    <div className="report-detail">
      <header className="rd-header">
        <button className="btn-back" onClick={onBack}>← Back to Dashboard</button>
        <div className="rd-title-row">
          <h1>{report.facility_name}</h1>
          <span className="rd-uid">{report.report_uid}</span>
          <span className="rd-status" style={{ color: st.color, background: st.bg }}>{st.label}</span>
        </div>
        <div className="rd-meta">
          <span>Auditor: <strong>{report.auditor_name}</strong></span>
          <span>Client Rep: <strong>{report.client_representative}</strong></span>
          <span>Created: <strong>{new Date(report.created_at).toLocaleDateString()}</strong></span>
        </div>
      </header>

      <main className="rd-main">
        {msg && <div className={`rd-message rd-message-${msg.type}`}>{msg.text}</div>}

        <div className="section-header">
          <h2>Electrical Connections</h2>
          <button className="btn-add-conn" onClick={handleAddConn} disabled={addingConn}>
            {addingConn ? 'Adding...' : '+ Add Connection'}
          </button>
        </div>

        {connections.length === 0 ? (
          <div className="empty-state">
            <p>No connections yet.</p>
            <p className="empty-sub">Click "+ Add Connection" to start the audit.</p>
          </div>
        ) : (
          <div className="conn-cards">
            {connections.map(c => (
              <div className="conn-card" key={c.id} onClick={() => onOpenConnection(c.id)}>
                <div className="conn-card-top">
                  <h3>Connection {c.account_number}</h3>
                  <div className="conn-card-badges">
                    {c.is_diesel_generator && <span className="badge-dg">⚡ DG</span>}
                    {c.is_solar && <span className="badge-solar">☀ Solar</span>}
                  </div>
                </div>
                <div className="conn-card-body">
                  <p><span className="label">Account:</span> {c.billing_account_no || '—'}</p>
                  <p><span className="label">CD:</span> {c.sanctioned_cd_kva ? `${c.sanctioned_cd_kva} kVA` : '—'}</p>
                  <p><span className="label">Bills:</span> {c.bill_count}</p>
                  {c.total_bill != null && c.total_bill > 0 && <p><span className="label">Total:</span> ₹{c.total_bill.toLocaleString()}</p>}
                </div>
                {(user.role === 'super' || user.role === 'admin') && (
                  <button className="conn-card-delete" onClick={(e) => handleDeleteConn(e, c)}>Delete</button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
