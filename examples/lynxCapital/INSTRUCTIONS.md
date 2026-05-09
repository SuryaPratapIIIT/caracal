# Lynx Capital Demo - Build Instructions

This file is the single source of truth for how the
`examples/lynxCapital` demo is built. It must be read and followed
before writing or modifying any code in this directory. These rules
override personal preferences.

The demo simulates a real internal system at a fictional firm called
**Lynx Capital**, an autonomous financial execution layer for global
companies. It must look and behave like a production application, not
a tutorial.

---

## 1. Codebase Rules

- Lynx Capital is a real product simulation, not a demo-first system.
- All company-specific values, labels, copy, providers, regions, and
  scenario content live in `config/company.yaml`. Templates and Python
  code read those values at request time. No hard-coded product
  names, taglines, route copy, or scenario text inside templates or
  Python code.
- The base app uses the term **agent** in the normal product sense.
  Prefer `agent`, `role`, `task`, `scope`, `policy`.
- Naming: short, clear, CamelCase by default. Snake_case only where
  the language requires it (Python module files, Python identifiers).
- No `new_`, `old_`, `fixed_`, `updated_`, `final_` prefixes anywhere.
- Reuse and correct existing variables instead of introducing new ones.
- No legacy paths, fallback shims, dead code, commented-out blocks,
  feature-flagged duplicate flows. Single execution path per feature.
- Use the LangChain ecosystem only: LangChain, LangGraph, DeepAgents.
  No custom orchestration frameworks, no Temporal, no Celery, no
  message brokers.
- No emojis. No em dashes. No marketing copy. No filler comments.

## 2. Single Execution Mode

There is exactly one execution path. There are no `mock`, `real`,
`enforced`, or `bypass` modes. There is no `mode` query parameter, no
`mode` request body field, no environment toggle that switches
behavior at runtime.

Concretely:

- **OpenAI is always on.** Every LLM call uses
  `langchain_openai.ChatOpenAI` configured from `config.llm`. There is
  no fallback model, no alternate provider routing, no auto-retry
  across providers. If `OPENAI_API_KEY` is missing, the app fails to
  start with a clear error.
- **External providers are always mocked.** All external API
  responses (banking, ERP, OCR, compliance, vendor portal, tax,
  FX, **and payment execution**) come from the deterministic
  case-based mock layer under `_mock/`. The mock layer is the only
  network boundary. Payment execution looks and behaves like a real
  payment path - it goes through the same ticket lifecycle and
  produces realistic case-based provider responses - but no real
  money or real network is ever touched.

The implication is that no code branches on a "mode" anywhere. The
mock service boundary is not a switch; it is the boundary.

## 3. Architecture Rules

- **Single runtime.** The UI is served by the same uvicorn process
  that serves the JSON API. There is no separate frontend
  application, no second build system, no second language. Pages are
  rendered server-side from Jinja2 templates with progressive
  enhancement via plain JavaScript modules and SSE for streaming.
- Strict separation between real app code and the `_mock` directory.
- Mock services are named like real third-party providers with a
  `.mock` suffix on the directory (for example `stripe-treasury.mock`,
  `wise-payouts.mock`, `mercury-bank.mock`, `netsuite.mock`,
  `sap-erp.mock`, `quickbooks.mock`, `compliance-nexus.mock`,
  `ocr-vision.mock`, `vendor-portal.mock`, `tax-rules.mock`,
  `fx-rates.mock`). They live only inside `_mock/` and are wired in
  through a single boundary module.
- Mock responses must be **deterministic** and **case-based**. A
  request matches one of a set of named cases by primary key (vendor,
  invoice id, amount band, region, etc.) with a `default` fallback
  per action. Same inputs always produce the same outputs.
- The mock layer must be scalable: adding a new provider, region,
  case, or scenario response requires only a new file under
  `_mock/<id>.mock/` and a registry entry, never edits to agent code.
- Backend and UI: Python 3.11+ with FastAPI, uvicorn, Jinja2,
  sse-starlette, LangChain, LangGraph, DeepAgents.
- No `npm`, no `node_modules`, no Vite, no React, no bundler.

## 4. Scenario Scope

The demo executes a single realistic enterprise request:

> A global SaaS customer needs Lynx Capital to process its weekly
> payout cycle: 4,200 invoices across 5 regions (US, IN, DE, SG, BR),
> totaling ~$8.5M USD-equivalent across multiple currencies and rails,
> with constraints on fees, regional tax compliance, vendor contract
> terms, and threshold-based validation.

The system decomposes this request into a layered agent swarm:

1. **Finance Control Agent** (1) - receives request, builds graph.
2. **Regional Orchestrators** (5) - region-scoped authority.
3. **Invoice Intake Agents** (6 per region = 30) - read-only document scope.
4. **Ledger Match Agents** (4 per region = 20) - reconcile vs ERP.
5. **Policy Check Agents** (5 per region = 25) - validate; cannot execute.
6. **Route Optimization Agents** (3 per region = 15) - plan routes; advisory.
7. **Payment Execution Agents** (~3,600 ephemeral) - one transaction
   each, narrowly scoped: one vendor, one amount, one rail, one time
   window.
8. **Audit Agents** (2 per region = 10) - record full delegation lineage.
9. **Exception Agents** (~400) - investigative only, cannot execute.

Total swarm at peak: ~4,000+ agents.

For demo runtime feasibility, the swarm is **simulated faithfully**:
the topology, scope partitioning, and execution decisions are all
real and traceable per agent, but a configurable cap limits how many
agents are actually instantiated as LLM-backed LangGraph nodes per
layer. The cap is set in `config/company.yaml` under
`swarm.llmBackedCap`. Beyond the cap, agents execute through a
deterministic fast path that still records full lifecycle events.
This is the only concession; nothing else is shortened or faked.

## 5. Worker Lifecycle Rules

Every agent spawned by the system has an explicit, observable
lifecycle with four mandatory phases. Each phase emits a typed event
on the run channel and shows up in the graph view, the chat stream,
and the logs route.

1. **Spawn** - parent declares a child with `(role, scope, parent)`.
   Emits `agent_spawn` and `delegation` events.
2. **Execute** - the agent runs, calls tools, may spawn its own
   children. Emits `agent_start`, `tool_call`, `service_call`, and
   `agent_end` events.
3. **Delegate** (optional) - if the agent fans out work to children,
   each child goes through its own full lifecycle and the parent
   waits for them.
4. **Terminate** - the agent releases all resources, cancels any
   outstanding tasks it owns, and emits `agent_terminate` with a
   final status (`completed`, `failed`, `cancelled`). No agent may
   remain alive past its parent's `agent_end` unless it is an
   explicitly long-lived audit agent that terminates with the run.

Lifecycle invariants the implementation must guarantee:

- For every `agent_spawn` there is exactly one matching
  `agent_terminate` with the same agent id.
- Ephemeral agents (Payment Execution, Exception) terminate
  immediately after their single action; their `agent_terminate`
  fires before the next event of any sibling.
- A `run_end` is emitted only after every spawned agent has
  terminated.
- Cancellation propagates: when a parent cancels, all its descendants
  receive `agent_terminate` with status `cancelled` before the
  parent's own `agent_terminate`.

## 6. UI/UX Rules

- The UI is server-rendered by the uvicorn app from Jinja2 templates
  under `app/web/templates/` with static assets under
  `app/web/static/`. Live updates use SSE from the same FastAPI app.
- Light theme. Primary is a deep capital blue (`#0B3D91`) with an
  accent (`#1E5BD8`) and neutral surfaces. All colors as CSS
  variables in `app/web/static/theme.css`, populated from
  `config/company.yaml`.
- Sharp edges: border radius no greater than `4px`.
- Compact, fit-width layouts. Pages must not require long scroll.
  Each route fits a single viewport on a 1440x900 display where
  possible. Where content is naturally long (logs, swarm tree), use
  an internal scroll region with a fixed page frame.
- Multi-route navigation. Routes:
  - `GET /`         Landing (scenario summary, disclaimer, Continue).
  - `GET /setup`    Environment-variable validation.
  - `GET /demo`     The single demo run page (chat + graph).
  - `GET /logs`     Color-coded runtime activity log.
- Short, direct copy. No long paragraphs. Headings use sentence case.
- No emojis, no decorative icons unless functional. One icon set only
  (inline SVG sprites under `app/web/static/icons.svg`).
- Persistent top nav: company name on left, route links on right.
- The `/demo` view shows, side by side: a chatbot stream (prompt ->
  tool -> result) and a live graph view (orchestration topology with
  node-state highlighting and lifecycle states as the swarm
  executes).
- The graph view must clearly express **grouping** and **fan-out**:
  - Layer groups (Finance Control, Regional Orchestrators, Intake,
    Ledger, Policy, Route, Payment, Audit, Exception) are rendered
    as labeled containers.
  - Region groups inside each layer are sub-containers, so the
    five-way regional fan-out is visually obvious.
  - Parent->children fan-out edges are drawn as bundled connectors
    that visually splay out at the child group; the bundle thickness
    reflects the number of children.
  - Per-node lifecycle state is shown as a small status pill
    (`spawned`, `running`, `completed`, `failed`, `cancelled`) with
    the color tokens defined in `theme.css`.
- The `/logs` view is a single scrollable column of timestamped log
  lines, one per event. Each line is **color-coded by category**:
  - `service` (external provider mock call, request/response) -
    teal family.
  - `agent` (spawn, start, end, terminate) - neutral with a status
    accent (running=blue, completed=green, cancelled=grey,
    failed=danger).
  - `audit` (audit-agent records) - amber family.
  - `system` (run start/end, errors, lifecycle invariants) - the
    default text color, with `error` lines in danger.
  Categories are filterable via toggle chips at the top of the page.

## 7. Setup and Flow Rules

- The `/setup` page presents a minimal validation panel that confirms
  `OPENAI_API_KEY` is present in the environment.
- After the user clicks Validate, the `/setup` endpoint inspects the
  environment and reports per-step pass/fail with a clear reason.
  Failed steps block progression to `/demo` until they pass on a
  re-check.

## 8. Security and Correctness

- Lifecycle correctness as defined in Section 5. Every spawned agent
  must be cleanly terminated; no dangling background tasks.
- Inputs from the UI are validated at the FastAPI boundary.
- No secrets in source. `OPENAI_API_KEY` is read from environment
  variables only.

## 9. General Discipline

- No temporary code, TODO stubs, or placeholders left in committed
  code.
- No abstractions or helpers introduced for a single use site.
- No unused exports, configs, dependencies, or files.
- Match the surrounding code's level of abstraction exactly.
- If a piece of code cannot be justified by a current concrete need,
  it does not ship.

## 10. Directory Layout

```
examples/lynxCapital/
  INSTRUCTIONS.md          this file (rules)
  pyproject.toml           single Python project for the whole demo
  config/
    company.yaml           company-wide values, regions, providers,
                           agent layers, swarm caps, theme, copy
  app/
    main.py                FastAPI entry, mounts API and web routers
    config.py              loads config/company.yaml
    api/                   JSON endpoints (system, run, setup,
                           logs)
    core/                  domain types and synthetic dataset
    agents/                role definitions, tools, runner, lifecycle
    orchestration/         LangGraph wiring + swarm spawner + topology
    services/              external service boundary (only importer
                           of the _mock layer)
    events/                in-process event bus + SSE channels +
                           categorized log stream
    web/                   server-rendered UI
      router.py            HTML routes
      templates/           Jinja2 templates: layout, landing, setup,
                           demo, logs, partials/*
      static/              theme.css, app.js, chat.js, graph.js,
                           logs.js, icons.svg
  _mock/
    registry.yaml          maps service id -> mock module
    <service>.mock/        per-service folder: cases.json, fixtures/,
                           and any connector code needed to shape
                           realistic provider responses
```

The boundary between the real app and `_mock` is
`app/services/registry.py`. Service clients dispatch to the mock
layer for every external call. All mock connector code, fixtures,
and case data live under `_mock/`; nothing mock-shaped lives under
`app/`.
