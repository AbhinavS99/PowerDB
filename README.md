# PowerDB

Power audit data logging, visualization, and report generation tool.

## Project Structure

```
PowerDB/
├── backend/           # FastAPI + Python
│   ├── app/
│   │   ├── api/       # Route handlers (auth, reports)
│   │   ├── core/      # Config, security, database
│   │   ├── models/    # SQLAlchemy models
│   │   ├── schemas/   # Pydantic schemas
│   │   └── services/  # Business logic
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/          # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── context/     # React context (auth)
│   │   ├── pages/       # Page components
│   │   ├── services/    # API client
│   │   └── types/       # TypeScript types
│   ├── Dockerfile
│   └── package.json
├── .github/workflows/ # CI/CD
└── .memory_bank/      # Project context & decisions
```

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env         # Edit with your Azure SQL credentials
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                  # Starts on http://localhost:5173
```

## Tech Stack
- **Frontend:** React + Vite + TypeScript
- **Backend:** Python + FastAPI
- **Auth:** JWT (bcrypt)
- **Database:** Azure SQL Database
- **Hosting:** Azure Container Apps
- **CI/CD:** GitHub Actions
