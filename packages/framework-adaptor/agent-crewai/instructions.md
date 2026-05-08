# agent-crewai

## Scope
- Covers the per-language CrewAI adaptors for the Caracal agent runtime.

## Required
- Each language subdirectory must wrap the `agent-core` runtime around the CrewAI agent surface.

## Forbidden
- Must not duplicate runtime logic that belongs in `agent-core`.
