# PowerDB — Decision Log

## Decisions Made

| # | Date       | Decision                              | Options Considered                     | Chosen         | Rationale                                                        |
|---|------------|---------------------------------------|----------------------------------------|----------------|------------------------------------------------------------------|
| 1 | 2026-03-03 | Backend framework                     | FastAPI, Django, Flask                 | FastAPI        | User preference. Async, auto-docs, lightweight.                  |
| 2 | 2026-03-03 | Frontend framework                    | Streamlit, React+Vite, Next.js, Reflex | React + Vite   | CRUD-heavy v1, no SSR needed, scales to dashboards.              |
| 3 | 2026-03-03 | Auth approach                         | Azure AD, JWT, Easy Auth               | FastAPI + JWT  | Small team, simple, full control. No org SSO needed.             |
| 4 | 2026-03-03 | Database                              | Azure SQL, PostgreSQL, SQLite          | Azure SQL      | User has Azure credits, managed service.                         |
| 5 | 2026-03-03 | Hosting                               | Azure Container Apps, App Service, VM  | Container Apps | Containerized, scalable, supports multiple containers.           |
| 6 | 2026-03-03 | CI/CD                                 | GitHub Actions, Azure DevOps           | GitHub Actions | Standard, user preference.                                       |
| 7 | 2026-03-03 | Report creation flow                  | Single form, multi-step wizard         | Multi-step     | User preference. Better UX for complex data entry.               |
| 8 | 2026-03-03 | Dashboard layout                      | Table view, card view                  | Table view     | Simpler, shows report list with name/date/status.                |

## Pending Decisions

| # | Decision                  | Options                    | Blocking?           |
|---|---------------------------|----------------------------|---------------------|
| A | UI component library      | Ant Design, shadcn/ui     | No — scaffold first |
| B | Report data model fields  | User to define             | Yes — blocks schema |
