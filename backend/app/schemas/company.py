import re
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class CompanyRegister(BaseModel):
    company_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    registration_number: str = Field(min_length=3, max_length=100)
    manager_name: str = Field(min_length=2, max_length=150)
    manager_designation: str = Field(min_length=2, max_length=150)
    phone: str
    industry: str = Field(min_length=2, max_length=100)
    company_size: str = Field(min_length=1, max_length=50)
    address: str = Field(min_length=5, max_length=500)
    website: str | None = Field(default=None, max_length=300)
    description: str | None = Field(default=None, max_length=3000)
    password: str = Field(min_length=8, max_length=64)
    confirm_password: str

    @field_validator(
        "company_name",
        "registration_number",
        "manager_name",
        "manager_designation",
        "industry",
        "address",
    )
    @classmethod
    def strip_text(cls, v: str) -> str:
        return v.strip()

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.lower()

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, v: str) -> str:
        cleaned = re.sub(r"[\s\-]", "", v)
        if not re.fullmatch(r"\+?[0-9]{7,15}", cleaned):
            raise ValueError("Enter a valid phone number")
        return cleaned

    @field_validator("website")
    @classmethod
    def valid_website(cls, v: str | None) -> str | None:
        if v and not re.match(r"^https?://", v):
            raise ValueError("Website must start with http:// or https://")
        return v or None

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        if not (re.search(r"[a-z]", v) and re.search(r"[A-Z]", v) and re.search(r"\d", v)):
            raise ValueError(
                "Password needs an uppercase letter, a lowercase letter and a number"
            )
        return v

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class CompanyOut(BaseModel):
    id: int
    company_name: str
    email: EmailStr
    manager_name: str
    status: str
    is_email_verified: bool

    model_config = {"from_attributes": True}


# Admin-er jonno beshi tothyo (password hash kokhono na)
class CompanyAdminOut(CompanyOut):
    registration_number: str
    manager_designation: str
    phone: str
    industry: str
    company_size: str
    address: str
    website: str | None
    created_at: datetime
    last_login_at: datetime | None


class CandidateAdminOut(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    phone: str
    is_email_verified: bool
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None

    model_config = {"from_attributes": True}

