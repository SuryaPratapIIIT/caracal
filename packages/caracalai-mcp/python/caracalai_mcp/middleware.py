# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# FastMCP auth middleware: validates Caracal JWTs in Python MCP servers.

from __future__ import annotations

from typing import Any

from caracalai_identity import verify_token


class CaracalAuth:
    def __init__(
        self,
        issuer: str,
        audience: str,
        required_scopes: list[str] | None = None,
        expected_zone_id: str | None = None,
    ) -> None:
        self.issuer = issuer
        self.audience = audience
        self.expected_zone_id = expected_zone_id
        self.required_scopes = required_scopes or []

    async def __call__(self, token: str) -> dict[str, Any]:
        return await verify_token(
            token,
            self.issuer,
            self.audience,
            self.required_scopes,
            self.expected_zone_id,
        )
