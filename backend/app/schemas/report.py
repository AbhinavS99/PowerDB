from datetime import datetime

from pydantic import BaseModel


class ReportCreate(BaseModel):
    title: str
    notes: str | None = None
    # TODO: Add power audit fields once data model is defined


class ReportUpdate(BaseModel):
    title: str | None = None
    status: str | None = None
    notes: str | None = None
    # TODO: Add power audit fields once data model is defined


class ReportResponse(BaseModel):
    id: int
    title: str
    status: str
    created_by: int
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
