from pydantic import BaseModel, Field


class SignupEmailRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=256)
    redirect_to: str | None = None


class PasswordResetEmailRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    redirect_to: str | None = None


class AuthEmailResponse(BaseModel):
    success: bool = True
    message: str
