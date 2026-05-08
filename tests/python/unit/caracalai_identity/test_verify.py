# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Python identity verify_token unit tests for valid token handling.

from __future__ import annotations

from pathlib import Path
import sys
import unittest

sys.path.append(str(Path(__file__).parents[3] / "shared" / "test-utils" / "python"))

from caracal_test_tokens import mint_es256_token
from caracalai_identity import verify


class StubCache:
    def __init__(self) -> None:
        self.keys: list[dict[str, object]] = []
        self.issuers: list[str] = []

    async def get_keys(self, issuer: str) -> list[dict[str, object]]:
        self.issuers.append(issuer)
        return self.keys


class VerifyTokenTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.cache = StubCache()
        self.original_cache = verify._cache
        verify._cache = self.cache

    async def asyncTearDown(self) -> None:
        verify._cache = self.original_cache

    async def test_accepts_valid_token_with_required_scope_and_zone(self) -> None:
        token, jwk = mint_es256_token(scopes=("read", "write"))
        self.cache.keys = [jwk]

        claims = await verify.verify_token(
            token,
            "https://sts.example.com",
            "resource://api",
            required_scopes=["read"],
            expected_zone_id="zone1",
        )

        self.assertEqual(claims["zone_id"], "zone1")
        self.assertEqual(claims["sub"], "user1")
        self.assertEqual(self.cache.issuers, ["https://sts.example.com"])


if __name__ == "__main__":
    unittest.main()
