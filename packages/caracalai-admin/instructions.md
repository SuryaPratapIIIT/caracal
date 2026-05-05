# caracalai-admin

## Scope
- Covers only `caracal/packages/caracalai-admin/`.

## Required
- Must export a single `AdminClient` typed wrapper around the Caracal admin API (`/v1/*`) and the agent coordinator API.
- Must take `apiUrl`, `coordinatorUrl`, and an admin bearer token in the constructor; never read environment variables directly.
- Must use the platform `fetch`; must not pull in heavy HTTP dependencies.
- Must surface non-2xx responses as `AdminApiError` with `status`, `code`, and `body`.
- Must remain framework-agnostic; consumable from CLI, scripts, and tests.

## Forbidden
- Must not import from `caracalEnterprise/`.
- Must not embed credentials or read disk state.
- Must not introduce schema validation libraries; types are TypeScript-only.
