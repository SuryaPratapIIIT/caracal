# identity/python

## Scope
- Covers only the `caracalai-identity` Python package under `packages/identity/python/`.

## Required
- Must implement JWT verification, JWKS fetch and cache, scope evaluation, and typed claim shapes only.
- Must depend only on `PyJWT` and `httpx`.

## Forbidden
- Must not import any transport, framework, runtime, storage backend, or `caracalEnterprise/` code.
- Must not reference MCP, FastMCP, Postgres, or Cloudflare.
