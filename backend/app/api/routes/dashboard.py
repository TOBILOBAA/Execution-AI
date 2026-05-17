from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends
from supabase import Client

from app.api.deps import get_db
from app.services import activity_service
from app.services import dashboard_service
from app.schemas.dashboard import NextDayReviewApproveRequest
from app.utils.period_guards import get_session_today

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/{session_id}")
def get_dashboard(
    session_id: UUID,
    plan_date: date | None = None,
    db: Client = Depends(get_db),
):
    """
    Aggregate dashboard for the current session.
    Returns today's priorities, weekly context, monthly context, habits, and metrics.
    All metrics are computed in Python — no AI involved.
    """
    return dashboard_service.get_dashboard(db, session_id, plan_date)


@router.get("/{session_id}/next-day-review")
def get_next_day_review(
    session_id: UUID,
    plan_date: date | None = None,
    db: Client = Depends(get_db),
):
    """Return the persisted review payload for the requested kickoff date."""
    activity_service.mark_event(
        db,
        session_id,
        "next_day_review_opened",
        activity_date=plan_date,
    )
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
    activity_service.mark_event(
        db,
        session_id,
        "next_day_review_approved",
        activity_date=effective_date,
    )
    return result
