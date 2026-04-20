"""FastAPI dependency injection."""
from supabase import Client
from app.db.client import get_supabase


def get_db() -> Client:
    return get_supabase()
