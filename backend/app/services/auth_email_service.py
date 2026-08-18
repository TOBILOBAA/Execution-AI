from __future__ import annotations

from email.message import EmailMessage
import smtplib
import ssl
from urllib.parse import urlparse

import httpx
from supabase import Client

from app.core.config import get_settings
from app.core.exceptions import DeliveryError, ValidationError
from app.core.logging import logger


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _resolve_redirect_url(explicit_redirect: str | None, fallback_path: str) -> str:
    settings = get_settings()
    if explicit_redirect:
        parsed = urlparse(explicit_redirect)
        if parsed.scheme in {"http", "https"} and parsed.netloc:
            return explicit_redirect
        raise ValidationError("Auth redirect URL is invalid.")

    base = settings.notification_public_base_url.strip().rstrip("/")
    if not base:
        raise ValidationError("Public auth redirect URL is not configured.")
    return f"{base}{fallback_path}"


def _generate_auth_link(
    link_type: str,
    email: str,
    *,
    password: str | None = None,
    redirect_to: str,
) -> dict:
    settings = get_settings()
    payload: dict[str, str] = {
        "type": link_type,
        "email": _normalize_email(email),
        "redirect_to": redirect_to,
    }
    if password is not None:
        payload["password"] = password

    response = httpx.post(
        f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/generate_link",
        headers={
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30.0,
    )
    if response.is_success:
        return response.json()

    detail = response.text
    try:
        body = response.json()
        detail = body.get("msg") or body.get("message") or body.get("error_description") or detail
    except ValueError:
        pass

    lower = detail.lower()
    if "already" in lower or "registered" in lower or "exists" in lower:
        raise ValidationError(detail)
    if "user not found" in lower:
        raise ValidationError(detail)
    raise DeliveryError(detail or "Could not generate auth email link.")


def _best_effort_store_full_name(db: Client, generated: dict, full_name: str) -> None:
    user_id = generated.get("id")
    if not user_id or not full_name.strip():
        return
    try:
        db.auth.admin.update_user_by_id(
            user_id,
            {"user_metadata": {"full_name": full_name.strip()}},
        )
    except Exception as exc:  # pragma: no cover - non-fatal best effort
        logger.warning("auth_signup_full_name_update_failed", user_id=user_id, error=str(exc))


def _smtp_client() -> smtplib.SMTP:
    settings = get_settings()
    host = settings.notification_smtp_host.strip()
    user = settings.notification_smtp_user.strip()
    password = settings.notification_smtp_password.strip()
    if not host or not user or not password or not settings.notification_email_from.strip():
        raise DeliveryError(
            "Auth email delivery is not configured. Add NOTIFICATION_SMTP_* and NOTIFICATION_EMAIL_FROM on the backend."
        )

    if settings.notification_smtp_ssl:
        client: smtplib.SMTP = smtplib.SMTP_SSL(
            host,
            settings.notification_smtp_port,
            context=ssl.create_default_context(),
            timeout=30,
        )
    else:
        client = smtplib.SMTP(host, settings.notification_smtp_port, timeout=30)
        if settings.notification_smtp_starttls:
            client.starttls(context=ssl.create_default_context())
    client.login(user, password)
    return client


def _send_email(*, to_email: str, subject: str, html: str, text: str) -> None:
    settings = get_settings()
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.notification_email_from.strip()
    message["To"] = _normalize_email(to_email)
    reply_to = settings.notification_email_reply_to.strip()
    if reply_to:
        message["Reply-To"] = reply_to
    message.set_content(text)
    message.add_alternative(html, subtype="html")

    try:
        with _smtp_client() as client:
            client.send_message(message)
    except DeliveryError:
        raise
    except Exception as exc:
        raise DeliveryError(
            "Error sending auth email. Check backend SMTP settings and the mail provider dashboard."
        ) from exc


def send_signup_verification_email(
    db: Client,
    *,
    name: str,
    email: str,
    password: str,
    redirect_to: str | None,
) -> dict:
    target = _normalize_email(email)
    resolved_redirect = _resolve_redirect_url(redirect_to, "/auth/callback")
    generated = _generate_auth_link("signup", target, password=password, redirect_to=resolved_redirect)
    _best_effort_store_full_name(db, generated, name)

    action_link = generated.get("action_link")
    if not action_link:
        raise DeliveryError("Sign-up link generation did not return an action link.")

    first_name = name.strip().split(" ")[0] if name.strip() else "there"
    _send_email(
        to_email=target,
        subject="Verify your Execution AI account",
        text=(
            f"Hi {first_name},\n\n"
            "Verify your Execution AI account to continue into onboarding:\n\n"
            f"{action_link}\n\n"
            "If you did not request this, you can ignore this email."
        ),
        html=(
            f"<p>Hi {first_name},</p>"
            "<p>Verify your <strong>Execution AI</strong> account to continue into onboarding.</p>"
            f"<p><a href=\"{action_link}\">Verify your account</a></p>"
            "<p>If you did not request this, you can ignore this email.</p>"
        ),
    )
    return {"success": True, "message": "Verification email sent."}


def send_password_reset_email(*, email: str, redirect_to: str | None) -> dict:
    target = _normalize_email(email)
    resolved_redirect = _resolve_redirect_url(redirect_to, "/auth/update-password")
    generated = _generate_auth_link("recovery", target, redirect_to=resolved_redirect)

    action_link = generated.get("action_link")
    if not action_link:
        raise DeliveryError("Password reset link generation did not return an action link.")

    _send_email(
        to_email=target,
        subject="Reset your Execution AI password",
        text=(
            "Use the link below to reset your Execution AI password:\n\n"
            f"{action_link}\n\n"
            "If you did not request this, you can ignore this email."
        ),
        html=(
            "<p>Use the link below to reset your <strong>Execution AI</strong> password.</p>"
            f"<p><a href=\"{action_link}\">Reset your password</a></p>"
            "<p>If you did not request this, you can ignore this email.</p>"
        ),
    )
    return {"success": True, "message": "Password reset email sent."}
