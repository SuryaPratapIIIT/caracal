# agent-core/ts

## Scope
- Covers only the `@caracalai/agent-core` TS package under `packages/agent-core/ts/`.

## Required
- Must implement the provider-neutral agent runtime: auth context binding, tool-call dispatch, message envelopes.
- Must bind `AgentServiceConfig.url` as listen address, advertised registry address, and JWT `aud`.
- Must route token exchange through `@caracalai/oauth`.
- Must expose the framework-neutral `BaseAdapter` and `CustomPipelineAdapter` only.

## Forbidden
- Must not depend on any specific agent framework SDK (no CrewAI, no LangChain).
- Must not contain transport-specific wire logic; A2A wire format lives in `@caracalai/transport-a2a`.
- Must not allow scope escalation across hops.
- Must not log plaintext tokens.
