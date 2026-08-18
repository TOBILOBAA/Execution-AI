from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, Request
from supabase import Client

from app.api.deps import get_db
from app.core.exceptions import NotFoundError
import app.db.sessions as sessions_db
from app.services import activity_service
from app.services import dashboard_service
from app.schemas.dashboard import NextDayRecoveryApproveRequest, NextDayReviewApproveRequest
from app.utils.period_guards import get_session_today

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/{session_id}")
def get_dashboard(
    session_id: UUID,
    request: Request,
    plan_date: date | None = None,
    db: Client = Depends(get_db),
):
    """
    Aggregate dashboard for the current session.
    Returns today's priorities, weekly context, monthly context, habits, and metrics.
    All metrics are computed in Python — no AI involved.
    """
    activity_service.track_reached_dashboard(db, session_id, user_agent=request.headers.get("user-agent"))
    return dashboard_service.get_dashboard(db, session_id, plan_date)


@router.get("/{session_id}/next-day-review")
def get_next_day_review(
    session_id: UUID,
    request: Request,
    plan_date: date | None = None,
    db: Client = Depends(get_db),
):
    """Return the persisted review payload for the requested kickoff date."""
    if not sessions_db.get_session(db, session_id):
        raise NotFoundError("Session", str(session_id))
    activity_service.track_opened_next_day_review(db, session_id, user_agent=request.headers.get("user-agent"))
    return dashboard_service.get_next_day_review(db, session_id, plan_date)


@router.post("/{session_id}/next-day-review/approve")
def approve_next_day_review(
    session_id: UUID,
    body: NextDayReviewApproveRequest,
    plan_date: date | None = None,
    db: Client = Depends(get_db),
):
    """
    Save the user-approved kickoff plan for today.

    If `plan_date` is omitted, the backend uses the current local date on the server.
    """
    effective_date = plan_date or get_session_today(db, session_id)
    result = dashboard_service.approve_next_day_review(
        db,
        session_id,
        effective_date,
        [item.model_dump() for item in body.priorities],
        [item.model_dump() for item in body.tasks],
    )
    activity_service.track_approved_next_day_review(db, session_id, effective_date)
    activity_service.refresh_daily_completion_counts(db, session_id, effective_date)
    return result


@router.post("/{session_id}/next-day-review/recovery")
def approve_next_day_recovery(
    session_id: UUID,
    body: NextDayRecoveryApproveRequest,
    db: Client = Depends(get_db),
):
    source_date = date.fromisoformat(body.source_date)
    result = dashboard_service.approve_next_day_recovery(
        db,
        session_id,
        source_date,
        body.item_id,
        body.item_kind,
    )
    activity_service.refresh_daily_completion_counts(db, session_id, source_date)
    return result
