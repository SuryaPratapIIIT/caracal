# caracalai-mcp-go

## Scope
- Covers only the Go `net/http` middleware under `caracal/packages/caracalai-mcp-go/`.

## Required
- Must validate Caracal-issued JWTs at every MCP tool boundary.
- Must cache JWKS with 5-min TTL.
- Must check `iss`, `aud`, `exp`, and scope on every request.
- Must be listed in `go.work` at the workspace root.

## Forbidden
- Must not import from `caracalEnterprise/`.
- Must not log plaintext bearer tokens.
