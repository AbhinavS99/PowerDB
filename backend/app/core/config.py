import os


class Settings:
    # Database — Azure SQL via ODBC
    DB_SERVER: str = os.getenv("DB_SERVER", "powerdb-sqlserver.database.windows.net")
    DB_NAME: str = os.getenv("DB_NAME", "powerdb")
    DB_USER: str = os.getenv("DB_USER", "powerdbadmin")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")
    DB_DRIVER: str = os.getenv("DB_DRIVER", "ODBC Driver 18 for SQL Server")

    # JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-to-a-random-secret-key")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    # CORS
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")


settings = Settings()
