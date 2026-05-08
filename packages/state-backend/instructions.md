# state-backend

## Scope
- Covers concrete storage backends consumed by Caracal interfaces.

## Required
- Each child directory must own exactly one storage technology binding for one Caracal interface or domain.
- Token state bindings live under `tokenstate-<technology>/` and token cache bindings live under `tokencache-<technology>/`.

## Forbidden
- Must not host transport, framework, or identity logic.
