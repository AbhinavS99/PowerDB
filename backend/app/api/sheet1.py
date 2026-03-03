from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.database import get_connection
from app.core.security import get_current_user

router = APIRouter()


class Sheet1Init(BaseModel):
    num_accounts: int


class AccountData(BaseModel):
    account_number: int
    entry_date: str | None = None
    is_solar: bool = False
    billing_account_no: str | None = None
    sanctioned_cd_kva: float | None = None


class Sheet1Update(BaseModel):
    num_accounts: int
    accounts: list[AccountData]


# ---------- helpers ----------

def _check_report_access(cursor, report_id: int, current_user: dict):
    """Verify user can access this report."""
    cursor.execute("SELECT auditor_id FROM reports WHERE id = ?", report_id)
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    if current_user["role"] not in ("super", "admin") and row.auditor_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")


# ---------- endpoints ----------

@router.get("/{report_id}/sheet1")
def get_sheet1(report_id: int, current_user: dict = Depends(get_current_user)):
    """Get Sheet 1 data for a report, including all accounts."""
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
            return {"exists": False, "sheet": None, "accounts": []}

        cursor.execute(
            """
            SELECT id, account_number, entry_date, is_solar, billing_account_no, sanctioned_cd_kva
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
                "billing_account_no": a.billing_account_no,
                "sanctioned_cd_kva": float(a.sanctioned_cd_kva) if a.sanctioned_cd_kva is not None else None,
            }
            for a in cursor.fetchall()
        ]

        return {
            "exists": True,
            "sheet": {
                "id": sheet.id,
                "num_accounts": sheet.num_accounts,
                "created_at": str(sheet.created_at),
                "updated_at": str(sheet.updated_at),
            },
            "accounts": accounts,
        }
    finally:
        conn.close()


@router.post("/{report_id}/sheet1", status_code=status.HTTP_201_CREATED)
def init_sheet1(report_id: int, req: Sheet1Init, current_user: dict = Depends(get_current_user)):
    """Initialize Sheet 1 for a report with N empty account slots."""
    if req.num_accounts < 1:
        raise HTTPException(status_code=400, detail="Must have at least 1 account")

    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_report_access(cursor, report_id, current_user)

        # Check if sheet already exists
        cursor.execute("SELECT id FROM sheet1_energy_consumption WHERE report_id = ?", report_id)
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Sheet 1 already exists for this report")

        # Create sheet header
        cursor.execute(
            """
            INSERT INTO sheet1_energy_consumption (report_id, num_accounts)
            OUTPUT INSERTED.id
            VALUES (?, ?)
            """,
            report_id, req.num_accounts,
        )
        sheet1_id = cursor.fetchone().id

        # Create empty account rows
        for i in range(1, req.num_accounts + 1):
            cursor.execute(
                "INSERT INTO sheet1_accounts (sheet1_id, account_number) VALUES (?, ?)",
                sheet1_id, i,
            )

        conn.commit()
        return {"sheet1_id": sheet1_id, "num_accounts": req.num_accounts}
    finally:
        conn.close()


@router.put("/{report_id}/sheet1")
def update_sheet1(report_id: int, req: Sheet1Update, current_user: dict = Depends(get_current_user)):
    """Update Sheet 1: adjust account count and save account data."""
    if req.num_accounts < 1:
        raise HTTPException(status_code=400, detail="Must have at least 1 account")

    conn = get_connection()
    try:
        cursor = conn.cursor()
        _check_report_access(cursor, report_id, current_user)

        cursor.execute("SELECT id FROM sheet1_energy_consumption WHERE report_id = ?", report_id)
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Sheet 1 not found. Initialize it first.")
        sheet1_id = row.id

        # Update header
        cursor.execute(
            "UPDATE sheet1_energy_consumption SET num_accounts = ?, updated_at = GETUTCDATE() WHERE id = ?",
            req.num_accounts, sheet1_id,
        )

        # Delete all existing accounts and re-insert
        cursor.execute("DELETE FROM sheet1_accounts WHERE sheet1_id = ?", sheet1_id)

        for acc in req.accounts:
            cursor.execute(
                """
                INSERT INTO sheet1_accounts (sheet1_id, account_number, entry_date, is_solar, billing_account_no, sanctioned_cd_kva)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                sheet1_id, acc.account_number,
                acc.entry_date if acc.entry_date else None,
                1 if acc.is_solar else 0,
                acc.billing_account_no,
                acc.sanctioned_cd_kva,
            )

        conn.commit()
        return {"message": "Sheet 1 updated", "num_accounts": req.num_accounts}
    finally:
        conn.close()
