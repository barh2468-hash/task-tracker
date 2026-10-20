import httpx
from fastapi import Header, HTTPException

from .config import settings


async def current_user(authorization: str = Header(default="")) -> dict:
    """Validate the Supabase access token sent by the frontend and return the user."""
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={"Authorization": authorization, "apikey": settings.supabase_anon_key},
        )
    if res.status_code != 200:
        raise HTTPException(401, "Invalid token")
    return res.json()
