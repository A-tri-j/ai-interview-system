import re

from pydantic import BaseModel, Field, field_validator

from app.schemas.vacancy import _clean_list


class ProfileUpdate(BaseModel):
    """Shob field optional: shudhu je field pathabe sheta-i bodlabe."""
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    phone: str | None = None
    education: str | None = Field(default=None, max_length=3000)
    skills: list[str] | None = None
    experience: str | None = Field(default=None, max_length=5000)
    projects: str | None = Field(default=None, max_length=5000)
    portfolio_url: str | None = Field(default=None, max_length=500)

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, v):
        if v is None:
            return v
        cleaned = re.sub(r"[\s\-]", "", v)
        if not re.fullmatch(r"\+?[0-9]{7,15}", cleaned):
            raise ValueError("Enter a valid phone number")
        return cleaned

    @field_validator("portfolio_url")
    @classmethod
    def valid_url(cls, v):
        if v and not re.match(r"^https?://", v):
            raise ValueError("Portfolio URL must start with http:// or https://")
        return v or None

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, v):
        return _clean_list(v)


class ChangePassword(BaseModel):
    current_password: str = Field(min_length=1, max_length=64)
    new_password: str = Field(min_length=8, max_length=64)
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def strong(cls, v):
        if not (re.search(r"[a-z]", v) and re.search(r"[A-Z]", v) and re.search(r"\d", v)):
            raise ValueError("Password needs an uppercase letter, a lowercase letter and a number")
        return v

