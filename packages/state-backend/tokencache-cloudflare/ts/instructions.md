# tokencache-cloudflare/ts

## Scope
- Covers only the `@caracalai/tokencache-cloudflare` TS package under `packages/state-backend/tokencache-cloudflare/ts/`.

## Required
- Must implement only the `@caracalai/oauth` `TokenCache` interface using Cloudflare Workers primitives.
- Must keep entries scoped per isolate; entries must not leak across subjects.

## Forbidden
- Must not contain JWKS, fetch, or runtime adaptor logic.
- Must not use Node-only modules.
- Must not persist tokens to KV or Durable Objects.
- Must not log token values.
