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
    user = res.json()
    async with httpx.AsyncClient(timeout=10) as client:
        profile = await client.get(
            f"{settings.supabase_url}/rest/v1/profiles",
            params={"id": f"eq.{user['id']}", "select": "role"},
            headers={"Authorization": authorization, "apikey": settings.supabase_anon_key},
        )
    if profile.status_code != 200 or not profile.json():
        raise HTTPException(403, "Profile required")
    if profile.json()[0]["role"] == "demo":
        raise HTTPException(403, "Demo accounts have read-only showcase access")
    return user
