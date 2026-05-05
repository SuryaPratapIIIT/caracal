# agent-coordinator

## Scope
- Covers the agent coordinator app under caracal/apps/agent-coordinator/ only.

## Required
- Must use TypeScript on Node 24 (coordinator core, port 4000) and Go 1.26 (relay, no port).
- Must listen on port 4000 only (coordinator).
- Must read and follow caracal/plan/agent-coordinator/plan.md before any change; check off tasks as completed.
- Must enforce hard limits: depth ≤ 10, children ≤ 10, total agents ≤ 50 per zone.
- Must cascade-terminate all descendants on terminate request.
- Must publish to caracal.sessions.revoke on every termination.
- Must use github.com/garudex-labs/caracal/shared/* for Go relay config and logging.

## Forbidden
- Must not import from caracalEnterprise/.
- Must not allow soft-bypass of agent limits.
- Must not store plaintext claims or credentials.
- Must not add features beyond plan.md checkboxes.
