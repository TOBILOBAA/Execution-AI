from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from supabase import Client

from app.api.deps import get_db
from app.core.exceptions import NotFoundError
from app.schemas.activity import (
    CategoryPopularityResponse,
    DailyUserActivityResponse,
    UserCategoryProfileResponse,
    UserDeviceActivityResponse,
    UserActivitySummaryListResponse,
    UserActivitySummaryResponse,
)
from app.services import activity_service


router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/users", response_model=UserActivitySummaryListResponse)
def list_user_activity_summaries(
    limit: int | None = 100,
    db: Client = Depends(get_db),
):
    users = activity_service.build_user_activity_summaries(db, limit=limit)
    return {
        "users": users,
        "total_users": len(users),
    }


@router.get("/users/{user_key}", response_model=UserActivitySummaryResponse)
def get_user_activity_summary(
    user_key: str,
    db: Client = Depends(get_db),
):
    summary = activity_service.get_user_activity_summary(db, user_key)
    if not summary:
        raise NotFoundError("Analytics user", user_key)
    return summary


@router.get("/users.csv")
def export_user_activity_summaries_csv(db: Client = Depends(get_db)):
    csv_text = activity_service.export_user_summaries_csv(db)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=user_activity_summary.csv"},
    )


@router.get("/daily-activity", response_model=list[DailyUserActivityResponse])
def list_daily_activity(
    auth_user_id: str | None = None,
    session_id: UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int | None = 500,
    db: Client = Depends(get_db),
):
    return activity_service.list_daily_activity(
        db,
        auth_user_id=auth_user_id,
        session_id=session_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )


@router.get("/daily-activity.csv")
def export_daily_activity_csv(
    auth_user_id: str | None = None,
    session_id: UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    db: Client = Depends(get_db),
):
    csv_text = activity_service.export_daily_activity_csv(
        db,
        auth_user_id=auth_user_id,
        session_id=session_id,
        start_date=start_date,
        end_date=end_date,
    )
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=daily_user_activity.csv"},
    )


@router.get("/devices", response_model=list[UserDeviceActivityResponse])
def list_user_devices(db: Client = Depends(get_db)):
    return activity_service.build_user_device_activity(db)


@router.get("/devices.csv")
def export_user_devices_csv(db: Client = Depends(get_db)):
    csv_text = activity_service.export_user_device_activity_csv(db)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=user_device_activity.csv"},
    )


@router.get("/categories", response_model=list[UserCategoryProfileResponse])
def list_user_category_profiles(db: Client = Depends(get_db)):
    rows, _ = activity_service.build_user_category_profiles(db)
    return rows


@router.get("/categories.csv")
def export_user_category_profiles_csv(db: Client = Depends(get_db)):
    csv_text = activity_service.export_user_category_profiles_csv(db)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=user_category_profile.csv"},
    )


@router.get("/category-popularity", response_model=list[CategoryPopularityResponse])
def list_category_popularity(db: Client = Depends(get_db)):
    _, rows = activity_service.build_user_category_profiles(db)
    return rows


@router.get("/category-popularity.csv")
def export_category_popularity_csv(db: Client = Depends(get_db)):
    csv_text = activity_service.export_category_popularity_csv(db)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=category_popularity.csv"},
    )
