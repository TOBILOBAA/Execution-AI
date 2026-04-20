"""
Supabase client singleton.
Uses service role key so the backend can bypass RLS for server-side operations.
"""
from functools import lru_cache
import httpx
from supabase import create_client, Client
from supabase.lib.client_options import SyncClientOptions
from app.core.config import get_settings


@lru_cache
def get_supabase() -> Client:
    settings = get_settings()
    # Use a shared HTTP/1.1 client for Supabase requests. The default PostgREST
    # transport enables HTTP/2, which has been intermittently failing in local
    # dev with ReadError "[Errno 35] Resource temporarily unavailable".
    http_client = httpx.Client(
        http2=False,
        follow_redirects=True,
        timeout=httpx.Timeout(120.0),
    )
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
        options=SyncClientOptions(
            auto_refresh_token=False,
            persist_session=False,
            httpx_client=http_client,
            postgrest_client_timeout=120,
        ),
    )
