from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query
from supabase import Client

from app.api.deps import get_db
from app.schemas.activity import (
    AdminActivityOverviewResponse,
    ActivityOverviewResponse,
    ActivityTouchRequest,
    DailyUserActivityResponse,
)
from app.services import activity_service

router = APIRouter(prefix="/activity", tags=["Activity"])


@router.get("/admin/overview", response_model=AdminActivityOverviewResponse)
def get_admin_activity_overview(
    days: int = Query(default=14, ge=1, le=90),
    limit: int = Query(default=50, ge=1, le=200),
    db: Client = Depends(get_db),
):
    return activity_service.get_admin_activity_overview(
        db,
        days=days,
        limit=limit,
    )


@router.get("/{session_id}", response_model=ActivityOverviewResponse)
def get_activity_overview(
    session_id: UUID,
    days: int = Query(default=30, ge=1, le=90),
    db: Client = Depends(get_db),
):
    return activity_service.get_activity_overview(db, session_id, days=days)


@router.post("/{session_id}/touch", response_model=DailyUserActivityResponse)
def touch_activity(
    session_id: UUID,
    body: ActivityTouchRequest = Body(...),
    db: Client = Depends(get_db),
):
    return activity_service.mark_event(
        db,
        session_id,
        body.event,
        activity_date=body.activity_date,
    )
