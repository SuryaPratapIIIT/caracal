# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# FastMCP auth middleware that delegates to caracalai_transport_mcp.

from __future__ import annotations

from typing import Any

from caracalai_revocation import RevocationStore
from caracalai_transport_mcp import authenticate


class CaracalAuth:
    def __init__(
        self,
        issuer: str,
        audience: str,
        revocations: RevocationStore,
        required_scopes: list[str] | None = None,
        expected_zone_id: str | None = None,
    ) -> None:
        self.issuer = issuer
        self.audience = audience
        self.expected_zone_id = expected_zone_id
        self.required_scopes = required_scopes or []
        self.revocations = revocations

    async def __call__(self, token: str) -> dict[str, Any]:
        result = await authenticate(
            token,
            self.issuer,
            self.audience,
            self.required_scopes,
            self.expected_zone_id,
            self.revocations,
        )
        if result.error is not None:
            raise PermissionError(result.error.description) if result.error.code == "insufficient_scope" else ValueError(result.error.description)
        assert result.principal is not None
        return result.principal
