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
    auth,
    activity,
    sessions,
    yearly_goals,
    plans,
    execution,
    habits,
    dashboard,
    goals_hierarchy,
    reports,
)


DEFAULT_PRODUCTION_CORS_ORIGIN_REGEX = r"^https://[a-z0-9-]+\.vercel\.app$"
LOCAL_DEVELOPMENT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]


def _parse_cors_origins(raw_origins: str, app_env: str) -> list[str]:
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    if app_env == "development":
        if not origins:
            return LOCAL_DEVELOPMENT_CORS_ORIGINS.copy()
        seen = set(origins)
        for origin in LOCAL_DEVELOPMENT_CORS_ORIGINS:
            if origin not in seen:
                origins.append(origin)
                seen.add(origin)
    return origins


def _parse_cors_origin_regex(raw_regex: str, app_env: str) -> str | None:
    regex = raw_regex.strip()
    if regex:
        return regex
    return DEFAULT_PRODUCTION_CORS_ORIGIN_REGEX


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
cors_origin_regex = _parse_cors_origin_regex(settings.cors_origin_regex, settings.app_env)
if settings.app_env == "production" and not cors_origins and not cors_origin_regex:
    logger.warning("cors_origins_not_configured", env=settings.app_env)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex,
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
app.include_router(auth.router)
app.include_router(yearly_goals.router)
app.include_router(plans.router)
app.include_router(execution.router)
app.include_router(habits.router)
app.include_router(dashboard.router)
app.include_router(goals_hierarchy.router)
app.include_router(reports.router)
app.include_router(activity.router)
