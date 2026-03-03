-- V003: Create Sheet 1 - Energy Consumption Data tables
-- Sheet 1 header + individual account entries

-- Sheet 1 header (one per report)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sheet1_energy_consumption')
BEGIN
    CREATE TABLE sheet1_energy_consumption (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        report_id       INT             NOT NULL UNIQUE
                        REFERENCES reports(id) ON DELETE CASCADE,
        num_accounts    INT             NOT NULL DEFAULT 0,
        created_at      DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        updated_at      DATETIME2       NOT NULL DEFAULT GETUTCDATE()
    );

    PRINT 'Table [sheet1_energy_consumption] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [sheet1_energy_consumption] already exists. Skipping.';
END
GO

-- Individual account entries (many per sheet)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sheet1_accounts')
BEGIN
    CREATE TABLE sheet1_accounts (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        sheet1_id               INT             NOT NULL
                                REFERENCES sheet1_energy_consumption(id) ON DELETE CASCADE,
        account_number          INT             NOT NULL,  -- 1, 2, 3... (ordering)
        entry_date              DATE            NULL,
        is_solar                BIT             NOT NULL DEFAULT 0,
        billing_account_no      NVARCHAR(100)   NULL,
        sanctioned_cd_kva       DECIMAL(10,2)   NULL,
        created_at              DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        updated_at              DATETIME2       NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_sheet1_accounts_sheet1 ON sheet1_accounts (sheet1_id);

    PRINT 'Table [sheet1_accounts] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [sheet1_accounts] already exists. Skipping.';
END
GO
