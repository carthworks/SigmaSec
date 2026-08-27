import uuid

from pydantic import BaseModel


class OrgCreate(BaseModel):
    name: str
    slug: str


class OrgOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str  # slug is a unique, URL-/identifier-friendly short code for an organization ->  slug="CS"
    is_active: bool

    model_config = {"from_attributes": True}
