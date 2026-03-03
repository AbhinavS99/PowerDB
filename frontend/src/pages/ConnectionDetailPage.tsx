import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../App';
import type { UserInfo } from '../App';
import './ConnectionDetailPage.css';

interface ConnectionInfo {
  id: number; report_id: number; account_number: number; entry_date: string | null;
  billing_account_no: string | null; sanctioned_cd_kva: number | null;
  is_diesel_generator: boolean; is_solar: boolean;
}

interface Bill {
  id: number;
  billing_period_from: string | null; billing_period_to: string | null;
  billing_days: number | null; bill_no: string | null;
  mdi_kva: number | null; units_kwh: number | null; units_kvah: number | null; pf: number | null;
  fixed_charges: number | null; energy_charges: number | null;
  taxes_and_rent: number | null; other_charges: number | null;
  monthly_bill: number | null; unit_consumption_per_day: number | null; avg_per_unit_cost: number | null;
}

interface Props { reportId: number; connectionId: number; user: UserInfo; onBack: () => void; }

type TabId = 'info' | 'sheet1' | 'sheet2';

export default function ConnectionDetailPage({ reportId, connectionId, user: _user, onBack }: Props) {
  const [conn, setConn] = useState<ConnectionInfo | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [saving, setSaving] = useState(false);
  const [addingBill, setAddingBill] = useState(false);
  const [savingBillId, setSavingBillId] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const token = localStorage.getItem('token');
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const showMsg = (t: string, type: 'success' | 'error') => { setMsg({ text: t, type }); setTimeout(() => setMsg(null), 4000); };

  const loadConn = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/reports/${reportId}/connections/${connectionId}`, { headers: h });
      if (r.ok) setConn(await r.json());
    } catch {} finally { setLoading(false); }
  }, [reportId, connectionId]);

  const loadBills = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/reports/${reportId}/connections/${connectionId}/sheet1`, { headers: h });
      if (r.ok) setBills(await r.json());
    } catch {}
  }, [reportId, connectionId]);

  useEffect(() => { loadConn(); loadBills(); }, [loadConn, loadBills]);

  // ---- Connection save ----
  const saveConn = async () => {
    if (!conn) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_URL}/api/reports/${reportId}/connections/${connectionId}`, {
        method: 'PUT', headers: h,
        body: JSON.stringify({ billing_account_no: conn.billing_account_no, sanctioned_cd_kva: conn.sanctioned_cd_kva, is_diesel_generator: conn.is_diesel_generator, is_solar: conn.is_solar }),
      });
      if (!r.ok) throw new Error((await r.json()).detail);
      showMsg('Connection saved', 'success');
    } catch (e: any) { showMsg(e.message, 'error'); }
    finally { setSaving(false); }
  };

  // ---- Bill CRUD ----
  const addBill = async () => {
    setAddingBill(true);
    try {
      const r = await fetch(`${API_URL}/api/reports/${reportId}/connections/${connectionId}/sheet1`, { method: 'POST', headers: h, body: '{}' });
      if (!r.ok) throw new Error((await r.json()).detail);
      await loadBills(); showMsg('Bill added', 'success');
    } catch (e: any) { showMsg(e.message, 'error'); }
    finally { setAddingBill(false); }
  };

  const saveBill = async (bill: Bill) => {
    setSavingBillId(bill.id);
    try {
      const r = await fetch(`${API_URL}/api/reports/${reportId}/connections/${connectionId}/sheet1/${bill.id}`, {
        method: 'PUT', headers: h,
        body: JSON.stringify({
          billing_period_from: bill.billing_period_from, billing_period_to: bill.billing_period_to,
          bill_no: bill.bill_no, mdi_kva: bill.mdi_kva, units_kwh: bill.units_kwh, units_kvah: bill.units_kvah,
          fixed_charges: bill.fixed_charges, energy_charges: bill.energy_charges,
          taxes_and_rent: bill.taxes_and_rent, other_charges: bill.other_charges,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).detail);
      showMsg('Bill saved', 'success');
    } catch (e: any) { showMsg(e.message, 'error'); }
    finally { setSavingBillId(null); }
  };

  const deleteBill = async (billId: number) => {
    if (!confirm('Delete this bill?')) return;
    try {
      await fetch(`${API_URL}/api/reports/${reportId}/connections/${connectionId}/sheet1/${billId}`, { method: 'DELETE', headers: h });
      await loadBills(); showMsg('Bill deleted', 'success');
    } catch { showMsg('Failed to delete', 'error'); }
  };

  const updateBill = (idx: number, field: keyof Bill, value: any) => {
    setBills(prev => {
      const u = [...prev]; const b = { ...u[idx], [field]: value };
      if (b.billing_period_from && b.billing_period_to) {
        const d = Math.round((new Date(b.billing_period_to).getTime() - new Date(b.billing_period_from).getTime()) / 86400000);
        b.billing_days = d > 0 ? d : 0;
      } else b.billing_days = null;
      b.pf = (b.units_kwh && b.units_kvah && b.units_kvah > 0) ? Math.round((b.units_kwh / b.units_kvah) * 10000) / 10000 : null;
      const ch = [b.fixed_charges, b.energy_charges, b.taxes_and_rent, b.other_charges];
      b.monthly_bill = ch.some(v => v != null) ? ch.reduce((s: number, v) => s + (v || 0), 0) : null;
      b.unit_consumption_per_day = (b.units_kvah && b.billing_days && b.billing_days > 0) ? Math.round((b.units_kvah / b.billing_days) * 10000) / 10000 : null;
      b.avg_per_unit_cost = (b.monthly_bill && b.units_kvah && b.units_kvah > 0) ? Math.round((b.monthly_bill / b.units_kvah) * 10000) / 10000 : null;
      u[idx] = b; return u;
    });
  };

  const updateConn = (field: keyof ConnectionInfo, value: any) => {
    setConn(prev => prev ? { ...prev, [field]: value } : prev);
  };

  // Tab definitions
  const tabs: { id: TabId; label: string; enabled: boolean; reason?: string }[] = [
    { id: 'info', label: 'Connection Info', enabled: true },
    { id: 'sheet1', label: 'Sheet 1: Energy Bills', enabled: true },
    { id: 'sheet2', label: 'Sheet 2: Solar', enabled: conn?.is_solar ?? false, reason: 'Enable Solar in Connection Info' },
  ];

  if (loading || !conn) return <div className="cd-loading">{loading ? 'Loading...' : 'Connection not found.'}</div>;

  return (
    <div className="conn-detail-page">
      <header className="cd-header">
        <button className="btn-back" onClick={onBack}>← Back to Report</button>
        <h1>Connection {conn.account_number}</h1>
        <span className="cd-meta">{conn.billing_account_no || 'No account no.'} · {conn.sanctioned_cd_kva ? `${conn.sanctioned_cd_kva} kVA` : 'No CD set'}</span>
      </header>

      {/* Tabs */}
      <nav className="cd-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`cd-tab ${activeTab === tab.id ? 'active' : ''} ${!tab.enabled ? 'disabled' : ''}`}
            onClick={() => tab.enabled && setActiveTab(tab.id)}
            title={!tab.enabled ? tab.reason : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="cd-main">
        {msg && <div className={`cd-msg cd-msg-${msg.type}`}>{msg.text}</div>}

        {/* ===== INFO TAB ===== */}
        {activeTab === 'info' && (
          <section className="tab-content">
            <div className="info-fields">
              <div className="form-group">
                <label>Utility Billing Account No.</label>
                <input type="text" value={conn.billing_account_no || ''} onChange={e => updateConn('billing_account_no', e.target.value || null)} placeholder="e.g. ACC-001234" />
              </div>
              <div className="form-group">
                <label>Sanctioned Contract Demand (kVA)</label>
                <input type="number" step="0.01" min="0" value={conn.sanctioned_cd_kva ?? ''} onChange={e => updateConn('sanctioned_cd_kva', e.target.value ? parseFloat(e.target.value) : null)} />
              </div>
              <div className="form-group">
                <label>Diesel Generator?</label>
                <select value={conn.is_diesel_generator ? 'yes' : 'no'} onChange={e => updateConn('is_diesel_generator', e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></select>
              </div>
              <div className="form-group">
                <label>Solar Connection?</label>
                <select value={conn.is_solar ? 'yes' : 'no'} onChange={e => updateConn('is_solar', e.target.value === 'yes')}><option value="no">No</option><option value="yes">Yes</option></select>
              </div>
            </div>
            <button className="btn-primary" onClick={saveConn} disabled={saving} style={{ marginTop: '1rem' }}>
              {saving ? 'Saving...' : 'Save Connection Info'}
            </button>
          </section>
        )}

        {/* ===== SHEET 1 TAB ===== */}
        {activeTab === 'sheet1' && (
          <section className="tab-content">
            <div className="tab-header">
              <h3>Energy Consumption Bills</h3>
              <button className="btn-add-bill" onClick={addBill} disabled={addingBill}>
                {addingBill ? 'Adding...' : '+ Add Bill'}
              </button>
            </div>

            {bills.length === 0 ? (
              <p className="tab-empty">No bills yet. Click "+ Add Bill" to start.</p>
            ) : bills.map((bill, bi) => (
              <div className="bill-card" key={bill.id}>
                <div className="bill-top">
                  <span className="bill-label">Bill {bi + 1}{bill.bill_no ? ` — ${bill.bill_no}` : ''}</span>
                  <div className="bill-actions">
                    <button className="btn-save-sm" onClick={() => saveBill(bill)} disabled={savingBillId === bill.id}>
                      {savingBillId === bill.id ? '...' : 'Save'}
                    </button>
                    <button className="btn-del-sm" onClick={() => deleteBill(bill.id)}>✕</button>
                  </div>
                </div>
                <div className="bill-grid">
                  <div className="form-group"><label>Billing From</label><input type="date" value={bill.billing_period_from || ''} onChange={e => updateBill(bi, 'billing_period_from', e.target.value || null)} /></div>
                  <div className="form-group"><label>Billing To</label><input type="date" value={bill.billing_period_to || ''} onChange={e => updateBill(bi, 'billing_period_to', e.target.value || null)} /></div>
                  <div className="form-group"><label>Billing Days</label><input value={bill.billing_days ?? ''} readOnly className="readonly" /></div>
                  <div className="form-group"><label>Bill No.</label><input value={bill.bill_no || ''} onChange={e => updateBill(bi, 'bill_no', e.target.value || null)} /></div>
                </div>
                <div className="bill-grid">
                  <div className="form-group"><label>MDI (kVA)</label><input type="number" step="0.01" value={bill.mdi_kva ?? ''} onChange={e => updateBill(bi, 'mdi_kva', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                  <div className="form-group"><label>Units (kWH)</label><input type="number" step="0.01" value={bill.units_kwh ?? ''} onChange={e => updateBill(bi, 'units_kwh', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                  <div className="form-group"><label>Units (kVAH)</label><input type="number" step="0.01" value={bill.units_kvah ?? ''} onChange={e => updateBill(bi, 'units_kvah', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                  <div className="form-group"><label>PF</label><input value={bill.pf != null ? bill.pf.toFixed(4) : ''} readOnly className="readonly" /></div>
                </div>
                <div className="bill-grid">
                  <div className="form-group"><label>Fixed Charges (₹)</label><input type="number" step="0.01" value={bill.fixed_charges ?? ''} onChange={e => updateBill(bi, 'fixed_charges', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                  <div className="form-group"><label>Energy Charges (₹)</label><input type="number" step="0.01" value={bill.energy_charges ?? ''} onChange={e => updateBill(bi, 'energy_charges', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                  <div className="form-group"><label>Taxes & Rent (₹)</label><input type="number" step="0.01" value={bill.taxes_and_rent ?? ''} onChange={e => updateBill(bi, 'taxes_and_rent', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                  <div className="form-group"><label>Other Charges (₹)</label><input type="number" step="0.01" value={bill.other_charges ?? ''} onChange={e => updateBill(bi, 'other_charges', e.target.value ? parseFloat(e.target.value) : null)} /></div>
                </div>
                <div className="bill-grid calc-row">
                  <div className="form-group"><label>Monthly Bill (₹)</label><input value={bill.monthly_bill != null ? bill.monthly_bill.toFixed(2) : ''} readOnly className="readonly" /></div>
                  <div className="form-group"><label>Consumption/Day (kVAH)</label><input value={bill.unit_consumption_per_day != null ? bill.unit_consumption_per_day.toFixed(4) : ''} readOnly className="readonly" /></div>
                  <div className="form-group"><label>Avg Cost (₹/kVAH)</label><input value={bill.avg_per_unit_cost != null ? bill.avg_per_unit_cost.toFixed(4) : ''} readOnly className="readonly" /></div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ===== SHEET 2 TAB (placeholder) ===== */}
        {activeTab === 'sheet2' && (
          <section className="tab-content">
            <p className="tab-empty">Sheet 2 — Solar data placeholder. Coming soon.</p>
          </section>
        )}
      </main>
    </div>
  );
}
