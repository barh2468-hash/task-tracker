from anthropic import AsyncAnthropic
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .auth import current_user
from .config import settings

app = FastAPI(title="MAYA API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)
claude = AsyncAnthropic(api_key=settings.anthropic_api_key)


class ChatRequest(BaseModel):
    prompt: str


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/ai/chat")
async def chat(body: ChatRequest, user: dict = Depends(current_user)):
    msg = await claude.messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        messages=[{"role": "user", "content": body.prompt}],
    )
    return {"text": msg.content[0].text}
