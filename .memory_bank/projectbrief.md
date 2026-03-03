# PowerDB — Project Brief

## What Is PowerDB?
A **data logging, visualization, and report generation tool** for power auditing.

## Problem
Power auditors need a centralized system to log audit data, generate structured reports, and eventually visualize trends across audits.

## Users
- Small team / individual use (not public-facing)
- Users authenticate with email/password (JWT)

## V1 Scope
1. **User authentication & login** (JWT-based)
2. **Data logging** — CRUD for power audit reports
   - Multi-step wizard for creating new reports
   - Table view of existing reports on dashboard

## Future Scope (v2+)
- Dashboards & visualization (charts, trends)
- Report generation (PDF export)
- File upload (CSV/Excel import)
- Role-based access control

## V1 Frontend Flow
```
Login Page
    ↓ (JWT auth)
Dashboard
    ├── [Generate New Report] button (top)
    └── Table of existing reports (name, date, status)
            ↓ (click "Generate New Report")
New Report Wizard (multi-step)
    Step 1 → Step 2 → Step 3 → Submit
```

## Report Data Model
- TBD — to be defined in detail before implementation
- Will contain power audit fields (site info, readings, equipment, etc.)
