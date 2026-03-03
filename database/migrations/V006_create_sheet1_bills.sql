-- V006: Create sheet1_bills table
-- Moves billing/consumption/cost data from sheet1_accounts into a separate bills table
-- Each connection can have multiple bills (monthly billing records)

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sheet1_bills')
BEGIN
    CREATE TABLE sheet1_bills (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        account_id              INT             NOT NULL
                                REFERENCES sheet1_accounts(id) ON DELETE CASCADE,
        billing_period_from     DATE            NULL,
        billing_period_to       DATE            NULL,
        billing_days            INT             NULL,
        bill_no                 NVARCHAR(100)   NULL,
        mdi_kva                 DECIMAL(10,2)   NULL,
        units_kwh               DECIMAL(14,2)   NULL,
        units_kvah              DECIMAL(14,2)   NULL,
        pf                      DECIMAL(5,4)    NULL,
        fixed_charges           DECIMAL(14,2)   NULL,
        energy_charges          DECIMAL(14,2)   NULL,
        taxes_and_rent          DECIMAL(14,2)   NULL,
        other_charges           DECIMAL(14,2)   NULL,
        monthly_bill            DECIMAL(14,2)   NULL,
        unit_consumption_per_day DECIMAL(14,4)  NULL,
        avg_per_unit_cost       DECIMAL(14,4)   NULL,
        created_at              DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        updated_at              DATETIME2       NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_sheet1_bills_account ON sheet1_bills (account_id);

    PRINT 'Table [sheet1_bills] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [sheet1_bills] already exists. Skipping.';
END
GO
