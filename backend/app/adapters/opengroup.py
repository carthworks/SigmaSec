# app/adapters/opengroup.py
"""
OpenGroup adapter (backward-compatible alias for Opengrep SAST scanner).
"""

from app.adapters.opengrep import OpengrepAdapter


class OpenGroupAdapter(OpengrepAdapter):
    """
    Runs OpenGroup/Opengrep static security analysis (SAST) scanner.
    Maintained for backward compatibility.
    """

    tool_name = "opengroup"
