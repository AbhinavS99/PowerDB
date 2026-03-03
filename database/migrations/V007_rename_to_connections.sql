-- V007: Flatten schema — rename sheet1_accounts → connections with direct report_id FK
-- Remove the intermediate sheet1_energy_consumption table

-- Step 1: Create the new connections table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'connections')
BEGIN
    CREATE TABLE connections (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        report_id               INT             NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        account_number          INT             NOT NULL,
        entry_date              DATE            NULL,
        billing_account_no      NVARCHAR(100)   NULL,
        sanctioned_cd_kva       DECIMAL(10,2)   NULL,
        is_solar                BIT             NOT NULL DEFAULT 0,
        is_diesel_generator     BIT             NOT NULL DEFAULT 0,
        created_at              DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        updated_at              DATETIME2       NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_connections_report ON connections (report_id);

    PRINT 'Table [connections] created.';
END
GO

-- Step 2: Migrate existing data from sheet1_accounts → connections
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'sheet1_accounts')
    AND EXISTS (SELECT * FROM sys.tables WHERE name = 'connections')
BEGIN
    SET IDENTITY_INSERT connections ON;

    INSERT INTO connections (id, report_id, account_number, entry_date, billing_account_no,
                             sanctioned_cd_kva, is_solar, is_diesel_generator, created_at, updated_at)
    SELECT a.id, s.report_id, a.account_number, a.entry_date, a.billing_account_no,
           a.sanctioned_cd_kva, a.is_solar, a.is_diesel_generator, a.created_at, a.updated_at
    FROM sheet1_accounts a
    JOIN sheet1_energy_consumption s ON a.sheet1_id = s.id;

    SET IDENTITY_INSERT connections OFF;

    PRINT 'Migrated data from sheet1_accounts to connections.';
END
GO

-- Step 3: Update sheet1_bills FK from account_id → connection_id
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sheet1_bills') AND name = 'account_id')
BEGIN
    -- Drop old FK constraint
    DECLARE @fk_name NVARCHAR(256);
    SELECT @fk_name = fk.name
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
    JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
    WHERE fk.parent_object_id = OBJECT_ID('sheet1_bills') AND c.name = 'account_id';

    IF @fk_name IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE sheet1_bills DROP CONSTRAINT ' + @fk_name);
        PRINT 'Dropped old FK on sheet1_bills.account_id.';
    END

    -- Rename column
    EXEC sp_rename 'sheet1_bills.account_id', 'connection_id', 'COLUMN';

    -- Add new FK
    ALTER TABLE sheet1_bills ADD CONSTRAINT FK_sheet1_bills_connection
        FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE;

    -- Update index
    IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_sheet1_bills_account' AND object_id = OBJECT_ID('sheet1_bills'))
    BEGIN
        DROP INDEX IX_sheet1_bills_account ON sheet1_bills;
    END
    CREATE INDEX IX_sheet1_bills_connection ON sheet1_bills (connection_id);

    PRINT 'Updated sheet1_bills FK to reference connections.';
END
GO

-- Step 4: Drop old tables
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'sheet1_accounts')
BEGIN
    -- Drop FK constraints on sheet1_accounts first
    DECLARE @fk2 NVARCHAR(256);
    DECLARE fk_cursor CURSOR FOR
        SELECT fk.name FROM sys.foreign_keys fk
        WHERE fk.parent_object_id = OBJECT_ID('sheet1_accounts')
           OR fk.referenced_object_id = OBJECT_ID('sheet1_accounts');
    OPEN fk_cursor;
    FETCH NEXT FROM fk_cursor INTO @fk2;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        DECLARE @parent_table NVARCHAR(256);
        SELECT @parent_table = OBJECT_NAME(parent_object_id) FROM sys.foreign_keys WHERE name = @fk2;
        EXEC('ALTER TABLE [' + @parent_table + '] DROP CONSTRAINT [' + @fk2 + ']');
        FETCH NEXT FROM fk_cursor INTO @fk2;
    END
    CLOSE fk_cursor; DEALLOCATE fk_cursor;

    DROP TABLE sheet1_accounts;
    PRINT 'Dropped table [sheet1_accounts].';
END
GO

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'sheet1_energy_consumption')
BEGIN
    DROP TABLE sheet1_energy_consumption;
    PRINT 'Dropped table [sheet1_energy_consumption].';
END
GO
