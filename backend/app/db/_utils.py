"""Shared repository helpers for payload normalization and single-row reads."""
from collections.abc import Mapping, Sequence
from datetime import date, datetime
from uuid import UUID


def serialize_value(value):
    """Recursively normalize payload values for Supabase JSON transport."""
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Mapping):
        return {key: serialize_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [serialize_value(item) for item in value]
    if isinstance(value, tuple):
        return tuple(serialize_value(item) for item in value)
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [serialize_value(item) for item in value]
    return value


def serialize_payload(payload: dict) -> dict:
    """Return a shallow dict with all nested UUID/date values serialized."""
    return {key: serialize_value(value) for key, value in payload.items()}
