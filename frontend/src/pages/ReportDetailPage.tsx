import { useState, useEffect, type FormEvent } from 'react';
import { API_URL } from '../App';
import type { UserInfo } from '../App';
import './ReportDetailPage.css';

interface Report {
  id: number;
  report_uid: string;
  status: string;
  client_representative: string;
  facility_name: string;
  auditor_name: string;
  created_at: string;
}

interface AccountEntry {
  id?: number;
  account_number: number;
  entry_date: string | null;
  is_solar: boolean;
  billing_account_no: string | null;
  sanctioned_cd_kva: number | null;
}

interface ReportDetailPageProps {
  reportId: number;
  user: UserInfo;
  onBack: () => void;
}

export default function ReportDetailPage({ reportId, user: _user, onBack }: ReportDetailPageProps) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  // Sheet 1 state
  const [sheet1Exists, setSheet1Exists] = useState(false);
  const [numAccounts, setNumAccounts] = useState(1);
  const [accounts, setAccounts] = useState<AccountEntry[]>([]);
  const [sheet1Loading, setSheet1Loading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    loadReport();
    loadSheet1();
  }, [reportId]);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadReport = async () => {
    try {
      const res = await fetch(`${API_URL}/api/reports/${reportId}`, { headers });
      if (!res.ok) throw new Error();
      setReport(await res.json());
    } catch {
      showMsg('Failed to load report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSheet1 = async () => {
    try {
      const res = await fetch(`${API_URL}/api/reports/${reportId}/sheet1`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSheet1Exists(data.exists);
      if (data.exists) {
        setNumAccounts(data.sheet.num_accounts);
        setAccounts(data.accounts);
      }
    } catch {
      showMsg('Failed to load Sheet 1', 'error');
    } finally {
      setSheet1Loading(false);
    }
  };

  const initSheet1 = async (e: FormEvent) => {
    e.preventDefault();
    if (numAccounts < 1) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/reports/${reportId}/sheet1`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ num_accounts: numAccounts }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      // Reload to get the empty account slots
      await loadSheet1();
      setSheet1Exists(true);
      showMsg('Sheet 1 initialized', 'success');
    } catch (err: any) {
      showMsg(err.message || 'Failed to initialize', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateAccount = (index: number, field: keyof AccountEntry, value: any) => {
    setAccounts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleNumAccountsChange = (newCount: number) => {
    if (newCount < 1) return;
    setNumAccounts(newCount);

    if (newCount > accounts.length) {
      // Add new empty slots
      const newAccounts = [...accounts];
      for (let i = accounts.length + 1; i <= newCount; i++) {
        newAccounts.push({
          account_number: i,
          entry_date: null,
          is_solar: false,
          billing_account_no: null,
          sanctioned_cd_kva: null,
        });
      }
      setAccounts(newAccounts);
    } else if (newCount < accounts.length) {
      // Trim
      setAccounts(accounts.slice(0, newCount));
    }
  };

  const saveSheet1 = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/reports/${reportId}/sheet1`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          num_accounts: numAccounts,
          accounts: accounts.map((a, i) => ({
            account_number: i + 1,
            entry_date: a.entry_date || null,
            is_solar: a.is_solar,
            billing_account_no: a.billing_account_no || null,
            sanctioned_cd_kva: a.sanctioned_cd_kva,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      showMsg('Sheet 1 saved successfully', 'success');
    } catch (err: any) {
      showMsg(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    not_started: { label: 'Not Started', color: '#8c8c8c', bg: '#f0f0f0' },
    in_progress: { label: 'In Progress', color: '#1677ff', bg: '#e6f4ff' },
    completed: { label: 'Completed', color: '#52c41a', bg: '#f6ffed' },
  };

  if (loading) return <div className="rd-loading">Loading report...</div>;
  if (!report) return <div className="rd-loading">Report not found.</div>;

  const sc = statusConfig[report.status] || statusConfig.not_started;

  return (
    <div className="report-detail">
      <header className="rd-header">
        <div>
          <button className="btn-back" onClick={onBack}>← Back to Dashboard</button>
          <div className="rd-title-row">
            <h1>{report.facility_name}</h1>
            <span className="rd-uid">{report.report_uid}</span>
            <span className="rd-status" style={{ color: sc.color, background: sc.bg }}>{sc.label}</span>
          </div>
          <div className="rd-meta">
            <span>Auditor: <strong>{report.auditor_name}</strong></span>
            <span>Client Rep: <strong>{report.client_representative}</strong></span>
            <span>Created: <strong>{new Date(report.created_at).toLocaleDateString()}</strong></span>
          </div>
        </div>
      </header>

      <main className="rd-main">
        {message && (
          <div className={`rd-message rd-message-${message.type}`}>{message.text}</div>
        )}

        {/* Sheet 1 Section */}
        <section className="sheet-section">
          <div className="sheet-header">
            <h2>Sheet 1 — Energy Consumption Data (Utility Supply, Last 1 Year)</h2>
          </div>

          {sheet1Loading ? (
            <p className="sheet-loading">Loading Sheet 1...</p>
          ) : !sheet1Exists ? (
            /* Init form: ask for number of accounts */
            <div className="sheet-init">
              <p className="sheet-init-desc">
                How many electrical connections does this facility have?
              </p>
              <form className="sheet-init-form" onSubmit={initSheet1}>
                <div className="form-group">
                  <label>Number of Electrical Connections</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={numAccounts}
                    onChange={e => setNumAccounts(parseInt(e.target.value) || 1)}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Initializing...' : 'Initialize Sheet 1'}
                </button>
              </form>
            </div>
          ) : (
            /* Account data entry */
            <div className="sheet-data">
              <div className="sheet-controls">
                <div className="form-group form-inline">
                  <label>Number of Connections:</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={numAccounts}
                    onChange={e => handleNumAccountsChange(parseInt(e.target.value) || 1)}
                    className="input-sm"
                  />
                </div>
                <button className="btn-primary" onClick={saveSheet1} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Sheet 1'}
                </button>
              </div>

              <div className="accounts-list">
                {accounts.map((acc, idx) => (
                  <div className="account-card" key={idx}>
                    <div className="account-header">
                      <h3>Connection {acc.account_number}</h3>
                      {acc.is_solar && <span className="solar-badge">☀ Solar</span>}
                    </div>
                    <div className="account-fields">
                      <div className="form-group">
                        <label>Date</label>
                        <input
                          type="date"
                          value={acc.entry_date || ''}
                          onChange={e => updateAccount(idx, 'entry_date', e.target.value || null)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Solar Connection?</label>
                        <select
                          value={acc.is_solar ? 'yes' : 'no'}
                          onChange={e => updateAccount(idx, 'is_solar', e.target.value === 'yes')}
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Utility Billing Account No.</label>
                        <input
                          type="text"
                          value={acc.billing_account_no || ''}
                          onChange={e => updateAccount(idx, 'billing_account_no', e.target.value || null)}
                          placeholder="e.g. ACC-001234"
                        />
                      </div>
                      <div className="form-group">
                        <label>Sanctioned Contract Demand (kVA)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={acc.sanctioned_cd_kva ?? ''}
                          onChange={e => updateAccount(idx, 'sanctioned_cd_kva', e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="e.g. 500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
