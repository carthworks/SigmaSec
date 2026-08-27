import datetime
import uuid
from typing import List


from pydantic import BaseModel


class ScanIn(BaseModel):
    target: str
    scan_types: List[str]
    asset_id: uuid.UUID | None = None
    active_validation: bool = False
    docker_image: str | None = None
    git_repo: str | None = None


class ScanOut(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    target: str
    scan_types: List[str]
    status: str
    celery_task_id: str | None
    created_at: datetime.datetime
    findings_count: dict

    model_config = {"from_attributes": True}
