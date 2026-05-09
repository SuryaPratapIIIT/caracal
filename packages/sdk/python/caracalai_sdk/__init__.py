"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Public surface of the Caracal Python SDK.
"""

from .envelope import (
    HEADER_AGENT_SESSION,
    HEADER_DELEGATION_EDGE,
    HEADER_HOP,
    HEADER_PARENT_EDGE,
    HEADER_SUBJECT_TOKEN,
    HEADER_TRACE,
    MAX_HOP,
    Envelope,
    decode_envelope,
    encode_envelope,
    extract,
    from_headers,
    inject,
    to_headers,
)
from .context import (
    CaracalContext,
    abind,
    bind,
    current,
    from_envelope,
    to_envelope,
    try_current,
    with_overrides,
)
from .coordinator import (
    AgentKind,
    CoordinatorClient,
    DelegationRequest,
    DelegationResponse,
    SpawnRequest,
    SpawnResponse,
    create_delegation,
    spawn_agent,
    terminate_agent,
)
from .primitives import with_agent, with_delegation

__all__ = [
    "HEADER_SUBJECT_TOKEN",
    "HEADER_AGENT_SESSION",
    "HEADER_DELEGATION_EDGE",
    "HEADER_PARENT_EDGE",
    "HEADER_TRACE",
    "HEADER_HOP",
    "MAX_HOP",
    "Envelope",
    "decode_envelope",
    "encode_envelope",
    "from_headers",
    "to_headers",
    "inject",
    "extract",
    "CaracalContext",
    "current",
    "try_current",
    "bind",
    "abind",
    "with_overrides",
    "to_envelope",
    "from_envelope",
    "AgentKind",
    "CoordinatorClient",
    "SpawnRequest",
    "SpawnResponse",
    "DelegationRequest",
    "DelegationResponse",
    "spawn_agent",
    "terminate_agent",
    "create_delegation",
    "with_agent",
    "with_delegation",
]
