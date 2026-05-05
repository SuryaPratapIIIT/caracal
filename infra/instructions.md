# infra

## Scope
- Covers only infrastructure configuration under this directory.

## Required
- Must contain only Docker, PostgreSQL, and Redis configuration directories.
- Must name subdirectories by infrastructure concern (e.g. `docker`, `postgres`, `redis`).

## Forbidden
- Must not contain service source code (Go or TypeScript).
- Must not contain shared library code.
- Must not duplicate environment configuration already in service directories.
