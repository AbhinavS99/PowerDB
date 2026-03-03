"""Connections API — CRUD for electrical connections within a report."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.database import get_connection
from app.core.security import get_current_user

router = APIRouter()


class ConnectionCreate(BaseModel):
    billing_account_no: str | None = None
    sanctioned_cd_kva: float | None = None
    is_diesel_generator: bool = False
    is_solar: bool = False


class ConnectionUpdate(BaseModel):
    billing_account_no: str | None = None
    sanctioned_cd_kva: float | None = None
    is_diesel_generator: bool = False
    is_solar: bool = False


def _check_report_access(cursor, report_id: int, user: dict):
    cursor.execute("SELECT auditor_id FROM reports WHERE id = ?", report_id)
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    if user["role"] not in ("super", "admin") and row.auditor_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")


def _float(v):
    return float(v) if v is not None else None


@router.get("/{report_id}/connections")
def list_connections(report_id: int, current_user: dict = Depends(get_current_user)):
    """List all connections for a report (summary)."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_report_access(cursor, report_id, current_user)

        cursor.execute(
            """
            SELECT c.id, c.account_number, c.entry_date, c.billing_account_no,
                   c.sanctioned_cd_kva, c.is_diesel_generator, c.is_solar,
                   (SELECT COUNT(*) FROM sheet1_bills b WHERE b.connection_id = c.id) AS bill_count,
                   (SELECT ISNULL(SUM(b.monthly_bill), 0) FROM sheet1_bills b WHERE b.connection_id = c.id) AS total_bill
            FROM connections c
            WHERE c.report_id = ?
            ORDER BY c.account_number
            """,
            report_id,
        )
        return [
            {
                "id": r.id,
                "account_number": r.account_number,
                "entry_date": str(r.entry_date) if r.entry_date else None,
                "billing_account_no": r.billing_account_no,
                "sanctioned_cd_kva": _float(r.sanctioned_cd_kva),
                "is_diesel_generator": bool(r.is_diesel_generator),
                "is_solar": bool(r.is_solar),
                "bill_count": r.bill_count,
                "total_bill": _float(r.total_bill),
            }
            for r in cursor.fetchall()
        ]
    finally:
        conn.close()


@router.get("/{report_id}/connections/{conn_id}")
def get_connection_detail(report_id: int, conn_id: int, current_user: dict = Depends(get_current_user)):
    """Get a single connection with full details."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_report_access(cursor, report_id, current_user)

        cursor.execute(
            "SELECT * FROM connections WHERE id = ? AND report_id = ?", conn_id, report_id
        )
        c = cursor.fetchone()
        if not c:
            raise HTTPException(status_code=404, detail="Connection not found")

        return {
            "id": c.id,
            "report_id": c.report_id,
            "account_number": c.account_number,
            "entry_date": str(c.entry_date) if c.entry_date else None,
            "billing_account_no": c.billing_account_no,
            "sanctioned_cd_kva": _float(c.sanctioned_cd_kva),
            "is_diesel_generator": bool(c.is_diesel_generator),
            "is_solar": bool(c.is_solar),
        }
    finally:
        conn.close()


@router.post("/{report_id}/connections", status_code=status.HTTP_201_CREATED)
def add_connection_endpoint(report_id: int, req: ConnectionCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_report_access(cursor, report_id, current_user)

        cursor.execute("SELECT ISNULL(MAX(account_number), 0) FROM connections WHERE report_id = ?", report_id)
        next_num = cursor.fetchone()[0] + 1
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        cursor.execute(
            """
            INSERT INTO connections (report_id, account_number, entry_date, billing_account_no, sanctioned_cd_kva, is_diesel_generator, is_solar)
            OUTPUT INSERTED.id, INSERTED.account_number
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            report_id, next_num, today,
            req.billing_account_no, req.sanctioned_cd_kva,
            1 if req.is_diesel_generator else 0, 1 if req.is_solar else 0,
        )
        row = cursor.fetchone()

        # Auto-mark report as in_progress
        cursor.execute(
            "UPDATE reports SET status = 'in_progress', updated_at = GETUTCDATE() WHERE id = ? AND status = 'not_started'",
            report_id,
        )
        conn.commit()
        return {"id": row.id, "account_number": row.account_number}
    finally:
        conn.close()


@router.put("/{report_id}/connections/{conn_id}")
def update_connection_endpoint(report_id: int, conn_id: int, req: ConnectionUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_report_access(cursor, report_id, current_user)
        cursor.execute("SELECT id FROM connections WHERE id = ? AND report_id = ?", conn_id, report_id)
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Connection not found")

        cursor.execute(
            """
            UPDATE connections
            SET billing_account_no = ?, sanctioned_cd_kva = ?, is_diesel_generator = ?, is_solar = ?, updated_at = GETUTCDATE()
            WHERE id = ?
            """,
            req.billing_account_no, req.sanctioned_cd_kva,
            1 if req.is_diesel_generator else 0, 1 if req.is_solar else 0,
            conn_id,
        )
        conn.commit()
        return {"message": "Connection updated"}
    finally:
        conn.close()


@router.delete("/{report_id}/connections/{conn_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_connection_endpoint(report_id: int, conn_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_report_access(cursor, report_id, current_user)
        cursor.execute("SELECT id FROM connections WHERE id = ? AND report_id = ?", conn_id, report_id)
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Connection not found")

        cursor.execute("DELETE FROM connections WHERE id = ?", conn_id)

        # Re-number remaining
        cursor.execute("SELECT id FROM connections WHERE report_id = ? ORDER BY account_number", report_id)
        for idx, r in enumerate(cursor.fetchall(), 1):
            cursor.execute("UPDATE connections SET account_number = ? WHERE id = ?", idx, r.id)

        conn.commit()
    finally:
        conn.close()
