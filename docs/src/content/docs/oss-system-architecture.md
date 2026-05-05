---
title: OSS System Architecture
description: Deep runtime explanation of the Caracal open-source architecture.
---

# Caracal OSS System Architecture

This document explains the Caracal open-source system as implemented under `caracal/`. It focuses on what the system means at runtime: the concepts it models, the way requests move, how authorization is decided, how tokens are minted, how agents are coordinated, and how state changes propagate.

Caracal is a pre-execution authority system. Its central idea is that an application, agent, CLI command, gateway, or tool server should not act just because it has ambient credentials. It should first obtain a short-lived, resource-scoped authorization token from STS, and STS should only issue that token after evaluating the active policy for the zone and resource.

The system is built around four runtime loops:

1. The management API creates and changes durable authority state: zones, applications, resources, providers, policies, policy sets, grants, challenges, and sessions.
2. STS turns an authenticated token-exchange request into either a denial, a step-up challenge, or a short-lived resource-scoped JWT.
3. Gateway and SDK integrations use STS-issued tokens before calling downstream systems such as MCP tool servers.
4. Redis Streams carry authorization, revocation, policy, audit, and agent lifecycle signals between services.

## Core Concepts

### STS

STS is the Security Token Service. It is the runtime authority engine and token issuer.

It exists because Caracal separates possession of a credential from permission to perform a specific action. A caller may have an application credential, a subject token, or an agent session, but that is not enough to call a protected resource. The caller asks STS for an access token targeted at one or more resource identifiers. STS evaluates the request under the zone's active OPA policy bundle, records an audit event, creates a session, and signs a JWT only for the resources that were allowed.

STS solves the problem of pre-execution authorization. Instead of protecting a tool or API only at the final endpoint, it centralizes the decision before a credential is handed to the caller. The downstream resource can then validate a compact JWT rather than reimplementing Caracal's full policy system.

At runtime STS listens on port 8080 and exposes token exchange, JWKS, step-up status, health, and readiness endpoints. On startup it opens Postgres and Redis connections, loads a zone key-encryption key, prepares a per-zone OPA engine, starts audit flushing, starts Redis consumers for policy invalidation and session revocation, and starts a polling loop that reloads active policy bundles from Postgres every 60 seconds for zones already known to the OPA engine.

The important behavior is that STS is both synchronous and asynchronous. Token exchange is synchronous: every request is evaluated immediately. Audit emission is asynchronous through a non-blocking buffer into Redis. Policy updates and revocations arrive asynchronously through Redis Streams and are reflected in STS's local state.

### API

The API is the management plane. It is a Fastify service that owns administrative CRUD for the objects STS and the rest of the runtime consume.

It exists because runtime authorization depends on durable configuration: zones need to exist, applications need identities, resources need identifiers, policies need versions, grants need state, and policy sets need active bindings. The API is the place where that state is created and changed. It is not the hot-path policy evaluator; it prepares the state that STS later consumes.

The API solves the problem of authority administration. Without it, policy and identity state would have to be edited directly in Postgres. The API validates inputs with Zod, writes controlled rows into Postgres, and publishes Redis events when a management operation must affect runtime behavior.

At runtime the API listens on port 3000. All `/v1/` routes require a bearer admin token. It creates zones, applications, resources, providers, grants, Rego policy versions, policy set versions, and active policy set bindings. When a policy set version is activated, the API publishes `caracal.policy.invalidate` so STS reloads the zone. When a delegated grant is revoked, the API revokes matching active sessions in Postgres and publishes `caracal.sessions.revoke` messages.

### Gateway

Gateway is the request-time reverse proxy for protected upstream systems, especially MCP-style tool endpoints.

It exists because some clients should not call STS directly for every tool invocation, or because an organization wants a single enforcement hop in front of a downstream service. Gateway receives a request with a subject bearer token and Caracal routing headers, exchanges that subject token with STS for a resource-scoped token and approved upstream, strips the Caracal routing headers, and forwards the request to that upstream with the new bearer token.

Gateway solves the problem of converting a broad incoming identity into a narrow per-resource token at the edge of execution. It also ensures a fresh STS exchange is performed on every proxied request; the gateway code does not cache exchanged tokens.

At runtime Gateway listens on port 8081. For every proxied request it requires `Authorization: Bearer ...`, `X-Caracal-Client-ID`, and `X-Caracal-Resource`. It decodes the incoming JWT expiration without verifying the signature only to reject tokens that are within a 35-second preflight window, calls STS `/oauth/2/token`, receives the approved upstream from the granted resource metadata, and streams the request to that upstream. Final cryptographic validation of the STS-issued token is still the responsibility of the upstream resource or middleware.

### Agent Coordinator

Agent Coordinator is the service that records and controls agent runtime sessions.

It exists because agent systems are not just flat clients. Agents can spawn child agents, become inactive, resume, terminate, and form a bounded hierarchy. Caracal models those agent lifecycles explicitly so authority can be attached to a session and revoked when an agent exits.

It solves the problem of containing agent growth and tying agent lifetime to token/session lifetime. The coordinator enforces hard limits of depth <= 10, children <= 10, and active agents <= 50 per zone. It also cascades termination across descendants and publishes session revocation events for terminated agents.

At runtime the Node coordinator listens on port 4000 and protects all routes by verifying a bearer JWT against STS JWKS. It stores agent rows in `agent_sessions` and parent-child edges in `agent_topology`. It publishes lifecycle events to `caracal.agents.lifecycle` and session revocation events to `caracal.sessions.revoke`. A TTL sweeper runs every 60 seconds and terminates active agent sessions whose configured TTL has expired. A Go relay consumes lifecycle events from Redis and logs them in order.

### Audit System

The audit system is the durable record of authorization decisions.

It exists because token issuance and denial are security events. Caracal needs a record of what STS decided, when it decided, which zone was involved, which request ID was used, what the decision was, and what policy diagnostics were returned.

It solves the problem of making authorization observable without slowing the token-exchange hot path. STS writes audit events into an in-memory buffer, flushes them to Redis Stream `caracal.audit.events`, and the audit service consumes that stream into Postgres. The audit service only acknowledges a stream message after a successful Postgres insert.

At runtime the audit service exposes health and metrics on port 9090. It consumes as `audit-ingestor`, writes append-only `audit_events` rows, computes a content hash for tamper detection, exports Parquet batches when configured, and periodically recomputes event hashes over recent rows to detect stored-content mismatches.

### SDK Layer

The SDK layer is the integration surface for clients and protected resources.

It exists so applications, agents, tool servers, Cloudflare Workers, FastMCP servers, Express servers, Go HTTP servers, and Python middleware can participate in Caracal without each reimplementing token exchange and JWT validation.

It solves two related problems. Client-side SDKs know how to ask STS for resource-scoped tokens. Resource-side middleware knows how to validate STS-issued JWTs, check issuer/audience/scope where supported, and reject missing or invalid tokens.

At runtime the OAuth SDK posts RFC 8693 token-exchange form data to STS and caches successful responses by subject token, resource, normalized scope set, and exact TTL until they approach expiration. The agent SDK wraps that exchange in an `AgentRuntime` and provides an A2A call helper that exchanges subject authority through STS before calling another agent. MCP middleware validates bearer tokens at tool boundaries using STS JWKS.

## Fundamental Entities

### Zone

A zone is the primary isolation boundary. It represents a tenant-like authority domain containing applications, resources, providers, policies, grants, sessions, agents, teams, invitations, and challenges.

Zones are used almost everywhere. Management routes are scoped by `zoneId`; resources are unique by `(zone_id, identifier)`; policies and policy sets belong to a zone; STS authenticates `client_id` values in `{zone_id}:{app_id}` form; the OPA engine stores one compiled active policy state per zone; JWT signing keys are loaded by zone.

A zone flows through the system as the partition key for authority. The API writes zone-scoped rows. STS extracts the zone from the client ID, uses that zone to load the application, resource, active policy set, subject-token verification key, and signing key, and then stamps the session and audit event with the same zone. Redis events carry `zone_id` so consumers can reload or revoke only the affected zone state.

### Application

An application is a client identity inside a zone. It can be managed or dynamically registered. It has a credential type, optional client secret hash, traits, consent mode, expiration metadata, and last-active state.

Applications are used by STS as the principal of a token-exchange request. During `authenticateApp`, STS expects `client_id` to identify both zone and application. It loads the application and verifies the client secret when the app has a stored hash; public apps can authenticate without a client secret.

An application flows into OPA input as `principal.type = "Application"`, `principal.id = app.ID`, `principal.zone_id = zoneID`, and `principal.credential_type`. It also becomes `client_id` in the JWT claims and `sub` for application sessions as currently issued by STS.

### Resource

A resource is a protected target. It has a stable identifier, a zone, optional prefix behavior in the data model, scopes, and optionally a credential provider binding.

Resources are used by STS as the unit of authorization. The token-exchange request must include at least one `resource` value. STS resolves each requested resource identifier inside the caller's zone. Unknown resources are soft-denied for that slot. Each known resource becomes the `input.resource` object for OPA.

A resource flows from API creation into policy evaluation and then into tokens. If OPA allows it, its identifier is added to the JWT audience and to the Caracal `target` claim. Resource-side middleware uses that audience value to decide whether the token was minted for the protected service.

### Provider

A provider represents an external credential or identity provider attached to a zone. Its metadata includes an identifier, kind stored in `config_json`, owner type, optional client ID, and provider-specific configuration.

Providers are used in two places. The API manages provider records. STS uses providers when a resource has `credential_provider_id`: it looks for an active delegated grant for the subject and resource, and if the stored grant credential is expired, it loads provider config and attempts an OAuth refresh against the provider token endpoint.

A provider flows indirectly through resources and grants. A resource points at a provider; a grant may store provider-backed encrypted access and refresh tokens; STS refreshes those tokens before issuing a Caracal resource token. The Caracal token is still what downstream services see, while provider credentials are maintained behind the boundary.

### Policy

A policy is a named, zone-scoped Rego program with immutable versions. The policy object carries metadata; each `policy_versions` row carries the actual Rego source, a monotonically increasing version number per policy, a content SHA-256, a schema version, creator metadata, and creation time.

Policies are used by policy sets. STS does not load "latest policy" by name. It loads the active policy set version, reads its manifest, then loads the exact policy version IDs referenced by that manifest.

A policy flows from authoring to runtime through version pinning. Creating or adding a policy version only creates immutable content. It does not affect STS until a policy set version references it and that policy set version is activated for the zone.

### Policy Set

A policy set is the activation unit for policies. It groups one or more immutable policy versions into a manifest, versions that manifest, and binds an active version to a zone.

Policy sets are used to make runtime policy updates atomic. Instead of STS evaluating a mix of updated and older policies, the API creates a new policy set version with a manifest SHA and then updates `policy_set_bindings.active_version_id` to point to that version.

A policy set flows into STS through the active binding. STS reads the active binding for the zone, loads the policy set version manifest, loads the referenced Rego modules, compiles them into one prepared OPA query, and keeps that compiled query cached under the zone until the manifest SHA changes or a reload is forced.

### Grant

A grant is a delegated authorization record for a user, application, resource, provider, and scope set. In the schema it can also hold encrypted provider access and refresh tokens, expiration time, refresh time, status, and refresh-token version for optimistic concurrency.

Grants are used to represent delegated access that has been consented or provisioned before execution. The API can create active grants and revoke them. STS can read an active grant for `(zone_id, user_id, resource_id)` when the target resource is bound to a credential provider, and can refresh provider tokens when they have expired.

A grant flows differently from a policy. A policy answers "may this application exchange for this resource under these claims and scopes?" A grant answers "does this user/resource delegation and brokered credential state exist, and can the provider credential be refreshed?" Both can be necessary. Policy controls authorization. Grant state controls delegated credential availability and revocation.

### Session

A session is a durable record whose ID is the JWT `sid` claim. Sessions may be user or application sessions, have a zone, optional subject, optional parent, status, expiration, authentication time, and optional claims.

Sessions are used by STS and revocation flows. After STS allows at least one resource, it creates a user or application session with the token expiration and uses that ID as `sid` in the JWT. The API and coordinator can publish session revocation events; STS consumes those events and marks sessions revoked in Postgres.

A session flows from token issuance into auditability and lifecycle control. The token is stateless and carries the `sid`; the database row records the same ID and status. Services that only validate JWT cryptography use the token's signature and expiration. Services that need revocation awareness must consult session state or force a fresh STS exchange through a path that has access to session state.

### Agent

An agent is a runtime session entry in `agent_sessions`. It belongs to a zone and application, has an associated STS session SID, optional parent, status, depth, capabilities, child count, TTL, and metadata.

Agents are used by the Agent Coordinator to bound autonomous execution. The coordinator records spawn, suspend, resume, and termination state and publishes lifecycle events so other components can react.

An agent flows through the system as both a hierarchy node and a revocation source. Spawning creates the node and optional topology edge. Suspending and resuming change status. Terminating an agent recursively terminates descendants, publishes lifecycle events, and publishes session revocation messages for each affected `session_sid`.

## Authorization Model

### OPA/Rego Evaluation Flow

Caracal's authorization decision happens inside STS. The active policy language is Rego evaluated by OPA.

The runtime input shape is stable:

```json
{
  "principal": {
    "type": "Application",
    "id": "application-id",
    "zone_id": "zone-id",
    "credential_type": "public"
  },
  "resource": {
    "type": "Resource",
    "id": "resource-id",
    "identifier": "resource-identifier"
  },
  "action": {
    "id": "TokenExchange"
  },
  "context": {
    "actor_claims": { "client_id": "application-id" },
    "subject_claims": {},
    "requested_scopes": ["scope:a", "scope:b"]
  }
}
```

STS asks OPA for `data.caracal.authz.result`. The policy bundle is expected to return an object compatible with:

```json
{
  "decision": "allow",
  "evaluation_status": "complete",
  "determining_policies": [],
  "diagnostics": []
}
```

The decision contract is intentionally small. `decision` is what STS enforces. `evaluation_status` tells STS whether the result was complete. `determining_policies` and `diagnostics` are audit and control metadata. A diagnostic entry with `step_up_required` asks STS to create a step-up challenge instead of immediately completing the exchange.

STS evaluates once per requested resource. This matters: a multi-resource exchange can allow one resource and deny another. STS collects only the allowed resource identifiers into the issued JWT. If no resource is allowed, the whole exchange is denied.

### How Decisions Are Made

The decision path is:

1. Authenticate the application using the zone/application ID embedded in `client_id` and any required client secret.
2. Validate the optional subject token using the zone public key, expected issuer, zone claim, and active session state.
3. Resolve each requested resource inside the same zone.
4. If a resource has a provider binding, attempt delegated grant refresh for the subject and resource.
5. Apply the Redis fixed-window rate limit for `(zone, resource, actor)`.
6. Build OPA input for that principal, resource, action, and context.
7. Evaluate `data.caracal.authz.result` from the zone's active policy bundle.
8. Emit an audit event for the result.
9. Treat `evaluation_status = "partial"` as a hard failure.
10. Create a step-up challenge if diagnostics require it and no challenge response was already satisfied.
11. Add the resource to the JWT target list only if `decision = "allow"`.
12. Deny if the target list is empty; otherwise create a session and issue a JWT.

The enforcement point is STS for token issuance. Resource servers still enforce token validity by verifying the JWT's signature, issuer, audience, and scopes. Gateway enforces the rule that every proxied request must go through STS token exchange first, but Gateway is not the policy engine; STS is.

### Deny-All Fallback

Deny-all fallback means a zone with no active policy set binding, or no active policy set version, does not become permissive. STS installs an in-memory fallback Rego module for that zone:

```text
package caracal.authz
result := {"decision": "deny", "evaluation_status": "complete", "determining_policies": [], "diagnostics": []}
```

The practical effect is that authorization requires explicit activation. Creating applications and resources is not enough. Creating policies is not enough. Creating a policy set version is not enough. Until a policy set version is active for the zone, STS can authenticate the caller and resolve resources, but policy evaluation returns deny.

### Delegation Model

Delegation in Caracal is split into authority and credential availability.

Authority is represented by policy. Policy decides whether an application acting with a set of subject claims may exchange for a resource and scopes. It is evaluated for every exchange.

Credential availability is represented by grants and provider binding. A grant records that a user has delegated access to a resource and scopes. If the resource is backed by an external provider, the grant can hold encrypted provider tokens and refresh metadata. STS checks and refreshes this provider credential before issuing the Caracal token.

This split is important. A valid grant does not bypass policy. A policy allow does not create provider credentials out of thin air. The current runtime path requires policy to allow issuance, and provider-backed resources can also require a usable grant state for the subject/resource pair.

### Policy vs Grant Relationship

Policy is declarative authorization logic. Grant is delegated state.

Policy versions are immutable Rego source. They are selected through policy set manifests and evaluated in OPA. Policy can use principal, resource, action, subject claims, actor claims, and requested scopes to make decisions. It can also request step-up through diagnostics.

Grants are database records. They say that a user/application/resource/scope relationship exists, whether it is active or revoked, and whether encrypted provider credentials are available and refreshable. Grant revocation changes session state and emits revocation messages.

The relationship is therefore conjunctive in spirit: policy says whether the exchange is authorized; grants support delegated credential continuity and revocation. They are not substitutes for one another.

### Zone Isolation Model

Zone isolation is enforced by data access shape and runtime lookup rules.

The API scopes management routes by zone ID. STS parses `client_id` into `zone_id` and `app_id`, then loads the application only where both match. Resources are resolved by `zone_id` and identifier. OPA state is cached per zone. Policy set bindings are keyed by zone. Redis policy invalidation messages carry zone ID. JWT signing keys are loaded by zone. Audit events, sessions, grants, challenges, and agents all carry zone ID.

Cross-zone access is not modeled as a normal flow in the OSS implementation. A request authenticated as an application in one zone resolves resources and policies in that same zone. To interact across application boundaries inside a zone, applications use subject tokens, resource identifiers, grants, and policies. To cross zones, a separate zone/application identity and policy context would be needed.

## Token and Identity Flow

### Token Issuance

Token issuance starts at `POST /oauth/2/token`. The request is form-encoded and uses the RFC 8693 token-exchange grant type. STS accepts a client ID, optional client secret, optional subject token, one or more resource values, scopes, and optional step-up challenge response.

STS first authenticates the application. The implemented client ID format is `{zone_id}:{app_id}`. STS loads the application by both values. If the application has a client secret hash, STS hashes the submitted client secret with SHA-256 and compares it with constant-time comparison. If the application has no secret hash, it must have credential type `public`.

Only after application authentication does STS evaluate resources and policies. Successful issuance creates a session row and signs a JWT with the zone signing key. The signing key is loaded from a secret named `zone_signing_key`, decrypted with ChaCha20-Poly1305 through the configured zone encryption key material, cached in memory for 15 minutes, and published through JWKS as an ES256 public key.

### What STS Validates

STS validates:

- Request form syntax.
- Application identity and client secret/public credential type.
- Presence of at least one requested resource.
- Optional subject token signature using ES256 and the zone public key.
- Optional step-up challenge satisfaction and expiration.
- Resource existence inside the same zone.
- Provider-backed grant refreshability when applicable.
- Fixed-window Redis rate limit per zone/resource/actor.
- OPA policy result for each resource.

STS denies partial OPA evaluation. It denies a completed exchange if no resources are allowed. It returns `interaction_required` when policy diagnostics request step-up and no satisfied challenge has been supplied.

### JWT Structure and Meaning

STS-issued access tokens are ES256 JWTs. They contain standard registered claims and Caracal-specific claims.

The registered claims include:

- `iss`: STS issuer URL from configuration.
- `sub`: the subject ID used by the issuer. In the current application-token path this is the application ID.
- `aud`: the list of granted resource identifiers.
- `exp`: expiration time.
- `iat`: issue time.
- `jti`: UUIDv7 token ID.

The Caracal claims include:

- `zone_id`: the zone that owns the exchange and signing key.
- `client_id`: the application ID that exchanged the token.
- `scope`: the requested scope string.
- `sid`: the session ID created in Postgres.
- `target`: the same granted resource identifiers carried in audience form.
- `on_behalf`: defined in the claim struct but not populated in the current issue path.

The meaning of the token is narrow: this application, in this zone, received a short-lived bearer token for these target resources after STS evaluated the active policy bundle. Middleware rejects tokens that do not carry a zone claim, and integrations with an expected zone reject mismatched tokens.

### Subject Token vs Access Token

A subject token is the token submitted to STS as input. It represents the identity or authority context on whose behalf the exchange is being requested. Gateway sends the inbound bearer token as `subject_token`. SDK clients also send a subject token in token-exchange form data.

An access token is the output from STS. It is the resource-scoped JWT that downstream resources should validate and enforce. It carries the `aud` and `target` values that identify where it can be used.

The subject token feeds `context.subject_claims` in OPA. The access token is the artifact produced after policy has allowed at least one resource. This is the core exchange: broad or prior authority goes in; narrow, resource-scoped authority comes out.

### Resource-Scoped Tokens

Resource scoping is implemented through both the request and the JWT. The caller requests one or more resource identifiers. STS evaluates each resource independently. Only resources with `decision = "allow"` appear in the output token.

Downstream middleware uses the JWT audience to ensure a token minted for one resource is not accepted by another. Required scopes can also be enforced by middleware that checks the `scope` claim.

### Session Creation and Lifecycle

STS creates a user or application session after successful policy evaluation and before token signing. The session ID becomes the JWT `sid`. Subject-token exchanges are capped at the per-call token TTL, while ambient application exchanges may use the longer ambient TTL.

Sessions can be revoked through management and agent flows. Grant revocation updates matching sessions to `revoked` and publishes revocation events. Agent termination publishes revocation events for the agent's `session_sid`. STS consumes `caracal.sessions.revoke` and updates the session row.

The distinction to keep in mind is that JWT validation can be stateless while session state is stored in Postgres. Middleware that only validates JWT signature and expiration does not automatically consult session status. Gateway's no-cache exchange model encourages fresh STS involvement for proxied calls, while direct resource middleware is responsible for whatever session-state checks it needs beyond JWT validation.

## Request Execution Model

### Direct STS Execution

1. Client prepares an exchange request with `client_id`, optional `client_secret`, optional `subject_token`, requested `resource`, and optional `scope`.
2. STS authenticates the application.
3. STS validates the subject token if supplied.
4. STS checks challenge response if supplied.
5. STS resolves resources in the application's zone.
6. STS evaluates OPA for each resource.
7. STS emits audit events.
8. STS returns step-up, denial, or a resource-scoped access token.
9. Client calls the protected resource with `Authorization: Bearer <access_token>`.
10. The protected resource validates signature, issuer, audience, and scopes.

### Gateway Execution

1. Client sends a request to Gateway with an inbound bearer token and Caracal headers identifying client ID, resource, and upstream URL.
2. Gateway rejects missing bearer tokens and tokens expiring inside the preflight window.
3. Gateway calls STS token exchange using the inbound bearer as subject token.
4. STS evaluates policy and returns a resource-scoped token or an error.
5. Gateway forwards the request to the upstream with the STS-issued bearer token.
6. Gateway strips Caracal routing headers before forwarding.
7. The upstream validates the token and enforces audience/scope.

The token exchange happens at Gateway before the upstream receives the request. The final authorization decision happens in STS; final token enforcement happens at the upstream boundary.

### Where Decisions Are Enforced

STS enforces policy by deciding whether to mint an access token. It denies the exchange on invalid application credentials, invalid subject token, missing resources, unavailable OPA evaluation, partial OPA results, empty allow set, and unsatisfied step-up.

Gateway enforces use of STS on every proxied request. It does not cache tokens and does not evaluate Rego itself.

MCP and resource middleware enforce the token produced by STS. They validate JWTs and required scopes. This is where the token's audience and scope become concrete access checks at execution time.

### Where Tokens Are Exchanged

Tokens are exchanged in STS only. The API manages state but does not mint access tokens. Gateway calls STS for every proxied request. The OAuth SDK calls STS directly and may cache responses inside the process. The CLI calls the OAuth SDK. The agent runtime calls the OAuth SDK to get tool tokens.

## Agent System

### Creation and Registration

Agents are registered by calling the coordinator route `POST /zones/:zoneId/agents` with an application ID, an STS session SID, optional parent ID, capabilities, and TTL. The coordinator validates the request, enforces limits, inserts an `agent_sessions` row, inserts an `agent_topology` edge for child agents, increments the parent's child count, and publishes a `spawn` lifecycle event.

The coordinator does not spawn operating-system processes by itself. It records and controls agent session state. Actual agent code integrates through the SDK and uses its configured subject token and client ID to call STS and other agents.

### Lifecycle: Spawn, Suspend, Resume, Terminate

Spawn creates an active row, sets depth, attaches capabilities, and records the session SID.

Suspend changes an active agent to `suspended` and publishes `suspend`.

Resume changes a suspended agent back to `active`, updates `last_active_at`, and publishes `resume`.

Terminate is recursive. The coordinator builds a descendant tree, marks every node as `terminated`, sets `terminated_at`, publishes session revocation for each node's `session_sid`, and publishes `terminate` lifecycle events. The TTL sweeper also terminates expired active agents and publishes the same revocation/lifecycle signals.

### Agent Hierarchy

Agents form a tree through `parent_id` and `agent_topology`. The root has depth 0. A child has parent depth + 1. The coordinator rejects a child if the parent is missing, inactive, already at its child limit, or if the resulting depth would exceed 10.

This hierarchy is not just informational. It defines the blast radius of termination. Terminating a parent terminates descendants and revokes their sessions.

### Agent Sessions

An agent session links agent lifecycle to token/session lifecycle through `session_sid`. The coordinator does not mint the STS session; it stores the SID it is given. On termination, that SID becomes a revocation event. STS consumes the revocation stream and marks the session revoked.

### Agent Communication and Action

The agent SDK models communication with a simple A2A helper. An agent call first exchanges the configured subject token through STS for the target agent resource, then posts to the target agent's `/a2a` endpoint with JSON method/params/request ID, the exchanged resource token in `Authorization`, and `X-Caracal-Client-ID` set to the caller's client ID.

For tool access, `AgentRuntime.getToolToken(resource, scopes)` exchanges the configured subject token through STS using the agent's client ID. That gives the agent a resource-scoped token for the tool. The receiving tool then validates the JWT through MCP middleware.

## Delegation, Grants, and Zones

### Delegation in Practice

Delegation is the ability to carry a subject's authority into a controlled resource access. In Caracal, that delegation is not a single flag. It is composed from:

- The subject token submitted to STS.
- The subject claims made available to Rego.
- The active policy that decides whether this principal may exchange for this resource.
- The grant state that can represent user/resource/scope delegation and provider credentials.
- The issued resource-scoped JWT.

The result is a chain: subject authority enters STS, policy constrains it, provider grant state may refresh backing credentials, and a narrower Caracal access token exits STS.

### How Grants Are Created and Enforced

The API creates grants under a zone with application ID, user ID, resource ID, and scopes. The grant starts active. The API revokes a grant by marking it revoked, revoking active sessions for the affected user in that zone, and publishing session revocation events.

STS enforces grant relevance only in the provider-backed resource path. If a resource has a credential provider ID, STS looks for an active grant for the subject user and resource. If the grant's provider token is expired and refreshable, STS refreshes it and updates encrypted token state with optimistic concurrency. If no grant exists, the current code continues without treating that absence as an error; policy still controls token issuance.

### Zone Isolation and Cross-Application Interaction

Applications in the same zone interact by exchanging tokens for resources in that zone. Policy can distinguish applications by principal ID, credential type, subject claims, requested scopes, and resource identifiers.

Cross-application does not mean cross-zone. An application can request a token for a resource that another application or tool server represents, but the lookup and policy evaluation still occur inside the caller's zone. The access boundary is the zone's active policy and the target resource's audience validation.

## Policy System

### Writing and Versioning Policies

Policies are written as Rego. The API validates only that content contains a package declaration, then stores it as an immutable `policy_versions` row with a SHA-256 content hash and schema version. Updating a policy means creating another version. Existing versions are not mutated; the database also has a trigger preventing update/delete of `policy_versions` rows.

This versioning model lets operators prepare policy changes without affecting runtime behavior.

### Policy Sets and Activation

A policy set version is a manifest of exact policy version IDs. The manifest is hashed and versioned. Activation updates `policy_set_bindings.active_version_id` for the zone and publishes `caracal.policy.invalidate` with the zone ID and policy set version ID.

Activation is the moment a policy change becomes runtime-visible. Before activation, policy versions and policy set versions are stored but inert.

### How Policies Reach STS

STS receives policy updates through two mechanisms.

The fast path is Redis invalidation. The API publishes `caracal.policy.invalidate`; STS consumes it as group `opa-engine`; the message carries `zone_id`; STS reloads that zone's active policy set.

The recovery path is polling. Every 60 seconds STS reloads policy for zones already present in its OPA state map. This protects against missed Redis invalidation events for zones STS has already evaluated.

### Real Evaluation Path

At evaluation time STS does not call the API. It reads Postgres directly:

1. Load active policy set binding for the zone.
2. Load the active policy set version.
3. Parse the manifest JSON.
4. Load all referenced policy version rows.
5. Compile those Rego modules plus the query `result = data.caracal.authz.result`.
6. Store the prepared query under the zone with the manifest SHA.
7. Evaluate the prepared query for each token-exchange resource.

If the active manifest SHA matches the cached SHA, STS avoids recompilation.

## Integration Model

### CLI Usage

The CLI reads `caracal.toml`. `caracal run <cmd...>` exchanges configured credentials for resource tokens, injects them into environment variables, and then runs the child command. `caracal credential read <resource>` prints a one-shot token to stdout.

The client responsibility is to configure `zone_url`, application client ID, application secret value, and resource-to-environment mappings. The tradeoff is convenience: CLI integration is easy for local tools and command execution, but it is process/environment based and depends on correct config.

The CLI also has MCP governance. If the command name looks like an MCP server and governance is in block mode, it stops execution; in log mode it writes a governance event to stderr.

### SDK Usage

The OAuth SDK is the direct programmatic integration. A client creates an `OAuthClient` with STS URL and client ID, calls `exchange(subjectToken, resource, opts)`, and receives a bearer token. The SDK caches tokens in process until they approach expiry and raises an interaction-required error when STS returns a step-up challenge.

The agent SDK builds on that by storing agent service config and exposing `getToolToken`. The A2A helper exchanges subject authority through STS before calling other agents. MCP SDKs are resource-side integration: they validate tokens and enforce audience/scope/zone.

The tradeoff is control. SDK usage gives the application direct error handling and caching, but the application must decide when to exchange, where to store subject tokens, and how to call protected resources.

### Gateway-Based Usage

Gateway-based usage puts the exchange at an HTTP proxy. The client sends its current bearer token plus Caracal headers. Gateway calls STS and forwards to the upstream with the exchanged token.

The client responsibility is to supply the inbound bearer, client ID, and target resource. The tradeoff is operational centralization: gateway usage gives a single enforcement hop and no token cache, but routable targets must be registered on resources so STS can return the approved upstream.

### Direct STS Usage

Direct STS usage is the lowest-level integration. A client posts form data to `/oauth/2/token`, handles errors, handles step-up, and stores the returned token for the protected call.

The client responsibility is highest here: it must format token-exchange requests, provide credentials, handle denied resources, handle `interaction_required`, and validate expiration behavior. The benefit is that it works in any language and avoids SDK assumptions.

## System Capabilities and Use Cases

### Agent-to-Agent Communication

The agent SDK's A2A helper lets one agent call another by exchanging the subject token for a target-agent resource token and setting the Caracal client ID. The receiving agent or service can validate the narrowed token according to its own resource model. This supports delegated multi-agent workflows without handing every agent a long-lived global credential.

### Secure API and Tool Access

STS-issued tokens are resource-scoped. A token for one resource should not be accepted by another because the resource identifier is in the JWT audience and target claims. MCP middleware validates these tokens at tool boundaries and can enforce required scopes. Gateway can put the STS exchange in front of a tool server so each request receives a fresh resource token.

### Delegated Credentials

Provider-backed resources and grants let Caracal model external delegated credentials. The grant stores the delegation and encrypted provider token state; STS refreshes expired provider credentials when possible before issuing the Caracal access token. This lets downstream calls use a Caracal token while provider credential maintenance remains behind the STS boundary.

### MCP Protection

Caracal protects MCP in two ways. The CLI detects MCP server commands and can block or log unauthorized shadow MCP processes. Resource-side MCP middleware validates Caracal JWTs before executing tool handlers. Gateway can also front an MCP server and exchange subject tokens for resource-scoped tool tokens on every request.

### Step-Up Authorization

Policy diagnostics can require step-up. STS creates a challenge, persists it, returns `interaction_required`, and lets an external management flow satisfy the challenge. The CLI polls challenge status and retries the token exchange with `challenge_response` once the challenge is satisfied.

## Event and State Flow

### Redis Streams

Redis Streams are the runtime notification fabric. The OSS stack provisions:

- `caracal.audit.events` with consumer groups `audit-ingestor` and `siem-export`.
- `caracal.policy.invalidate` with consumer group `opa-engine`.
- `caracal.sessions.revoke` with consumer group `sts-revocation`.
- `caracal.agents.lifecycle` with consumer group `agent-coordinator`.
- `caracal.providers.ratelimit` initialized as a stream, while the implemented STS rate limiter uses Redis counter keys of the form `rl:{zone_id}:{resource_id}:{actor_id}`.

### Audit Pipeline

STS emits one audit event per OPA decision. The event includes zone ID, event type `token_exchange`, request ID, decision, evaluation status, determining policies, diagnostics, and occurrence time. The audit buffer flushes to Redis. The audit service consumes, inserts into Postgres, and acknowledges only after insert.

Audit rows are append-oriented. The audit service computes a content hash over stable event fields. The tamper sweeper later recomputes hashes for recent events and logs mismatches.

### Policy Invalidation

When the API activates a policy set version, it publishes `caracal.policy.invalidate`. STS consumes the message, reads the current active binding and manifest from Postgres, compiles the new Rego bundle, and atomically replaces the zone's prepared query. If the invalidation event is missed, STS's polling loop can still reload known zones.

### Session Revocation

Session revocation is published to `caracal.sessions.revoke`. The API publishes it when grants are revoked. The Agent Coordinator publishes it when agents terminate or expire. STS consumes the stream and marks the session ID revoked in Postgres.

The revocation event carries the zone and session ID. It is state synchronization, not a JWT recall packet. Resource servers that need immediate revocation awareness need a validation path that checks session state or forces fresh STS exchange.

### Agent Lifecycle Events

Agent lifecycle events are published to `caracal.agents.lifecycle` with event name, zone ID, agent session ID, and parent ID where applicable. Spawn, suspend, resume, and terminate all emit lifecycle events. The Go relay consumes them in the `agent-coordinator` group and logs them.

Lifecycle events let external observers and internal workers react to agent topology and status changes without coupling directly to the coordinator's database transaction path.

## End-to-End Mental Model

Think of Caracal as an authority narrowing system.

The management API defines the universe: zones define isolation boundaries; applications define callers; resources define protected targets; providers define external credential backends; grants define delegated state; policies define authorization logic; policy sets decide which policy versions are active; sessions and agents define runtime lifetimes.

STS is the narrowing point. It receives some existing authority, such as an application credential or subject token, and asks: inside this zone, for this application, for this resource, under this active policy bundle, with these claims and scopes, should a token exist? If the answer is no, no downstream token is minted. If the answer requires human or external step-up, STS creates a challenge. If the answer is yes, STS creates a session and returns a JWT whose audience is only the allowed resource set.

Gateway and SDKs are ways to place that narrowing point into real workflows. Gateway does it transparently at the HTTP proxy boundary. SDKs do it inside application code. CLI does it before launching a process. MCP middleware does the complementary work on the receiving side by checking that the token STS minted is valid for the tool being called.

Redis Streams connect runtime change to runtime behavior. Policy activation invalidates STS's compiled OPA state. Grant and agent termination publish session revocation. Token exchange emits audit events. Agent state changes publish lifecycle events.

The result is a system where execution depends on explicit, current, zone-scoped authority. Durable state is managed through the API. Runtime decisions happen in STS. Tokens are narrow and short-lived. Resources validate those tokens at their boundary. Events keep policy, audit, session, and agent state moving between services without making the token-exchange path wait for every downstream side effect.
