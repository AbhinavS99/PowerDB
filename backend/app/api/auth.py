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


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest):
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
