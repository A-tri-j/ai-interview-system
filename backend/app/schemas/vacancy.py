from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

EmploymentType = Literal["full_time", "part_time", "contract", "internship", "freelance"]
WorkMode = Literal["remote", "hybrid", "onsite"]


def _clean_list(v: list[str] | None) -> list[str] | None:
    """Skill list-er faka/duplicate/lomba item porishkar kore."""
    if v is None:
        return None
    seen, out = set(), []
    for item in v:
        item = item.strip()[:60]
        if item and item.lower() not in seen:
            seen.add(item.lower())
            out.append(item)
    return out[:30]


class VacancyCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    department: str | None = Field(default=None, max_length=150)
    description: str = Field(min_length=20, max_length=10000)
    responsibilities: str | None = Field(default=None, max_length=5000)
    required_skills: list[str] = Field(default_factory=list)
    required_technologies: list[str] = Field(default_factory=list)
    education_requirements: str | None = Field(default=None, max_length=2000)
    experience_requirements: str | None = Field(default=None, max_length=200)
    employment_type: EmploymentType
    salary_range: str | None = Field(default=None, max_length=100)
    location: str = Field(min_length=2, max_length=200)
    work_mode: WorkMode
    openings: int = Field(default=1, ge=1, le=1000)
    deadline: date | None = None
    interview_instructions: str | None = Field(default=None, max_length=5000)

    @field_validator("title", "location")
    @classmethod
    def strip_text(cls, v: str) -> str:
        return v.strip()

    @field_validator("required_skills", "required_technologies")
    @classmethod
    def clean_lists(cls, v):
        return _clean_list(v) or []


class VacancyUpdate(BaseModel):
    """Shob field optional: shudhu je field pathabe sheta-i bodlabe."""
    title: str | None = Field(default=None, min_length=3, max_length=200)
    department: str | None = Field(default=None, max_length=150)
    description: str | None = Field(default=None, min_length=20, max_length=10000)
    responsibilities: str | None = Field(default=None, max_length=5000)
    required_skills: list[str] | None = None
    required_technologies: list[str] | None = None
    education_requirements: str | None = Field(default=None, max_length=2000)
    experience_requirements: str | None = Field(default=None, max_length=200)
    employment_type: EmploymentType | None = None
    salary_range: str | None = Field(default=None, max_length=100)
    location: str | None = Field(default=None, min_length=2, max_length=200)
    work_mode: WorkMode | None = None
    openings: int | None = Field(default=None, ge=1, le=1000)
    deadline: date | None = None
    interview_instructions: str | None = Field(default=None, max_length=5000)

    @field_validator("required_skills", "required_technologies")
    @classmethod
    def clean_lists(cls, v):
        return _clean_list(v)


class VacancyOut(BaseModel):
    """Company nijer vacancy dekhle (interview_instructions shoho)."""
    id: int
    title: str
    department: str | None
    description: str
    responsibilities: str | None
    required_skills: list[str] | None
    required_technologies: list[str] | None
    education_requirements: str | None
    experience_requirements: str | None
    employment_type: str
    salary_range: str | None
    location: str
    work_mode: str
    openings: int
    deadline: date | None
    interview_instructions: str | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CompanyPublic(BaseModel):
    """Public-e company-r shudhu safe tothyo. Email/phone/registration kokhono na."""
    id: int
    company_name: str
    industry: str
    company_size: str
    website: str | None
    description: str | None

    model_config = {"from_attributes": True}


class PublicVacancyOut(BaseModel):
    """Public-e interview_instructions dekhano hoy na (eta AI-r internal criteria)."""
    id: int
    title: str
    department: str | None
    description: str
    responsibilities: str | None
    required_skills: list[str] | None
    required_technologies: list[str] | None
    education_requirements: str | None
    experience_requirements: str | None
    employment_type: str
    salary_range: str | None
    location: str
    work_mode: str
    openings: int
    deadline: date | None
    created_at: datetime
    company: CompanyPublic

    model_config = {"from_attributes": True}

