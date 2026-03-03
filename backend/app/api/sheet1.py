"""Sheet 1 — Energy Consumption Bills API."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.database import get_connection
from app.core.security import get_current_user

router = APIRouter()


class BillCreate(BaseModel):
    billing_period_from: str | None = None
    billing_period_to: str | None = None
    bill_no: str | None = None
    mdi_kva: float | None = None
    units_kwh: float | None = None
    units_kvah: float | None = None
    fixed_charges: float | None = None
    energy_charges: float | None = None
    taxes_and_rent: float | None = None
    other_charges: float | None = None


class BillUpdate(BillCreate):
    pass


def _check_connection_access(cursor, report_id: int, conn_id: int, user: dict):
    cursor.execute("SELECT c.id FROM connections c JOIN reports r ON c.report_id = r.id WHERE c.id = ? AND c.report_id = ?", conn_id, report_id)
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Connection not found")
    cursor.execute("SELECT auditor_id FROM reports WHERE id = ?", report_id)
    row = cursor.fetchone()
    if user["role"] not in ("super", "admin") and row.auditor_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")


def _calc(req):
    billing_days = None
    if req.billing_period_from and req.billing_period_to:
        try:
            d1 = datetime.strptime(req.billing_period_from, "%Y-%m-%d")
            d2 = datetime.strptime(req.billing_period_to, "%Y-%m-%d")
            billing_days = max((d2 - d1).days, 0)
        except ValueError:
            pass
    pf = round(req.units_kwh / req.units_kvah, 4) if req.units_kwh and req.units_kvah and req.units_kvah > 0 else None
    ch = [req.fixed_charges, req.energy_charges, req.taxes_and_rent, req.other_charges]
    monthly_bill = sum(c or 0 for c in ch) if any(c is not None for c in ch) else None
    upd = round(req.units_kvah / billing_days, 4) if req.units_kvah and billing_days and billing_days > 0 else None
    apc = round(monthly_bill / req.units_kvah, 4) if monthly_bill and req.units_kvah and req.units_kvah > 0 else None
    return billing_days, pf, monthly_bill, upd, apc


def _float(v):
    return float(v) if v is not None else None


def _bill_dict(b):
    return {
        "id": b.id, "billing_period_from": str(b.billing_period_from) if b.billing_period_from else None,
        "billing_period_to": str(b.billing_period_to) if b.billing_period_to else None,
        "billing_days": b.billing_days, "bill_no": b.bill_no,
        "mdi_kva": _float(b.mdi_kva), "units_kwh": _float(b.units_kwh), "units_kvah": _float(b.units_kvah), "pf": _float(b.pf),
        "fixed_charges": _float(b.fixed_charges), "energy_charges": _float(b.energy_charges),
        "taxes_and_rent": _float(b.taxes_and_rent), "other_charges": _float(b.other_charges),
        "monthly_bill": _float(b.monthly_bill), "unit_consumption_per_day": _float(b.unit_consumption_per_day),
        "avg_per_unit_cost": _float(b.avg_per_unit_cost),
    }


@router.get("/{report_id}/connections/{conn_id}/sheet1")
def get_bills(report_id: int, conn_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_connection_access(cursor, report_id, conn_id, current_user)
        cursor.execute(
            """SELECT id, billing_period_from, billing_period_to, billing_days, bill_no,
                      mdi_kva, units_kwh, units_kvah, pf,
                      fixed_charges, energy_charges, taxes_and_rent, other_charges,
                      monthly_bill, unit_consumption_per_day, avg_per_unit_cost
               FROM sheet1_bills WHERE connection_id = ? ORDER BY billing_period_from, id""",
            conn_id,
        )
        return [_bill_dict(b) for b in cursor.fetchall()]
    finally:
        conn.close()


@router.post("/{report_id}/connections/{conn_id}/sheet1", status_code=status.HTTP_201_CREATED)
def add_bill(report_id: int, conn_id: int, req: BillCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_connection_access(cursor, report_id, conn_id, current_user)
        bd, pf, mb, upd, apc = _calc(req)
        cursor.execute(
            """INSERT INTO sheet1_bills (connection_id, billing_period_from, billing_period_to, billing_days, bill_no,
                 mdi_kva, units_kwh, units_kvah, pf, fixed_charges, energy_charges, taxes_and_rent, other_charges,
                 monthly_bill, unit_consumption_per_day, avg_per_unit_cost)
               OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            conn_id, req.billing_period_from, req.billing_period_to, bd, req.bill_no,
            req.mdi_kva, req.units_kwh, req.units_kvah, pf,
            req.fixed_charges, req.energy_charges, req.taxes_and_rent, req.other_charges, mb, upd, apc,
        )
        bill_id = cursor.fetchone().id
        conn.commit()
        return {"id": bill_id}
    finally:
        conn.close()


@router.put("/{report_id}/connections/{conn_id}/sheet1/{bill_id}")
def update_bill(report_id: int, conn_id: int, bill_id: int, req: BillUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_connection_access(cursor, report_id, conn_id, current_user)
        cursor.execute("SELECT id FROM sheet1_bills WHERE id = ? AND connection_id = ?", bill_id, conn_id)
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Bill not found")
        bd, pf, mb, upd, apc = _calc(req)
        cursor.execute(
            """UPDATE sheet1_bills SET billing_period_from=?, billing_period_to=?, billing_days=?, bill_no=?,
                 mdi_kva=?, units_kwh=?, units_kvah=?, pf=?, fixed_charges=?, energy_charges=?, taxes_and_rent=?,
                 other_charges=?, monthly_bill=?, unit_consumption_per_day=?, avg_per_unit_cost=?, updated_at=GETUTCDATE()
               WHERE id=?""",
            req.billing_period_from, req.billing_period_to, bd, req.bill_no,
            req.mdi_kva, req.units_kwh, req.units_kvah, pf,
            req.fixed_charges, req.energy_charges, req.taxes_and_rent, req.other_charges, mb, upd, apc, bill_id,
        )
        conn.commit()
        return {"message": "Bill updated"}
    finally:
        conn.close()


@router.delete("/{report_id}/connections/{conn_id}/sheet1/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bill(report_id: int, conn_id: int, bill_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_connection_access(cursor, report_id, conn_id, current_user)
        cursor.execute("SELECT id FROM sheet1_bills WHERE id = ? AND connection_id = ?", bill_id, conn_id)
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Bill not found")
        cursor.execute("DELETE FROM sheet1_bills WHERE id = ?", bill_id)
        conn.commit()
    finally:
        conn.close()
