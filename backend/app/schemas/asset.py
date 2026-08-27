import uuid

from pydantic import BaseModel, field_validator


class AssetIn(BaseModel):
    name: str
    target: str
    asset_type: str
    asset_weight: float = 1.0
    owner_email: str | None = None


class AssetOut(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    target: str
    asset_type: str
    asset_weight: float
    owner_email: str | None
    last_scan: str | None = None
    findings_count: dict | None = None

    model_config = {"from_attributes": True}


class AssetUpdate(BaseModel):
    asset_weight: float

    @field_validator("asset_weight")
    @classmethod
    def validate_weight(cls, v: float) -> float:
        if v not in (0.5, 1.0, 1.5, 2.0):
            raise ValueError("asset_weight must be 0.5, 1.0, 1.5, or 2.0")
        return v


class AssetBulkUpdateItem(BaseModel):
    id: str | None = None
    target: str | None = None
    owner_email: str | None = None


