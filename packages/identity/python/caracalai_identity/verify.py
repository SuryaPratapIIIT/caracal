# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Verifies a Caracal JWT against an issuer JWKS and enforces zone and scope claims.

from __future__ import annotations

import json
from typing import Any

import jwt

from .jwks import JwksCache
from .scope import has_scope

_cache = JwksCache()


async def verify_token(
    token: str,
    issuer: str,
    audience: str,
    required_scopes: list[str] | None = None,
    expected_zone_id: str | None = None,
) -> dict[str, Any]:
    keys = await _cache.get_keys(issuer)

    decoded: dict[str, Any] | None = None
    last_err: Exception | None = None
    for key in keys:
        try:
            decoded = jwt.decode(
                token,
                jwt.PyJWK.from_json(json.dumps(key)).key,
                algorithms=["ES256"],
                audience=audience,
                issuer=issuer,
            )
            break
        except Exception as e:
            last_err = e

    if decoded is None:
        raise ValueError(f"Token validation failed: {last_err}")

    scope: str = decoded.get("scope", "")
    zone_id: str | None = decoded.get("zone_id")
    if not zone_id or (expected_zone_id and zone_id != expected_zone_id):
        raise ValueError("Token zone validation failed")
    for required in required_scopes or []:
        if not has_scope(scope, required):
            raise PermissionError(f"Missing required scope: {required}")

    return decoded
