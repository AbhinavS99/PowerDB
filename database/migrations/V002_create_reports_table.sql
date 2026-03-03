-- V002: Create reports table
-- Master report for power audits, sub-reports will FK to this

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'reports')
BEGIN
    CREATE TABLE reports (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        report_uid          NVARCHAR(20)    NOT NULL UNIQUE,   -- e.g. RPT-20260303-001
        status              NVARCHAR(20)    NOT NULL DEFAULT 'not_started'
                            CHECK (status IN ('not_started', 'in_progress', 'completed')),
        auditor_id          INT             NOT NULL
                            REFERENCES users(id),
        client_representative NVARCHAR(255) NOT NULL,
        facility_name       NVARCHAR(255)   NOT NULL,
        created_at          DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        updated_at          DATETIME2       NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_reports_auditor ON reports (auditor_id);
    CREATE INDEX IX_reports_status ON reports (status);
    CREATE INDEX IX_reports_uid ON reports (report_uid);

    PRINT 'Table [reports] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [reports] already exists. Skipping.';
END
GO
