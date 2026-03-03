# PowerDB — Architecture & Tech Stack

## Tech Stack

| Layer        | Technology                          | Reasoning                                                                 |
|--------------|-------------------------------------|---------------------------------------------------------------------------|
| Frontend     | React + Vite + TypeScript           | SPA behind auth, no SSR/SEO needed. Vite is fast, simple, no Node server. |
| UI Library   | TBD (Ant Design or shadcn/ui)       | Need rich table/form components for CRUD-heavy v1.                        |
| Backend      | Python + FastAPI                    | Async, fast, auto-docs. Scalability not a concern.                        |
| Auth         | FastAPI + JWT (bcrypt passwords)    | Simple, full control. Users table in Azure SQL.                           |
| Database     | Azure SQL Database                  | Azure credits available. Managed service.                                 |
| Hosting      | Azure Container Apps (2 containers) | Frontend (Nginx + static) + Backend (FastAPI/Uvicorn).                    |
| CI/CD        | GitHub Actions                      | Standard, free for public repos.                                          |

## Key Architecture Decisions

### Why React + Vite over Next.js?
- No SSR/SEO needed (everything behind auth)
- FastAPI is the API layer — Next.js API routes would be redundant
- Vite builds to static files → lightweight Nginx container (~20MB)
- Next.js requires Node.js server → heavier container, more cost on Azure
- Simpler mental model: React app calls FastAPI, no framework overlap

### Why React + Vite over Streamlit?
- V1 is CRUD-heavy (data logging), not dashboard-heavy
- Streamlit JWT handling is hacky (session_state resets on refresh)
- Edit/delete in Streamlit causes full page reruns
- React scales naturally from CRUD (v1) to dashboards (v2)

### Why JWT over Azure AD?
- Small team / individual use — no org SSO needed
- Full control over auth flow
- Simpler setup, no Azure AD app registration
- Can migrate to Azure AD later if needed

## Deployment Architecture

```
┌─────────────────────────────────────────────┐
│          Azure Container Apps               │
│                                             │
│  ┌──────────────┐    ┌──────────────────┐   │
│  │  Frontend     │    │  Backend          │   │
│  │  Nginx +      │───▶│  FastAPI +        │   │
│  │  React Static │    │  Uvicorn          │   │
│  │  Port 80      │    │  Port 8000        │   │
│  └──────────────┘    └────────┬─────────┘   │
│                               │              │
└───────────────────────────────┼──────────────┘
                                │
                        ┌───────▼──────┐
                        │  Azure SQL   │
                        │  Database    │
                        └──────────────┘
```

## Project Structure
```
PowerDB/
├── .memory_bank/          # Project context & decisions
├── backend/
│   ├── app/
│   │   ├── main.py        # FastAPI app entry
│   │   ├── core/          # Config, security, DB connection
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── api/           # Route handlers
│   │   └── services/      # Business logic
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page-level components
│   │   ├── services/      # API client & auth
│   │   ├── hooks/         # Custom React hooks
│   │   ├── types/         # TypeScript types
│   │   └── App.tsx        # Root component + routing
│   ├── package.json
│   ├── Dockerfile
│   └── vite.config.ts
├── .github/
│   └── workflows/         # CI/CD pipelines
└── README.md
```
