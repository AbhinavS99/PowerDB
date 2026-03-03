-- V005: Add billing, consumption and cost fields to sheet1_accounts

-- Billing period
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sheet1_accounts') AND name = 'billing_period_from')
BEGIN
    ALTER TABLE sheet1_accounts ADD billing_period_from DATE NULL;
    ALTER TABLE sheet1_accounts ADD billing_period_to DATE NULL;
    PRINT 'Added billing period columns.';
END
GO

-- Billing days (calculated, stored for queries)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sheet1_accounts') AND name = 'billing_days')
BEGIN
    ALTER TABLE sheet1_accounts ADD billing_days INT NULL;
    PRINT 'Added billing_days column.';
END
GO

-- Bill number
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sheet1_accounts') AND name = 'bill_no')
BEGIN
    ALTER TABLE sheet1_accounts ADD bill_no NVARCHAR(100) NULL;
    PRINT 'Added bill_no column.';
END
GO

-- MDI in kVA
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sheet1_accounts') AND name = 'mdi_kva')
BEGIN
    ALTER TABLE sheet1_accounts ADD mdi_kva DECIMAL(10,2) NULL;
    PRINT 'Added mdi_kva column.';
END
GO

-- Units consumption kWH
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sheet1_accounts') AND name = 'units_kwh')
BEGIN
    ALTER TABLE sheet1_accounts ADD units_kwh DECIMAL(14,2) NULL;
    PRINT 'Added units_kwh column.';
END
GO

-- Units consumption kVAH
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sheet1_accounts') AND name = 'units_kvah')
BEGIN
    ALTER TABLE sheet1_accounts ADD units_kvah DECIMAL(14,2) NULL;
    PRINT 'Added units_kvah column.';
END
GO

-- PF (calculated kWH/kVAH, stored)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sheet1_accounts') AND name = 'pf')
BEGIN
    ALTER TABLE sheet1_accounts ADD pf DECIMAL(5,4) NULL;
    PRINT 'Added pf column.';
END
GO

-- Cost fields
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sheet1_accounts') AND name = 'fixed_charges')
BEGIN
    ALTER TABLE sheet1_accounts ADD fixed_charges DECIMAL(14,2) NULL;
    ALTER TABLE sheet1_accounts ADD energy_charges DECIMAL(14,2) NULL;
    ALTER TABLE sheet1_accounts ADD taxes_and_rent DECIMAL(14,2) NULL;
    ALTER TABLE sheet1_accounts ADD other_charges DECIMAL(14,2) NULL;
    PRINT 'Added cost columns.';
END
GO

-- Calculated totals (stored for queries)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('sheet1_accounts') AND name = 'monthly_bill')
BEGIN
    ALTER TABLE sheet1_accounts ADD monthly_bill DECIMAL(14,2) NULL;
    ALTER TABLE sheet1_accounts ADD unit_consumption_per_day DECIMAL(14,4) NULL;
    ALTER TABLE sheet1_accounts ADD avg_per_unit_cost DECIMAL(14,4) NULL;
    PRINT 'Added calculated total columns.';
END
GO
