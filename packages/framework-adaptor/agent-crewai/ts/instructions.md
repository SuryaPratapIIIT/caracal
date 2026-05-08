# agent-crewai/ts

## Scope
- Covers only the `@caracalai/agent-crewai` TS package under `packages/framework-adaptor/agent-crewai/ts/`.

## Required
- Must wrap the `@caracalai/agent-core` `BaseAdapter` for CrewAI task execution.

## Forbidden
- Must not duplicate agent runtime logic.
- Must not import `@caracalai/oauth` or `@caracalai/identity` directly; route through `@caracalai/agent-core`.
