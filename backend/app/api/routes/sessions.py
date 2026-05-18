from uuid import UUID
from fastapi import APIRouter, Depends, Body
from supabase import Client

from app.api.deps import get_db
from app.core.exceptions import NotFoundError
from app.schemas.session import SessionCreate, SessionResponse, SessionUpdate
from app.services import activity_service
import app.db.sessions as sessions_db

router = APIRouter(prefix="/session", tags=["Sessions"])


def _touch_app_open_safe(db: Client, session_id: UUID | str) -> None:
    """Best-effort analytics only; session bootstrap must not fail because of tracking."""
    try:
        activity_service.touch_app_open(db, session_id)
    except Exception:
        return


@router.post("/start", response_model=SessionResponse, status_code=201)
def start_session(
    body: SessionCreate = Body(default=SessionCreate()),
    db: Client = Depends(get_db),
):
    """Create or recover a workspace session for the current auth user."""
    session = sessions_db.get_or_create_session(
        db,
        body.device_hint,
        body.timezone,
        auth_user_id=body.auth_user_id,
        auth_name=body.auth_name,
        auth_email=body.auth_email,
        week_starts_on=body.week_starts_on,
    )
    _touch_app_open_safe(db, session["id"])
    return sessions_db.get_session(db, session["id"])


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: UUID, db: Client = Depends(get_db)):
    """Retrieve an existing session by ID."""
    session = sessions_db.get_session(db, session_id)
    if not session:
        raise NotFoundError("Session", str(session_id))
    _touch_app_open_safe(db, session_id)
    return sessions_db.get_session(db, session_id)


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
    if not session.get("onboarding_done") and updated.get("onboarding_done"):
        activity_service.mark_event(db, session_id, "onboarding_completed")
    if len(updated.get("handled_recaps") or []) > len(session.get("handled_recaps") or []):
        activity_service.mark_event(db, session_id, "recap_handled")
    return sessions_db.get_session(db, session_id)
