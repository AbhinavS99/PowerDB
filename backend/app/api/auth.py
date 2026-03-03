from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.core.database import get_connection
from app.core.security import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter()


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone: str | None = None
    role: str = "auditor"
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PasswordUpdateRequest(BaseModel):
    new_password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


def require_super(user: dict = Depends(get_current_user)) -> dict:
    """Dependency that ensures the current user has 'super' role."""
    if user.get("role") != "super":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super users can perform this action",
        )
    return user


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, _: dict = Depends(require_super)):
    conn = get_connection()
    try:
        cursor = conn.cursor()

        # Check if email already exists
        cursor.execute("SELECT id FROM users WHERE email = ?", req.email)
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

        # Validate role
        if req.role not in ("auditor", "admin", "super"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role must be 'auditor', 'admin', or 'super'",
            )

        hashed = hash_password(req.password)

        cursor.execute(
            """
            INSERT INTO users (full_name, email, phone, role, hashed_password)
            OUTPUT INSERTED.id, INSERTED.full_name, INSERTED.email, INSERTED.phone, INSERTED.role, INSERTED.created_at
            VALUES (?, ?, ?, ?, ?)
            """,
            req.full_name, req.email, req.phone, req.role, hashed,
        )
        row = cursor.fetchone()
        conn.commit()

        return {
            "id": row.id,
            "full_name": row.full_name,
            "email": row.email,
            "phone": row.phone,
            "role": row.role,
            "created_at": str(row.created_at),
        }
    finally:
        conn.close()


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, current_user: dict = Depends(require_super)):
    """Delete a user. Only super users can do this."""
    if current_user["user_id"] == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself",
        )
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE id = ?", user_id)
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")
        cursor.execute("DELETE FROM users WHERE id = ?", user_id)
        conn.commit()
    finally:
        conn.close()


@router.get("/users")
def list_users(_: dict = Depends(require_super)):
    """List all users. Only super users can see this."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, full_name, email, phone, role, is_active, created_at FROM users ORDER BY created_at DESC")
        rows = cursor.fetchall()
        return [
            {
                "id": r.id,
                "full_name": r.full_name,
                "email": r.email,
                "phone": r.phone,
                "role": r.role,
                "is_active": r.is_active,
                "created_at": str(r.created_at),
            }
            for r in rows
        ]
    finally:
        conn.close()


@router.put("/users/{user_id}/password", status_code=status.HTTP_200_OK)
def update_password(user_id: int, req: PasswordUpdateRequest, current_user: dict = Depends(require_super)):
    """Update a user's password. Only super users can do this."""
    if len(req.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters",
        )
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE id = ?", user_id)
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")

        hashed = hash_password(req.new_password)
        cursor.execute("UPDATE users SET hashed_password = ?, updated_at = GETUTCDATE() WHERE id = ?", hashed, user_id)
        conn.commit()
        return {"message": "Password updated successfully"}
    finally:
        conn.close()


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, full_name, email, phone, role, hashed_password, is_active FROM users WHERE email = ?",
            req.email,
        )
        row = cursor.fetchone()

        if not row or not verify_password(req.password, row.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )

        if not row.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled",
            )

        token = create_access_token(
            data={"sub": str(row.id), "email": row.email, "role": row.role}
        )

        return TokenResponse(
            access_token=token,
            user={
                "id": row.id,
                "full_name": row.full_name,
                "email": row.email,
                "phone": row.phone,
                "role": row.role,
            },
        )
    finally:
        conn.close()


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    """Get current user info from JWT token."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, full_name, email, phone, role FROM users WHERE id = ?",
            user["user_id"],
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return {
            "id": row.id,
            "full_name": row.full_name,
            "email": row.email,
            "phone": row.phone,
            "role": row.role,
        }
    finally:
        conn.close()
