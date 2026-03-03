from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import os

from app.api.auth import router as auth_router
from app.api.reports import router as reports_router

app = FastAPI(
    title="PowerDB API",
    description="Backend API for power audit data logging and report management",
    version="0.1.0",
)

# CORS — allow frontend origin
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(reports_router, prefix="/api/reports", tags=["Reports"])


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "powerdb-backend", "version": "0.1.0"}


@app.get("/api/hello")
async def hello():
    return {"message": "Hello from PowerDB API!"}

