import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../App';
import type { UserInfo } from '../App';
import './ReportDetailPage.css';

interface Report {
  id: number; report_uid: string; status: string;
  client_representative: string; facility_name: string;
  auditor_name: string; created_at: string;
}

interface Bill {
  id: number;
  billing_period_from: string | null; billing_period_to: string | null;
  billing_days: number | null; bill_no: string | null;
  mdi_kva: number | null; units_kwh: number | null; units_kvah: number | null;
  pf: number | null;
  fixed_charges: number | null; energy_charges: number | null;
  taxes_and_rent: number | null; other_charges: number | null;
  monthly_bill: number | null; unit_consumption_per_day: number | null;
  avg_per_unit_cost: number | null;
}

interface Connection {
  id: number; account_number: number; entry_date: string | null;
  billing_account_no: string | null; sanctioned_cd_kva: number | null;
  is_diesel_generator: boolean; is_solar: boolean;
  bills: Bill[]; bill_count: number; total_monthly_bill: number;
}

interface Props { reportId: number; user: UserInfo; onBack: () => void; }

export default function ReportDetailPage({ reportId, user: _user, onBack }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [sheet1Loading, setSheet1Loading] = useState(true);
  const [expandedConn, setExpandedConn] = useState<number | null>(null);
  const [addingConn, setAddingConn] = useState(false);
  const [savingConnId, setSavingConnId] = useState<number | null>(null);
  const [savingBillId, setSavingBillId] = useState<number | null>(null);
  const [addingBillForConn, setAddingBillForConn] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const token = localStorage.getItem('token');
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMsg({ text, type }); setTimeout(() => setMsg(null), 4000);
  };

  const loadReport = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/reports/${reportId}`, { headers: h });
      if (!r.ok) throw new Error(); setReport(await r.json());
    } catch { showMsg('Failed to load report', 'error'); }
    finally { setLoading(false); }
  }, [reportId]);

  const loadSheet1 = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/reports/${reportId}/sheet1`, { headers: h });
      if (!r.ok) throw new Error(); const d = await r.json();
      setConnections(d.connections || []);
    } catch { showMsg('Failed to load Sheet 1', 'error'); }
    finally { setSheet1Loading(false); }
  }, [reportId]);

  useEffect(() => { loadReport(); loadSheet1(); }, [loadReport, loadSheet1]);

  // ---- Connection CRUD ----
  const handleAddConn = async () => {
    setAddingConn(true);
    try {
      const r = await fetch(`${API_URL}/api/reports/${reportId}/sheet1/connections`, {
        method: 'POST', headers: h, body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error((await r.json()).detail);
      await loadSheet1(); await loadReport(); showMsg('Connection added', 'success');
    } catch (e: any) { showMsg(e.message, 'error'); }
    finally { setAddingConn(false); }
  };

  const handleSaveConn = async (c: Connection) => {
    setSavingConnId(c.id);
    try {
      const r = await fetch(`${API_URL}/api/reports/${reportId}/sheet1/connections/${c.id}`, {
        method: 'PUT', headers: h,
        body: JSON.stringify({ billing_account_no: c.billing_account_no, sanctioned_cd_kva: c.sanctioned_cd_kva, is_diesel_generator: c.is_diesel_generator, is_solar: c.is_solar }),
      });
      if (!r.ok) throw new Error((await r.json()).detail);
      showMsg(`Connection ${c.account_number} saved`, 'success');
    } catch (e: any) { showMsg(e.message, 'error'); }
    finally { setSavingConnId(null); }
  };

  const handleDeleteConn = async (c: Connection) => {
    if (!confirm(`Delete Connection ${c.account_number} and all its bills?`)) return;
    try {
      await fetch(`${API_URL}/api/reports/${reportId}/sheet1/connections/${c.id}`, { method: 'DELETE', headers: h });
      await loadSheet1(); showMsg('Connection deleted', 'success');
    } catch { showMsg('Failed to delete', 'error'); }
  };

  const updateConn = (idx: number, field: keyof Connection, value: any) => {
    setConnections(p => { const u = [...p]; u[idx] = { ...u[idx], [field]: value }; return u; });
  };

  // ---- Bill CRUD ----
  const handleAddBill = async (connId: number) => {
    setAddingBillForConn(connId);
    try {
      const r = await fetch(`${API_URL}/api/reports/${reportId}/sheet1/connections/${connId}/bills`, {
        method: 'POST', headers: h, body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error((await r.json()).detail);
      await loadSheet1(); showMsg('Bill added', 'success');
    } catch (e: any) { showMsg(e.message, 'error'); }
    finally { setAddingBillForConn(null); }
  };

  const handleSaveBill = async (bill: Bill) => {
    setSavingBillId(bill.id);
    try {
      const r = await fetch(`${API_URL}/api/reports/${reportId}/sheet1/bills/${bill.id}`, {
        method: 'PUT', headers: h,
        body: JSON.stringify({
          billing_period_from: bill.billing_period_from, billing_period_to: bill.billing_period_to,
          bill_no: bill.bill_no, mdi_kva: bill.mdi_kva,
          units_kwh: bill.units_kwh, units_kvah: bill.units_kvah,
          fixed_charges: bill.fixed_charges, energy_charges: bill.energy_charges,
          taxes_and_rent: bill.taxes_and_rent, other_charges: bill.other_charges,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).detail);
      showMsg('Bill saved', 'success');
    } catch (e: any) { showMsg(e.message, 'error'); }
    finally { setSavingBillId(null); }
  };

  const handleDeleteBill = async (billId: number) => {
    if (!confirm('Delete this bill?')) return;
    try {
      await fetch(`${API_URL}/api/reports/${reportId}/sheet1/bills/${billId}`, { method: 'DELETE', headers: h });
      await loadSheet1(); showMsg('Bill deleted', 'success');
    } catch { showMsg('Failed to delete', 'error'); }
  };

  const updateBill = (connIdx: number, billIdx: number, field: keyof Bill, value: any) => {
    setConnections(prev => {
      const u = [...prev];
      const bills = [...u[connIdx].bills];
      const b = { ...bills[billIdx], [field]: value };

      // Auto-calculate
      if (b.billing_period_from && b.billing_period_to) {
        const d = Math.round((new Date(b.billing_period_to).getTime() - new Date(b.billing_period_from).getTime()) / 86400000);
        b.billing_days = d > 0 ? d : 0;
      } else { b.billing_days = null; }
      b.pf = (b.units_kwh && b.units_kvah && b.units_kvah > 0) ? Math.round((b.units_kwh / b.units_kvah) * 10000) / 10000 : null;
      const ch = [b.fixed_charges, b.energy_charges, b.taxes_and_rent, b.other_charges];
      b.monthly_bill = ch.some(v => v != null) ? ch.reduce((s: number, v) => s + (v || 0), 0) : null;
      b.unit_consumption_per_day = (b.units_kvah && b.billing_days && b.billing_days > 0) ? Math.round((b.units_kvah / b.billing_days) * 10000) / 10000 : null;
      b.avg_per_unit_cost = (b.monthly_bill && b.units_kvah && b.units_kvah > 0) ? Math.round((b.monthly_bill / b.units_kvah) * 10000) / 10000 : null;

      bills[billIdx] = b;
      u[connIdx] = { ...u[connIdx], bills };
      return u;
    });
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
        <div>
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
        </div>
      </header>

      <main className="rd-main">
        {msg && <div className={`rd-message rd-message-${msg.type}`}>{msg.text}</div>}

        <section className="sheet-section">
          <div className="sheet-header">
            <h2>Sheet 1 — Energy Consumption Data (Utility Supply, Last 1 Year)</h2>
            <button className="btn-add-conn" onClick={handleAddConn} disabled={addingConn}>
              {addingConn ? 'Adding...' : '+ Add Connection'}
            </button>
          </div>

          {sheet1Loading ? <p className="sheet-loading">Loading...</p> : connections.length === 0 ? (
            <div className="sheet-empty">
              <p>No electrical connections yet.</p>
              <p className="sheet-empty-sub">Click "+ Add Connection" to start.</p>
            </div>
          ) : (
            <div className="connections-list">
              {connections.map((conn, ci) => (
                <div className="connection-card" key={conn.id}>
                  {/* Summary row — always visible */}
                  <div className="conn-summary" onClick={() => setExpandedConn(expandedConn === conn.id ? null : conn.id)}>
                    <div className="conn-summary-left">
                      <h3>Connection {conn.account_number}</h3>
                      <span className="conn-meta">
                        {conn.billing_account_no || 'No account no.'} · {conn.bill_count} bill{conn.bill_count !== 1 ? 's' : ''}
                        {conn.total_monthly_bill > 0 && ` · ₹${conn.total_monthly_bill.toLocaleString()}`}
                      </span>
                      {conn.is_diesel_generator && <span className="dg-badge">⚡ DG</span>}
                      {conn.is_solar && <span className="solar-badge">☀ Solar</span>}
                    </div>
                    <span className="expand-chevron">{expandedConn === conn.id ? '▲' : '▼'}</span>
                  </div>

                  {/* Expanded detail */}
                  {expandedConn === conn.id && (
                    <div className="conn-detail">
                      {/* Connection fields */}
                      <div className="conn-fields">
                        <div className="form-group">
                          <label>Utility Billing Account No.</label>
                          <input type="text" value={conn.billing_account_no || ''} onChange={e => updateConn(ci, 'billing_account_no', e.target.value || null)} placeholder="e.g. ACC-001234" />
                        </div>
                        <div className="form-group">
                          <label>Sanctioned CD (kVA)</label>
                          <input type="number" step="0.01" min="0" value={conn.sanctioned_cd_kva ?? ''} onChange={e => updateConn(ci, 'sanctioned_cd_kva', e.target.value ? parseFloat(e.target.value) : null)} />
                        </div>
                        <div className="form-group">
                          <label>Diesel Generator?</label>
                          <select value={conn.is_diesel_generator ? 'yes' : 'no'} onChange={e => updateConn(ci, 'is_diesel_generator', e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></select>
                        </div>
                        <div className="form-group">
                          <label>Solar Connection?</label>
                          <select value={conn.is_solar ? 'yes' : 'no'} onChange={e => updateConn(ci, 'is_solar', e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></select>
                        </div>
                      </div>
                      <div className="conn-action-bar">
                        <button className="btn-save-conn" onClick={() => handleSaveConn(conn)} disabled={savingConnId === conn.id}>
                          {savingConnId === conn.id ? 'Saving...' : 'Save Connection'}
                        </button>
                        <button className="btn-delete-conn" onClick={() => handleDeleteConn(conn)}>Delete Connection</button>
                      </div>

                      {/* Bills section */}
                      <div className="bills-section">
                        <div className="bills-header">
                          <h4>Bills</h4>
                          <button className="btn-add-bill" onClick={() => handleAddBill(conn.id)} disabled={addingBillForConn === conn.id}>
                            {addingBillForConn === conn.id ? 'Adding...' : '+ Add Bill'}
                          </button>
                        </div>
                        {conn.bills.length === 0 ? (
                          <p className="bills-empty">No bills yet. Click "+ Add Bill" to add billing data.</p>
                        ) : conn.bills.map((bill, bi) => (
                          <div className="bill-card" key={bill.id}>
                            <div className="bill-title">
                              <span>Bill {bi + 1}{bill.bill_no ? ` — ${bill.bill_no}` : ''}</span>
                              <div className="bill-actions">
                                <button className="btn-save-bill" onClick={() => handleSaveBill(bill)} disabled={savingBillId === bill.id}>
                                  {savingBillId === bill.id ? '...' : 'Save'}
                                </button>
                                <button className="btn-del-bill" onClick={() => handleDeleteBill(bill.id)}>✕</button>
                              </div>
                            </div>
                            {/* Billing period */}
                            <div className="bill-fields">
                              <div className="form-group"><label>Billing From</label><input type="date" value={bill.billing_period_from || ''} onChange={e => updateBill(ci, bi, 'billing_period_from', e.target.value || null)} /></div>
                              <div className="form-group"><label>Billing To</label><input type="date" value={bill.billing_period_to || ''} onChange={e => updateBill(ci, bi, 'billing_period_to', e.target.value || null)} /></div>
                              <div className="form-group"><label>Billing Days</label><input type="number" value={bill.billing_days ?? ''} readOnly className="input-readonly" /></div>
                              <div className="form-group"><label>Bill No.</label><input type="text" value={bill.bill_no || ''} onChange={e => updateBill(ci, bi, 'bill_no', e.target.value || null)} /></div>
                            </div>
                            {/* Consumption */}
                            <div className="bill-fields">
                              <div className="form-group"><label>MDI (kVA)</label><input type="number" step="0.01" value={bill.mdi_kva ?? ''} onChange={e => updateBill(ci, bi, 'mdi_kva', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                              <div className="form-group"><label>Units (kWH)</label><input type="number" step="0.01" value={bill.units_kwh ?? ''} onChange={e => updateBill(ci, bi, 'units_kwh', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                              <div className="form-group"><label>Units (kVAH)</label><input type="number" step="0.01" value={bill.units_kvah ?? ''} onChange={e => updateBill(ci, bi, 'units_kvah', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                              <div className="form-group"><label>PF</label><input type="text" value={bill.pf != null ? bill.pf.toFixed(4) : ''} readOnly className="input-readonly" /></div>
                            </div>
                            {/* Charges */}
                            <div className="bill-fields">
                              <div className="form-group"><label>Fixed Charges (₹)</label><input type="number" step="0.01" value={bill.fixed_charges ?? ''} onChange={e => updateBill(ci, bi, 'fixed_charges', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                              <div className="form-group"><label>Energy Charges (₹)</label><input type="number" step="0.01" value={bill.energy_charges ?? ''} onChange={e => updateBill(ci, bi, 'energy_charges', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                              <div className="form-group"><label>Taxes & Rent (₹)</label><input type="number" step="0.01" value={bill.taxes_and_rent ?? ''} onChange={e => updateBill(ci, bi, 'taxes_and_rent', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                              <div className="form-group"><label>Other Charges (₹)</label><input type="number" step="0.01" value={bill.other_charges ?? ''} onChange={e => updateBill(ci, bi, 'other_charges', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                            </div>
                            {/* Calculated */}
                            <div className="bill-fields calculated-row">
                              <div className="form-group"><label>Monthly Bill (₹)</label><input type="text" value={bill.monthly_bill != null ? bill.monthly_bill.toFixed(2) : ''} readOnly className="input-readonly" /></div>
                              <div className="form-group"><label>Consumption/Day (kVAH)</label><input type="text" value={bill.unit_consumption_per_day != null ? bill.unit_consumption_per_day.toFixed(4) : ''} readOnly className="input-readonly" /></div>
                              <div className="form-group"><label>Avg Cost (₹/kVAH)</label><input type="text" value={bill.avg_per_unit_cost != null ? bill.avg_per_unit_cost.toFixed(4) : ''} readOnly className="input-readonly" /></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
