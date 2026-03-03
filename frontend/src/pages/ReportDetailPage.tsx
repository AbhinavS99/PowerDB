import { useState, useEffect, useCallback } from 'react';
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

interface Connection {
  id: number;
  account_number: number;
  entry_date: string | null;
  billing_account_no: string | null;
  sanctioned_cd_kva: number | null;
  is_diesel_generator: boolean;
  is_solar: boolean;
  billing_period_from: string | null;
  billing_period_to: string | null;
  billing_days: number | null;
  bill_no: string | null;
  mdi_kva: number | null;
  units_kwh: number | null;
  units_kvah: number | null;
  pf: number | null;
  fixed_charges: number | null;
  energy_charges: number | null;
  taxes_and_rent: number | null;
  other_charges: number | null;
  monthly_bill: number | null;
  unit_consumption_per_day: number | null;
  avg_per_unit_cost: number | null;
}

interface ReportDetailPageProps {
  reportId: number;
  user: UserInfo;
  onBack: () => void;
}

export default function ReportDetailPage({ reportId, user: _user, onBack }: ReportDetailPageProps) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [sheet1Loading, setSheet1Loading] = useState(true);
  const [addingConnection, setAddingConnection] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadReport = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/reports/${reportId}`, { headers });
      if (!res.ok) throw new Error();
      setReport(await res.json());
    } catch {
      showMsg('Failed to load report', 'error');
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  const loadSheet1 = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/reports/${reportId}/sheet1`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setConnections(data.accounts || []);
    } catch {
      showMsg('Failed to load Sheet 1', 'error');
    } finally {
      setSheet1Loading(false);
    }
  }, [reportId]);

  useEffect(() => {
    loadReport();
    loadSheet1();
  }, [loadReport, loadSheet1]);

  // ---- Add connection ----
  const handleAddConnection = async () => {
    setAddingConnection(true);
    try {
      const res = await fetch(`${API_URL}/api/reports/${reportId}/sheet1/connections`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      // Reload to get fresh data
      await loadSheet1();
      showMsg('Connection added', 'success');
    } catch (err: any) {
      showMsg(err.message || 'Failed to add connection', 'error');
    } finally {
      setAddingConnection(false);
    }
  };

  // ---- Save individual connection ----
  const handleSaveConnection = async (conn: Connection) => {
    setSavingId(conn.id);
    try {
      const res = await fetch(`${API_URL}/api/reports/${reportId}/sheet1/connections/${conn.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          billing_account_no: conn.billing_account_no || null,
          sanctioned_cd_kva: conn.sanctioned_cd_kva,
          is_diesel_generator: conn.is_diesel_generator,
          is_solar: conn.is_solar,
          billing_period_from: conn.billing_period_from || null,
          billing_period_to: conn.billing_period_to || null,
          bill_no: conn.bill_no || null,
          mdi_kva: conn.mdi_kva,
          units_kwh: conn.units_kwh,
          units_kvah: conn.units_kvah,
          fixed_charges: conn.fixed_charges,
          energy_charges: conn.energy_charges,
          taxes_and_rent: conn.taxes_and_rent,
          other_charges: conn.other_charges,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      showMsg(`Connection ${conn.account_number} saved`, 'success');
    } catch (err: any) {
      showMsg(err.message || 'Failed to save', 'error');
    } finally {
      setSavingId(null);
    }
  };

  // ---- Delete connection ----
  const handleDeleteConnection = async (conn: Connection) => {
    if (!window.confirm(`Delete Connection ${conn.account_number}?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/reports/${reportId}/sheet1/connections/${conn.id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error('Failed to delete');
      await loadSheet1();
      showMsg(`Connection ${conn.account_number} deleted`, 'success');
    } catch (err: any) {
      showMsg(err.message || 'Failed to delete', 'error');
    }
  };

  // ---- Update local state with auto-calculated fields ----
  const updateConn = (index: number, field: keyof Connection, value: any) => {
    setConnections(prev => {
      const updated = [...prev];
      const c = { ...updated[index], [field]: value };

      // Calculate billing_days from period
      if (c.billing_period_from && c.billing_period_to) {
        const from = new Date(c.billing_period_from);
        const to = new Date(c.billing_period_to);
        const diff = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
        c.billing_days = diff > 0 ? diff : 0;
      } else {
        c.billing_days = null;
      }

      // PF = kWH / kVAH
      if (c.units_kwh && c.units_kvah && c.units_kvah > 0) {
        c.pf = Math.round((c.units_kwh / c.units_kvah) * 10000) / 10000;
      } else {
        c.pf = null;
      }

      // Monthly bill = fixed + energy + taxes + other
      const charges = [c.fixed_charges, c.energy_charges, c.taxes_and_rent, c.other_charges];
      if (charges.some(v => v !== null && v !== undefined)) {
        c.monthly_bill = charges.reduce((s: number, v) => s + (v || 0), 0);
      } else {
        c.monthly_bill = null;
      }

      // Unit consumption per day = kVAH / billing_days
      if (c.units_kvah && c.billing_days && c.billing_days > 0) {
        c.unit_consumption_per_day = Math.round((c.units_kvah / c.billing_days) * 10000) / 10000;
      } else {
        c.unit_consumption_per_day = null;
      }

      // Avg per unit cost = monthly_bill / kVAH
      if (c.monthly_bill && c.units_kvah && c.units_kvah > 0) {
        c.avg_per_unit_cost = Math.round((c.monthly_bill / c.units_kvah) * 10000) / 10000;
      } else {
        c.avg_per_unit_cost = null;
      }

      updated[index] = c;
      return updated;
    });
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
            <button
              className="btn-add-conn"
              onClick={handleAddConnection}
              disabled={addingConnection}
            >
              {addingConnection ? 'Adding...' : '+ Add Connection'}
            </button>
          </div>

          {sheet1Loading ? (
            <p className="sheet-loading">Loading connections...</p>
          ) : connections.length === 0 ? (
            <div className="sheet-empty">
              <p>No electrical connections added yet.</p>
              <p className="sheet-empty-sub">Click "+ Add Connection" to start recording data.</p>
            </div>
          ) : (
            <div className="connections-list">
              {connections.map((conn, idx) => (
                <div className="connection-card" key={conn.id}>
                  <div className="conn-header">
                    <div className="conn-title">
                      <h3>Connection {conn.account_number}</h3>
                      <span className="conn-date">
                        Recorded: {conn.entry_date ? new Date(conn.entry_date).toLocaleDateString() : '—'}
                      </span>
                      {conn.is_diesel_generator && <span className="dg-badge">⚡ DG</span>}
                      {conn.is_solar && <span className="solar-badge">☀ Solar</span>}
                    </div>
                    <div className="conn-actions">
                      <button
                        className="btn-save-conn"
                        onClick={() => handleSaveConnection(conn)}
                        disabled={savingId === conn.id}
                      >
                        {savingId === conn.id ? 'Saving...' : 'Save'}
                      </button>
                      <button className="btn-delete-conn" onClick={() => handleDeleteConnection(conn)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Row 1: Account info */}
                  <div className="conn-fields">
                    <div className="form-group">
                      <label>Utility Billing Account No.</label>
                      <input
                        type="text"
                        value={conn.billing_account_no || ''}
                        onChange={e => updateConn(idx, 'billing_account_no', e.target.value || null)}
                        placeholder="e.g. ACC-001234"
                      />
                    </div>
                    <div className="form-group">
                      <label>Sanctioned Contract Demand (kVA)</label>
                      <input
                        type="number" step="0.01" min="0"
                        value={conn.sanctioned_cd_kva ?? ''}
                        onChange={e => updateConn(idx, 'sanctioned_cd_kva', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="e.g. 500"
                      />
                    </div>
                    <div className="form-group">
                      <label>Bill No.</label>
                      <input
                        type="text"
                        value={conn.bill_no || ''}
                        onChange={e => updateConn(idx, 'bill_no', e.target.value || null)}
                        placeholder="e.g. INV-2026-001"
                      />
                    </div>
                  </div>

                  {/* Row 2: Billing period */}
                  <div className="conn-fields" style={{ marginTop: '0.75rem' }}>
                    <div className="form-group">
                      <label>Billing Period From</label>
                      <input
                        type="date"
                        value={conn.billing_period_from || ''}
                        onChange={e => updateConn(idx, 'billing_period_from', e.target.value || null)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Billing Period To</label>
                      <input
                        type="date"
                        value={conn.billing_period_to || ''}
                        onChange={e => updateConn(idx, 'billing_period_to', e.target.value || null)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Billing Days</label>
                      <input type="number" value={conn.billing_days ?? ''} readOnly className="input-readonly" />
                    </div>
                  </div>

                  {/* Row 3: Consumption */}
                  <div className="conn-fields" style={{ marginTop: '0.75rem' }}>
                    <div className="form-group">
                      <label>Max Demand Indicator — MDI (kVA)</label>
                      <input
                        type="number" step="0.01" min="0"
                        value={conn.mdi_kva ?? ''}
                        onChange={e => updateConn(idx, 'mdi_kva', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="kVA"
                      />
                    </div>
                    <div className="form-group">
                      <label>Units Consumption (kWH)</label>
                      <input
                        type="number" step="0.01" min="0"
                        value={conn.units_kwh ?? ''}
                        onChange={e => updateConn(idx, 'units_kwh', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="kWH"
                      />
                    </div>
                    <div className="form-group">
                      <label>Units Consumption (kVAH)</label>
                      <input
                        type="number" step="0.01" min="0"
                        value={conn.units_kvah ?? ''}
                        onChange={e => updateConn(idx, 'units_kvah', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="kVAH"
                      />
                    </div>
                    <div className="form-group">
                      <label>Power Factor (PF)</label>
                      <input type="text" value={conn.pf !== null ? conn.pf.toFixed(4) : ''} readOnly className="input-readonly" />
                    </div>
                  </div>

                  {/* Row 4: Charges */}
                  <div className="conn-fields" style={{ marginTop: '0.75rem' }}>
                    <div className="form-group">
                      <label>Fixed Charges (₹)</label>
                      <input
                        type="number" step="0.01" min="0"
                        value={conn.fixed_charges ?? ''}
                        onChange={e => updateConn(idx, 'fixed_charges', e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Energy Charges (₹)</label>
                      <input
                        type="number" step="0.01" min="0"
                        value={conn.energy_charges ?? ''}
                        onChange={e => updateConn(idx, 'energy_charges', e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Taxes & Rent (₹)</label>
                      <input
                        type="number" step="0.01" min="0"
                        value={conn.taxes_and_rent ?? ''}
                        onChange={e => updateConn(idx, 'taxes_and_rent', e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Other Charges / Surcharge / Arrears / Rebates (₹)</label>
                      <input
                        type="number" step="0.01"
                        value={conn.other_charges ?? ''}
                        onChange={e => updateConn(idx, 'other_charges', e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    </div>
                  </div>

                  {/* Row 5: Calculated totals */}
                  <div className="conn-fields calculated-row" style={{ marginTop: '0.75rem' }}>
                    <div className="form-group">
                      <label>Monthly Electricity Bill (₹)</label>
                      <input type="text" value={conn.monthly_bill !== null ? conn.monthly_bill.toFixed(2) : ''} readOnly className="input-readonly" />
                    </div>
                    <div className="form-group">
                      <label>Unit Consumption/Day (kVAH)</label>
                      <input type="text" value={conn.unit_consumption_per_day !== null ? conn.unit_consumption_per_day.toFixed(4) : ''} readOnly className="input-readonly" />
                    </div>
                    <div className="form-group">
                      <label>Avg. Per Unit Cost (₹/kVAH)</label>
                      <input type="text" value={conn.avg_per_unit_cost !== null ? conn.avg_per_unit_cost.toFixed(4) : ''} readOnly className="input-readonly" />
                    </div>
                  </div>

                  {/* Row 6: Flags */}
                  <div className="conn-fields" style={{ marginTop: '0.75rem' }}>
                    <div className="form-group">
                      <label>Diesel Generator?</label>
                      <select
                        value={conn.is_diesel_generator ? 'yes' : 'no'}
                        onChange={e => updateConn(idx, 'is_diesel_generator', e.target.value === 'yes')}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Solar Connection?</label>
                      <select
                        value={conn.is_solar ? 'yes' : 'no'}
                        onChange={e => updateConn(idx, 'is_solar', e.target.value === 'yes')}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
