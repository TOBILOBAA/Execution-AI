"""
Execution AI — FastAPI Application Entry Point
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.core.config import get_settings
from app.core.logging import configure_logging, logger
from app.api.routes import (
    sessions,
    yearly_goals,
    plans,
    execution,
    habits,
    dashboard,
    goals_hierarchy,
    reports,
)


def _parse_cors_origins(raw_origins: str, app_env: str) -> list[str]:
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    if app_env == "development" and not origins:
        return ["*"]
    return origins


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.app_env)
    logger.info("execution_ai_starting", env=settings.app_env)
    yield
    logger.info("execution_ai_shutting_down")


settings = get_settings()

app = FastAPI(
    title="Execution AI API",
    description=(
        "Backend for Execution AI — an AI-assisted execution and accountability platform. "
        "Supports structured planning, execution tracking, and report generation."
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url="/redoc" if settings.app_env != "production" else None,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────

cors_origins = _parse_cors_origins(settings.cors_origins, settings.app_env)
if settings.app_env == "production" and not cors_origins:
    logger.warning("cors_origins_not_configured", env=settings.app_env)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Global exception handlers ────────────────────────────────────────────────

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(
        "unhandled_exception",
        path=str(request.url),
        method=request.method,
        error=str(exc),
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal error occurred. Please try again."},
    )


@app.exception_handler(ValidationError)
async def pydantic_validation_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )


# ─── Health check ─────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "status": "ok",
        "service": "execution-ai",
        "health": "/health",
    }


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "execution-ai"}


# ─── Routes ───────────────────────────────────────────────────────────────────

app.include_router(sessions.router)
app.include_router(yearly_goals.router)
app.include_router(plans.router)
app.include_router(execution.router)
app.include_router(habits.router)
app.include_router(dashboard.router)
app.include_router(goals_hierarchy.router)
app.include_router(reports.router)
