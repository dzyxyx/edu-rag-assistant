from pydantic import BaseModel


class HHEmployer(BaseModel):
    id: str
    name: str
    url: str | None = None
    alternate_url: str | None = None
    site_url: str | None = None
    description: str | None = None
    area: dict | None = None
    industries: list[dict] = []
    employee_count: int | None = None


class HHVacancy(BaseModel):
    id: str
    name: str
    employer: HHEmployer
    area: dict | None = None
    salary: dict | None = None
    snippet: dict | None = None
    url: str | None = None
    alternate_url: str | None = None
    experience: dict | None = None
    employment: dict | None = None
    schedule: dict | None = None
    description: str | None = None
