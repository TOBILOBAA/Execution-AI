from uuid import UUID
from fastapi import APIRouter, Depends, Body, Request
from supabase import Client

from app.api.deps import get_db
from app.core.exceptions import NotFoundError
from app.schemas.session import SessionCreate, SessionResponse, SessionUpdate
from app.services import activity_service
import app.db.sessions as sessions_db

router = APIRouter(prefix="/session", tags=["Sessions"])


@router.post("/start", response_model=SessionResponse, status_code=201)
def start_session(
    body: SessionCreate = Body(default=SessionCreate()),
    request: Request | None = None,
    db: Client = Depends(get_db),
):
    """Create or recover a workspace session for the current auth user."""
    session = sessions_db.get_or_create_session(
        db,
        body.device_hint,
        body.timezone,
        auth_user_id=body.auth_user_id,
        week_starts_on=body.week_starts_on,
    )
    activity_service.track_app_open(db, session["id"], user_agent=request.headers.get("user-agent") if request else None)
    return session


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: UUID, db: Client = Depends(get_db)):
    """Retrieve an existing session by ID."""
    session = sessions_db.get_session(db, session_id)
    if not session:
        raise NotFoundError("Session", str(session_id))
    return session


@router.patch("/{session_id}", response_model=SessionResponse)
def update_session(
    session_id: UUID,
    body: SessionUpdate,
    db: Client = Depends(get_db),
):
    """Update session metadata (onboarding step, timezone, etc.)."""
    session = sessions_db.get_session(db, session_id)
    if not session:
        raise NotFoundError("Session", str(session_id))
    updates = body.model_dump(exclude_none=True)
    updated = sessions_db.update_session(db, session_id, updates)
    if updates.get("onboarding_done"):
        activity_service.track_onboarding_completed(db, session_id)
    else:
        activity_service.record_activity(db, session_id)
    return updated
