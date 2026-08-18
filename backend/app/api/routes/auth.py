from fastapi import APIRouter, Depends
from supabase import Client

from app.api.deps import get_db
from app.schemas.auth import AuthEmailResponse, PasswordResetEmailRequest, SignupEmailRequest
from app.services import auth_email_service


router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/signup-email", response_model=AuthEmailResponse)
def send_signup_email(body: SignupEmailRequest, db: Client = Depends(get_db)):
    return auth_email_service.send_signup_verification_email(
        db,
        name=body.name,
        email=body.email,
        password=body.password,
        redirect_to=body.redirect_to,
    )


@router.post("/password-reset-email", response_model=AuthEmailResponse)
def send_password_reset_email(body: PasswordResetEmailRequest):
    return auth_email_service.send_password_reset_email(
        email=body.email,
        redirect_to=body.redirect_to,
    )
