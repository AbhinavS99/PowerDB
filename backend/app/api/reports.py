from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.database import get_connection
from app.core.security import get_current_user

router = APIRouter()


class ReportCreate(BaseModel):
    client_representative: str
    facility_name: str


class ReportUpdate(BaseModel):
    status: str | None = None
    client_representative: str | None = None
    facility_name: str | None = None


def _generate_report_uid(cursor) -> str:
    """Generate a unique report ID like RPT-20260303-001."""
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"RPT-{today}-"
    cursor.execute(
        "SELECT COUNT(*) FROM reports WHERE report_uid LIKE ?",
        f"{prefix}%",
    )
    count = cursor.fetchone()[0]
    return f"{prefix}{count + 1:03d}"


@router.get("/")
def list_reports(current_user: dict = Depends(get_current_user)):
    """List all reports. Super/admin see all; auditors see only their own."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        if current_user["role"] in ("super", "admin"):
            cursor.execute(
                """
                SELECT r.id, r.report_uid, r.status, r.client_representative, r.facility_name,
                       r.created_at, r.updated_at, u.full_name AS auditor_name, r.auditor_id
                FROM reports r
                JOIN users u ON r.auditor_id = u.id
                ORDER BY r.created_at DESC
                """
            )
        else:
            cursor.execute(
                """
                SELECT r.id, r.report_uid, r.status, r.client_representative, r.facility_name,
                       r.created_at, r.updated_at, u.full_name AS auditor_name, r.auditor_id
                FROM reports r
                JOIN users u ON r.auditor_id = u.id
                WHERE r.auditor_id = ?
                ORDER BY r.created_at DESC
                """,
                current_user["user_id"],
            )
        rows = cursor.fetchall()
        return [
            {
                "id": r.id,
                "report_uid": r.report_uid,
                "status": r.status,
                "client_representative": r.client_representative,
                "facility_name": r.facility_name,
                "auditor_name": r.auditor_name,
                "auditor_id": r.auditor_id,
                "created_at": str(r.created_at),
                "updated_at": str(r.updated_at),
            }
            for r in rows
        ]
    finally:
        conn.close()


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_report(req: ReportCreate, current_user: dict = Depends(get_current_user)):
    """Create a new report. Auditor is the logged-in user."""
    if not req.client_representative.strip():
        raise HTTPException(status_code=400, detail="Client representative is required")
    if not req.facility_name.strip():
        raise HTTPException(status_code=400, detail="Facility name is required")

    conn = get_connection()
    try:
        cursor = conn.cursor()
        report_uid = _generate_report_uid(cursor)

        cursor.execute(
            """
            INSERT INTO reports (report_uid, auditor_id, client_representative, facility_name)
            OUTPUT INSERTED.id, INSERTED.report_uid, INSERTED.status, INSERTED.client_representative,
                   INSERTED.facility_name, INSERTED.created_at, INSERTED.updated_at, INSERTED.auditor_id
            VALUES (?, ?, ?, ?)
            """,
            report_uid, current_user["user_id"], req.client_representative.strip(), req.facility_name.strip(),
        )
        row = cursor.fetchone()
        conn.commit()

        # Fetch auditor name
        cursor.execute("SELECT full_name FROM users WHERE id = ?", current_user["user_id"])
        auditor = cursor.fetchone()

        return {
            "id": row.id,
            "report_uid": row.report_uid,
            "status": row.status,
            "client_representative": row.client_representative,
            "facility_name": row.facility_name,
            "auditor_name": auditor.full_name if auditor else "",
            "auditor_id": row.auditor_id,
            "created_at": str(row.created_at),
            "updated_at": str(row.updated_at),
        }
    finally:
        conn.close()


@router.get("/{report_id}")
def get_report(report_id: int, current_user: dict = Depends(get_current_user)):
    """Get a single report."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT r.id, r.report_uid, r.status, r.client_representative, r.facility_name,
                   r.created_at, r.updated_at, u.full_name AS auditor_name, r.auditor_id
            FROM reports r
            JOIN users u ON r.auditor_id = u.id
            WHERE r.id = ?
            """,
            report_id,
        )
        r = cursor.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Report not found")

        # Auditors can only see their own reports
        if current_user["role"] not in ("super", "admin") and r.auditor_id != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")

        return {
            "id": r.id,
            "report_uid": r.report_uid,
            "status": r.status,
            "client_representative": r.client_representative,
            "facility_name": r.facility_name,
            "auditor_name": r.auditor_name,
            "auditor_id": r.auditor_id,
            "created_at": str(r.created_at),
            "updated_at": str(r.updated_at),
        }
    finally:
        conn.close()


@router.put("/{report_id}")
def update_report(report_id: int, req: ReportUpdate, current_user: dict = Depends(get_current_user)):
    """Update a report's status, client rep, or facility name."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT auditor_id, status FROM reports WHERE id = ?", report_id)
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")

        if current_user["role"] not in ("super", "admin") and row.auditor_id != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")

        updates = []
        params = []
        if req.status is not None:
            if req.status not in ("not_started", "in_progress", "completed"):
                raise HTTPException(status_code=400, detail="Invalid status")
            updates.append("status = ?")
            params.append(req.status)
        if req.client_representative is not None:
            updates.append("client_representative = ?")
            params.append(req.client_representative.strip())
        if req.facility_name is not None:
            updates.append("facility_name = ?")
            params.append(req.facility_name.strip())

        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        updates.append("updated_at = GETUTCDATE()")
        params.append(report_id)

        cursor.execute(f"UPDATE reports SET {', '.join(updates)} WHERE id = ?", *params)
        conn.commit()
        return {"message": "Report updated"}
    finally:
        conn.close()


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(report_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a report. Super/admin only."""
    if current_user["role"] not in ("super", "admin"):
        raise HTTPException(status_code=403, detail="Only admin or super users can delete reports")

    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM reports WHERE id = ?", report_id)
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Report not found")
        cursor.execute("DELETE FROM reports WHERE id = ?", report_id)
        conn.commit()
    finally:
        conn.close()
