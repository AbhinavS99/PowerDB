from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.database import get_connection
from app.core.security import get_current_user

router = APIRouter()


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


# ---------- helpers ----------

def _check_report_access(cursor, report_id: int, current_user: dict):
    """Verify user can access this report."""
    cursor.execute("SELECT auditor_id FROM reports WHERE id = ?", report_id)
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    if current_user["role"] not in ("super", "admin") and row.auditor_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")


def _ensure_sheet1(cursor, report_id: int) -> int:
    """Get or create the Sheet 1 header row. Returns sheet1_id."""
    cursor.execute("SELECT id FROM sheet1_energy_consumption WHERE report_id = ?", report_id)
    row = cursor.fetchone()
    if row:
        return row.id
    cursor.execute(
        """
        INSERT INTO sheet1_energy_consumption (report_id, num_accounts)
        OUTPUT INSERTED.id
        VALUES (?, 0)
        """,
        report_id,
    )
    return cursor.fetchone().id


def _sync_account_count(cursor, sheet1_id: int):
    """Update num_accounts to match actual row count."""
    cursor.execute("SELECT COUNT(*) FROM sheet1_accounts WHERE sheet1_id = ?", sheet1_id)
    count = cursor.fetchone()[0]
    cursor.execute(
        "UPDATE sheet1_energy_consumption SET num_accounts = ?, updated_at = GETUTCDATE() WHERE id = ?",
        count, sheet1_id,
    )


# ---------- endpoints ----------

@router.get("/{report_id}/sheet1")
def get_sheet1(report_id: int, current_user: dict = Depends(get_current_user)):
    """Get Sheet 1 data for a report, including all connections."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_report_access(cursor, report_id, current_user)

        cursor.execute(
            "SELECT id, num_accounts, created_at, updated_at FROM sheet1_energy_consumption WHERE report_id = ?",
            report_id,
        )
        sheet = cursor.fetchone()

        if not sheet:
            return {"accounts": []}

        cursor.execute(
            """
            SELECT id, account_number, entry_date, is_solar, is_diesel_generator,
                   billing_account_no, sanctioned_cd_kva
            FROM sheet1_accounts
            WHERE sheet1_id = ?
            ORDER BY account_number
            """,
            sheet.id,
        )
        accounts = [
            {
                "id": a.id,
                "account_number": a.account_number,
                "entry_date": str(a.entry_date) if a.entry_date else None,
                "is_solar": bool(a.is_solar),
                "is_diesel_generator": bool(a.is_diesel_generator),
                "billing_account_no": a.billing_account_no,
                "sanctioned_cd_kva": float(a.sanctioned_cd_kva) if a.sanctioned_cd_kva is not None else None,
            }
            for a in cursor.fetchall()
        ]

        return {"accounts": accounts}
    finally:
        conn.close()


@router.post("/{report_id}/sheet1/connections", status_code=status.HTTP_201_CREATED)
def add_connection(report_id: int, req: AccountCreate, current_user: dict = Depends(get_current_user)):
    """Add a new connection to Sheet 1. Auto-creates sheet header if needed."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_report_access(cursor, report_id, current_user)

        sheet1_id = _ensure_sheet1(cursor, report_id)

        # Get next account number
        cursor.execute("SELECT ISNULL(MAX(account_number), 0) FROM sheet1_accounts WHERE sheet1_id = ?", sheet1_id)
        next_num = cursor.fetchone()[0] + 1

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        cursor.execute(
            """
            INSERT INTO sheet1_accounts
                (sheet1_id, account_number, entry_date, billing_account_no, sanctioned_cd_kva, is_diesel_generator, is_solar)
            OUTPUT INSERTED.id, INSERTED.account_number, INSERTED.entry_date
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            sheet1_id, next_num, today,
            req.billing_account_no, req.sanctioned_cd_kva,
            1 if req.is_diesel_generator else 0,
            1 if req.is_solar else 0,
        )
        row = cursor.fetchone()
        _sync_account_count(cursor, sheet1_id)
        conn.commit()

        return {
            "id": row.id,
            "account_number": row.account_number,
            "entry_date": str(row.entry_date) if row.entry_date else today,
            "billing_account_no": req.billing_account_no,
            "sanctioned_cd_kva": req.sanctioned_cd_kva,
            "is_diesel_generator": req.is_diesel_generator,
            "is_solar": req.is_solar,
        }
    finally:
        conn.close()


@router.put("/{report_id}/sheet1/connections/{connection_id}")
def update_connection(
    report_id: int, connection_id: int, req: AccountUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update an existing connection's data."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_report_access(cursor, report_id, current_user)

        # Verify connection belongs to this report
        cursor.execute(
            """
            SELECT a.id FROM sheet1_accounts a
            JOIN sheet1_energy_consumption s ON a.sheet1_id = s.id
            WHERE a.id = ? AND s.report_id = ?
            """,
            connection_id, report_id,
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Connection not found")

        cursor.execute(
            """
            UPDATE sheet1_accounts
            SET billing_account_no = ?, sanctioned_cd_kva = ?,
                is_diesel_generator = ?, is_solar = ?, updated_at = GETUTCDATE()
            WHERE id = ?
            """,
            req.billing_account_no, req.sanctioned_cd_kva,
            1 if req.is_diesel_generator else 0,
            1 if req.is_solar else 0,
            connection_id,
        )
        conn.commit()
        return {"message": "Connection updated"}
    finally:
        conn.close()


@router.delete("/{report_id}/sheet1/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_connection(
    report_id: int, connection_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Delete a connection from Sheet 1."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_report_access(cursor, report_id, current_user)

        # Verify and get sheet1_id
        cursor.execute(
            """
            SELECT a.id, a.sheet1_id FROM sheet1_accounts a
            JOIN sheet1_energy_consumption s ON a.sheet1_id = s.id
            WHERE a.id = ? AND s.report_id = ?
            """,
            connection_id, report_id,
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Connection not found")

        sheet1_id = row.sheet1_id
        cursor.execute("DELETE FROM sheet1_accounts WHERE id = ?", connection_id)

        # Re-number remaining accounts
        cursor.execute(
            "SELECT id FROM sheet1_accounts WHERE sheet1_id = ? ORDER BY account_number",
            sheet1_id,
        )
        for idx, acc in enumerate(cursor.fetchall(), 1):
            cursor.execute("UPDATE sheet1_accounts SET account_number = ? WHERE id = ?", idx, acc.id)

        _sync_account_count(cursor, sheet1_id)
        conn.commit()
    finally:
        conn.close()
