# cli

## Scope
- Covers only the `caracal` CLI under `caracal/apps/cli/`.

## Required
- Must run on Node 24+ via `bin/caracal.mjs`; release artifacts are produced via `bun build --compile` for linux/darwin/windows × x64/arm64.
- Must support `caracal up [services...]`, `caracal down [flags...]`, `caracal status`, `caracal init` (provisions the local zone via `POST /v1/local/bootstrap` and writes `caracal.toml`), `caracal run <cmd...>` (ambient 60-min token injection), and `caracal credential read <resource>` (one-shot 15-min token).
- Must select stack mode in this order: (1) explicit `$CARACAL_HOME` → runtime mode; (2) walk up from cwd for `infra/docker/docker-compose.yml` → dev mode; (3) fall back to runtime mode at the default home.
- Must, in runtime mode, auto-provision `compose.yml`, `provision-streams.sh` (mode 0755), and `.env` (mode 0600) into `$CARACAL_HOME` (default: macOS `~/Library/Application Support/caracal`, otherwise `$XDG_DATA_HOME/caracal` or `~/.local/share/caracal`) using assets bundled at build time, seeding `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, and `CARACAL_ADMIN_TOKEN` with cryptographically random values.
- Must, in runtime mode, pin container image tags to the CLI's `CARACAL_VERSION` constant (overridable by `CARACAL_VERSION` env) and pull from `ghcr.io/garudex-labs/caracal-{api,sts,gateway,audit,coordinator}`.
- Must regenerate `src/runtime/embedded.ts` via `scripts/build-embedded.mjs` before every binary build; the file is generated and gitignored.
- Must resolve `caracal.toml` in this order: `$CARACAL_CONFIG`, `./caracal.toml` (cwd / `$PWD` / `$INIT_CWD`), then `$XDG_CONFIG_HOME/caracal/caracal.toml` (defaulting to `~/.config/caracal/caracal.toml`).
- Must read zone config from `caracal.toml`; must never write credentials to disk except the secret returned by `caracal init`, written with mode 0600 to the resolved config path.
- Must reap injected env vars when the child process exits.
- Must support `continue_on_failure` opt-in and optional resources with `on_failure = "warn"`.
- Must implement MCP shadow governance: exit 1 on unauthorized MCP servers unless `mcp_governance = "log"`.

## Forbidden
- Must not import from `caracalEnterprise/`.
- Must not write credentials, tokens, or refresh tokens to disk outside the `caracal init` flow.
- Must not depend on a Bun runtime at execution time; child-process spawning must use `node:child_process`.
- Must not add commands beyond `up`, `down`, `status`, `init`, `run`, `credential read`, and MCP governance.

