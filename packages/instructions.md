# packages

## Scope
- Covers only shared library packages under this directory.

## Required
- Must use prefix `ts-` for internal TypeScript shared packages (e.g. `ts-shared`).
- Must use prefix `caracalai-` for externally-publishable SDK packages (e.g. `caracalai-oauth`).
- Must use no prefix for Go packages (e.g. `shared`).
- Go packages must have their own `go.mod` and be listed in `go.work`.
- TS packages must have their own `package.json` and be listed in `pnpm-workspace.yaml`.
- Python packages must have their own `pyproject.toml`.

## Forbidden
- Must not contain runnable services or applications.
- Must not contain infra configuration.
- Must not duplicate logic already owned by a sibling package.
