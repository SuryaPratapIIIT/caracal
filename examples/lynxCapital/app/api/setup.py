"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Setup validation endpoint that confirms required environment variables are present.
"""
from __future__ import annotations

import os

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/validate")
async def validate_setup():
    api_key = os.environ.get("OPENAI_API_KEY", "")
    steps = [
        {
            "id": "openai_key",
            "label": "OPENAI_API_KEY set",
            "ok": bool(api_key),
            "detail": "Found in environment." if api_key
                      else "OPENAI_API_KEY missing — add it to .env or your shell.",
        },
    ]
    overall = all(s["ok"] for s in steps)
    return JSONResponse({"ok": overall, "steps": steps})
