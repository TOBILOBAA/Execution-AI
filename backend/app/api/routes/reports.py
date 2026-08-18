"""
Report generation and retrieval routes.
"""
from uuid import UUID
from fastapi import APIRouter, Depends, Request
from supabase import Client

from app.api.deps import get_db
from app.core.exceptions import AIGenerationError
from app.schemas.reports import (
    DailyReportRequest,
    WeeklyReportRequest,
    MonthlyReportRequest,
    QuarterlyReportRequest,
    YearlyReportRequest,
)
from app.services import activity_service, report_service

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/{session_id}")
def list_reports(session_id: UUID, request: Request, db: Client = Depends(get_db)):
    """List all generated reports for a session."""
    activity_service.track_opened_reports(db, session_id, user_agent=request.headers.get("user-agent"))
    return report_service.list_reports(db, session_id)


@router.post("/daily/generate")
def generate_daily_report(
    body: DailyReportRequest,
    db: Client = Depends(get_db),
):
    """
    Generate or regenerate a daily report.
    Only available after REPORT_CUTOFF_HOUR UTC for today's report.
    Past dates can be generated at any time.
    """
    try:
        return report_service.generate_daily_report(db, body.session_id, body.date, user_note=body.user_note)
    except RuntimeError as exc:
        raise AIGenerationError(str(exc)) from exc


@router.post("/weekly/generate")
def generate_weekly_report(
    body: WeeklyReportRequest,
    db: Client = Depends(get_db),
):
    """Generate or regenerate a weekly execution report."""
    try:
        return report_service.generate_weekly_report(db, body.session_id, body.year, body.week_number, user_note=body.user_note)
    except RuntimeError as exc:
        raise AIGenerationError(str(exc)) from exc


@router.post("/monthly/generate")
def generate_monthly_report(
    body: MonthlyReportRequest,
    db: Client = Depends(get_db),
):
    """Generate or regenerate a monthly execution report."""
    try:
        return report_service.generate_monthly_report(db, body.session_id, body.year, body.month, user_note=body.user_note)
    except RuntimeError as exc:
        raise AIGenerationError(str(exc)) from exc


@router.post("/yearly/generate")
def generate_yearly_report(
    body: YearlyReportRequest,
    db: Client = Depends(get_db),
):
    """Generate or regenerate a yearly execution report."""
    try:
        return report_service.generate_yearly_report(db, body.session_id, body.year, user_note=body.user_note)
    except RuntimeError as exc:
        raise AIGenerationError(str(exc)) from exc


@router.post("/quarterly/generate")
def generate_quarterly_report(
    body: QuarterlyReportRequest,
    db: Client = Depends(get_db),
):
    """Generate or regenerate a quarterly execution report."""
    try:
        return report_service.generate_quarterly_report(db, body.session_id, body.year, body.quarter, user_note=body.user_note)
    except RuntimeError as exc:
        raise AIGenerationError(str(exc)) from exc
