import pyodbc
from app.core.config import settings


def get_connection() -> pyodbc.Connection:
    """Create a new connection to Azure SQL Database."""
    conn_str = (
        f"DRIVER={{{settings.DB_DRIVER}}};"
        f"SERVER={settings.DB_SERVER};"
        f"DATABASE={settings.DB_NAME};"
        f"UID={settings.DB_USER};"
        f"PWD={settings.DB_PASSWORD};"
        f"Encrypt=yes;"
        f"TrustServerCertificate=no;"
    )
    return pyodbc.connect(conn_str)
