-- V001: Create users table
-- PowerDB user accounts for authentication

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
    CREATE TABLE users (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        full_name   NVARCHAR(255)   NOT NULL,
        email       NVARCHAR(255)   NOT NULL UNIQUE,
        phone       NVARCHAR(20)    NULL,
        role        NVARCHAR(20)    NOT NULL DEFAULT 'auditor'
                    CHECK (role IN ('auditor', 'admin')),
        hashed_password NVARCHAR(255) NOT NULL,
        is_active   BIT             NOT NULL DEFAULT 1,
        created_at  DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        updated_at  DATETIME2       NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_users_email ON users (email);
    CREATE INDEX IX_users_role ON users (role);

    PRINT 'Table [users] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [users] already exists. Skipping.';
END
GO
