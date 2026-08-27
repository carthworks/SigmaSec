import re
import uuid

from pydantic import BaseModel, EmailStr, field_validator

_COMMON_PASSWORDS = {  # how to automate this - need to look at the top 100k passwords from https://github.com/danielmiessler/SecLists/blob/master/Passwords/Common-Credentials/10k-most-common.txt
    "password",
    "password1",
    "password123",
    "12345678",
    "123456789",
    "qwerty123",
    "letmein123",
    "admin1234",
    "welcome123",
    "iloveyou123",
}


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    role: str = "analyst"

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 12:
            raise ValueError("password must be at least 12 characters")
        if len(v.encode("utf-8")) > 72:
            # bcrypt silently ignores bytes beyond 72, so longer inputs give no extra strength
            raise ValueError("password must be at most 72 bytes long")
        if v.lower() in _COMMON_PASSWORDS:
            raise ValueError("password is too common, choose a stronger one")
        if not any(c.islower() for c in v):
            raise ValueError("password must contain a lowercase letter")
        if not any(c.isupper() for c in v):
            raise ValueError("password must contain an uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("password must contain a digit")
        if not re.search(r"[^a-zA-Z0-9]", v):
            raise ValueError("password must contain a special character")
        return v


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    role: str
    org_id: uuid.UUID
    is_active: bool
    is_verified: bool

    model_config = {"from_attributes": True}
