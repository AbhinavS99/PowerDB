# PowerDB Database Management

SQL migration scripts for Azure SQL Database.

## Structure

```
database/
├── migrations/
│   └── V001_create_users_table.sql
└── README.md
```

## Running Migrations

### Via Azure Portal
1. Go to Azure SQL Database → Query Editor
2. Run each migration script in order

### Via sqlcmd
```bash
sqlcmd -S powerdb-sqlserver.database.windows.net -d powerdb -U powerdbadmin -P <password> -i migrations/V001_create_users_table.sql
```

## Conventions
- Migration files are prefixed with `V###_` for ordering
- Each migration is idempotent (uses IF NOT EXISTS checks)
- Never modify an existing migration — create a new one instead
