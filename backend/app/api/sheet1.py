from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.database import get_connection
from app.core.security import get_current_user

router = APIRouter()


# ---------- Models ----------

class AccountCreate(BaseModel):
    billing_account_no: str | None = None
    sanctioned_cd_kva: float | None = None
    is_diesel_generator: bool = False
    is_solar: bool = False


class AccountUpdate(BaseModel):
    billing_account_no: str | None = None
    sanctioned_cd_kva: float | None = None
    is_diesel_generator: bool = False
    is_solar: bool = False


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


# ---------- Helpers ----------

def _check_report_access(cursor, report_id: int, current_user: dict):
    cursor.execute("SELECT auditor_id FROM reports WHERE id = ?", report_id)
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    if current_user["role"] not in ("super", "admin") and row.auditor_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")


def _ensure_sheet1(cursor, report_id: int) -> int:
    cursor.execute("SELECT id FROM sheet1_energy_consumption WHERE report_id = ?", report_id)
    row = cursor.fetchone()
    if row:
        return row.id
    cursor.execute(
        "INSERT INTO sheet1_energy_consumption (report_id, num_accounts) OUTPUT INSERTED.id VALUES (?, 0)",
        report_id,
    )
    return cursor.fetchone().id


def _sync_account_count(cursor, sheet1_id: int):
    cursor.execute("SELECT COUNT(*) FROM sheet1_accounts WHERE sheet1_id = ?", sheet1_id)
    count = cursor.fetchone()[0]
    cursor.execute(
        "UPDATE sheet1_energy_consumption SET num_accounts = ?, updated_at = GETUTCDATE() WHERE id = ?",
        count, sheet1_id,
    )


def _calc_bill_fields(req):
    """Compute derived fields for a bill."""
    billing_days = None
    if req.billing_period_from and req.billing_period_to:
        try:
            d_from = datetime.strptime(req.billing_period_from, "%Y-%m-%d")
            d_to = datetime.strptime(req.billing_period_to, "%Y-%m-%d")
            billing_days = max((d_to - d_from).days, 0)
        except ValueError:
            pass

    pf = None
    if req.units_kwh and req.units_kvah and req.units_kvah > 0:
        pf = round(req.units_kwh / req.units_kvah, 4)

    charges = [req.fixed_charges, req.energy_charges, req.taxes_and_rent, req.other_charges]
    monthly_bill = sum(c or 0 for c in charges) if any(c is not None for c in charges) else None

    unit_per_day = None
    if req.units_kvah and billing_days and billing_days > 0:
        unit_per_day = round(req.units_kvah / billing_days, 4)

    avg_cost = None
    if req.units_kvah and req.units_kvah > 0 and monthly_bill:
        avg_cost = round(monthly_bill / req.units_kvah, 4)

    return billing_days, pf, monthly_bill, unit_per_day, avg_cost


def _float(v):
    return float(v) if v is not None else None


def _bill_to_dict(b):
    return {
        "id": b.id,
        "billing_period_from": str(b.billing_period_from) if b.billing_period_from else None,
        "billing_period_to": str(b.billing_period_to) if b.billing_period_to else None,
        "billing_days": b.billing_days,
        "bill_no": b.bill_no,
        "mdi_kva": _float(b.mdi_kva),
        "units_kwh": _float(b.units_kwh),
        "units_kvah": _float(b.units_kvah),
        "pf": _float(b.pf),
        "fixed_charges": _float(b.fixed_charges),
        "energy_charges": _float(b.energy_charges),
        "taxes_and_rent": _float(b.taxes_and_rent),
        "other_charges": _float(b.other_charges),
        "monthly_bill": _float(b.monthly_bill),
        "unit_consumption_per_day": _float(b.unit_consumption_per_day),
        "avg_per_unit_cost": _float(b.avg_per_unit_cost),
    }


# ===== CONNECTION ENDPOINTS =====

@router.get("/{report_id}/sheet1")
def get_sheet1(report_id: int, current_user: dict = Depends(get_current_user)):
    """Get Sheet 1 connections with their bills."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_report_access(cursor, report_id, current_user)

        cursor.execute(
            "SELECT id FROM sheet1_energy_consumption WHERE report_id = ?", report_id
        )
        sheet = cursor.fetchone()
        if not sheet:
            return {"connections": []}

        cursor.execute(
            """
            SELECT id, account_number, entry_date, billing_account_no, sanctioned_cd_kva,
                   is_diesel_generator, is_solar
            FROM sheet1_accounts WHERE sheet1_id = ? ORDER BY account_number
            """,
            sheet.id,
        )
        accounts = cursor.fetchall()

        connections = []
        for a in accounts:
            cursor.execute(
                """
                SELECT id, billing_period_from, billing_period_to, billing_days, bill_no,
                       mdi_kva, units_kwh, units_kvah, pf,
                       fixed_charges, energy_charges, taxes_and_rent, other_charges,
                       monthly_bill, unit_consumption_per_day, avg_per_unit_cost
                FROM sheet1_bills WHERE account_id = ? ORDER BY billing_period_from, id
                """,
                a.id,
            )
            bills = [_bill_to_dict(b) for b in cursor.fetchall()]

            connections.append({
                "id": a.id,
                "account_number": a.account_number,
                "entry_date": str(a.entry_date) if a.entry_date else None,
                "billing_account_no": a.billing_account_no,
                "sanctioned_cd_kva": _float(a.sanctioned_cd_kva),
                "is_diesel_generator": bool(a.is_diesel_generator),
                "is_solar": bool(a.is_solar),
                "bills": bills,
                "bill_count": len(bills),
                "total_monthly_bill": sum(b["monthly_bill"] or 0 for b in bills),
            })

        return {"connections": connections}
    finally:
        conn.close()


@router.post("/{report_id}/sheet1/connections", status_code=status.HTTP_201_CREATED)
def add_connection(report_id: int, req: AccountCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_report_access(cursor, report_id, current_user)
        sheet1_id = _ensure_sheet1(cursor, report_id)

        cursor.execute("SELECT ISNULL(MAX(account_number), 0) FROM sheet1_accounts WHERE sheet1_id = ?", sheet1_id)
        next_num = cursor.fetchone()[0] + 1
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        cursor.execute(
            """
            INSERT INTO sheet1_accounts (sheet1_id, account_number, entry_date, billing_account_no, sanctioned_cd_kva, is_diesel_generator, is_solar)
            OUTPUT INSERTED.id, INSERTED.account_number
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            sheet1_id, next_num, today, req.billing_account_no, req.sanctioned_cd_kva,
            1 if req.is_diesel_generator else 0, 1 if req.is_solar else 0,
        )
        row = cursor.fetchone()
        _sync_account_count(cursor, sheet1_id)
        cursor.execute(
            "UPDATE reports SET status = 'in_progress', updated_at = GETUTCDATE() WHERE id = ? AND status = 'not_started'",
            report_id,
        )
        conn.commit()
        return {"id": row.id, "account_number": row.account_number}
    finally:
        conn.close()


@router.put("/{report_id}/sheet1/connections/{connection_id}")
def update_connection(report_id: int, connection_id: int, req: AccountUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_report_access(cursor, report_id, current_user)
        cursor.execute(
            "SELECT a.id FROM sheet1_accounts a JOIN sheet1_energy_consumption s ON a.sheet1_id = s.id WHERE a.id = ? AND s.report_id = ?",
            connection_id, report_id,
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Connection not found")

        cursor.execute(
            """
            UPDATE sheet1_accounts
            SET billing_account_no = ?, sanctioned_cd_kva = ?, is_diesel_generator = ?, is_solar = ?, updated_at = GETUTCDATE()
            WHERE id = ?
            """,
            req.billing_account_no, req.sanctioned_cd_kva,
            1 if req.is_diesel_generator else 0, 1 if req.is_solar else 0,
            connection_id,
        )
        conn.commit()
        return {"message": "Connection updated"}
    finally:
        conn.close()


@router.delete("/{report_id}/sheet1/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_connection(report_id: int, connection_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_report_access(cursor, report_id, current_user)
        cursor.execute(
            "SELECT a.id, a.sheet1_id FROM sheet1_accounts a JOIN sheet1_energy_consumption s ON a.sheet1_id = s.id WHERE a.id = ? AND s.report_id = ?",
            connection_id, report_id,
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Connection not found")

        sheet1_id = row.sheet1_id
        cursor.execute("DELETE FROM sheet1_accounts WHERE id = ?", connection_id)

        cursor.execute("SELECT id FROM sheet1_accounts WHERE sheet1_id = ? ORDER BY account_number", sheet1_id)
        for idx, acc in enumerate(cursor.fetchall(), 1):
            cursor.execute("UPDATE sheet1_accounts SET account_number = ? WHERE id = ?", idx, acc.id)

        _sync_account_count(cursor, sheet1_id)
        conn.commit()
    finally:
        conn.close()


# ===== BILL ENDPOINTS =====

@router.post("/{report_id}/sheet1/connections/{connection_id}/bills", status_code=status.HTTP_201_CREATED)
def add_bill(report_id: int, connection_id: int, req: BillCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_report_access(cursor, report_id, current_user)
        cursor.execute(
            "SELECT a.id FROM sheet1_accounts a JOIN sheet1_energy_consumption s ON a.sheet1_id = s.id WHERE a.id = ? AND s.report_id = ?",
            connection_id, report_id,
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Connection not found")

        billing_days, pf, monthly_bill, unit_per_day, avg_cost = _calc_bill_fields(req)

        cursor.execute(
            """
            INSERT INTO sheet1_bills
                (account_id, billing_period_from, billing_period_to, billing_days, bill_no,
                 mdi_kva, units_kwh, units_kvah, pf,
                 fixed_charges, energy_charges, taxes_and_rent, other_charges,
                 monthly_bill, unit_consumption_per_day, avg_per_unit_cost)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            connection_id,
            req.billing_period_from, req.billing_period_to, billing_days, req.bill_no,
            req.mdi_kva, req.units_kwh, req.units_kvah, pf,
            req.fixed_charges, req.energy_charges, req.taxes_and_rent, req.other_charges,
            monthly_bill, unit_per_day, avg_cost,
        )
        bill_id = cursor.fetchone().id
        conn.commit()
        return {"id": bill_id, "message": "Bill added"}
    finally:
        conn.close()


@router.put("/{report_id}/sheet1/bills/{bill_id}")
def update_bill(report_id: int, bill_id: int, req: BillUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_report_access(cursor, report_id, current_user)
        cursor.execute(
            """
            SELECT b.id FROM sheet1_bills b
            JOIN sheet1_accounts a ON b.account_id = a.id
            JOIN sheet1_energy_consumption s ON a.sheet1_id = s.id
            WHERE b.id = ? AND s.report_id = ?
            """,
            bill_id, report_id,
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Bill not found")

        billing_days, pf, monthly_bill, unit_per_day, avg_cost = _calc_bill_fields(req)

        cursor.execute(
            """
            UPDATE sheet1_bills
            SET billing_period_from = ?, billing_period_to = ?, billing_days = ?, bill_no = ?,
                mdi_kva = ?, units_kwh = ?, units_kvah = ?, pf = ?,
                fixed_charges = ?, energy_charges = ?, taxes_and_rent = ?, other_charges = ?,
                monthly_bill = ?, unit_consumption_per_day = ?, avg_per_unit_cost = ?,
                updated_at = GETUTCDATE()
            WHERE id = ?
            """,
            req.billing_period_from, req.billing_period_to, billing_days, req.bill_no,
            req.mdi_kva, req.units_kwh, req.units_kvah, pf,
            req.fixed_charges, req.energy_charges, req.taxes_and_rent, req.other_charges,
            monthly_bill, unit_per_day, avg_cost,
            bill_id,
        )
        conn.commit()
        return {"message": "Bill updated"}
    finally:
        conn.close()


@router.delete("/{report_id}/sheet1/bills/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bill(report_id: int, bill_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_report_access(cursor, report_id, current_user)
        cursor.execute(
            """
            SELECT b.id FROM sheet1_bills b
            JOIN sheet1_accounts a ON b.account_id = a.id
            JOIN sheet1_energy_consumption s ON a.sheet1_id = s.id
            WHERE b.id = ? AND s.report_id = ?
            """,
            bill_id, report_id,
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Bill not found")
        cursor.execute("DELETE FROM sheet1_bills WHERE id = ?", bill_id)
        conn.commit()
    finally:
        conn.close()
