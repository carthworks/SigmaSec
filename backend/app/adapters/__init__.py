# app/adapters/__init__.py

from .base import BaseAdapter
from .nuclei import NucleiAdapter
from .trivy import TrivyAdapter
from .gitleaks import GitleaksAdapter
from .opengroup import OpenGroupAdapter

__all__ = [
    "BaseAdapter",
    "NucleiAdapter",
    "TrivyAdapter",
    "GitleaksAdapter",
    "OpenGroupAdapter",
]

