-- V004: Add is_diesel_generator to sheet1_accounts

IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('sheet1_accounts') AND name = 'is_diesel_generator'
)
BEGIN
    ALTER TABLE sheet1_accounts ADD is_diesel_generator BIT NOT NULL DEFAULT 0;
    PRINT 'Column [is_diesel_generator] added to [sheet1_accounts].';
END
ELSE
BEGIN
    PRINT 'Column [is_diesel_generator] already exists. Skipping.';
END
GO
