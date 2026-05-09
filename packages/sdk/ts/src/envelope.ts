/*
 * Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
 * Caracal, a product of Garudex Labs
 *
 * Wire envelope: transport-neutral identity and delegation propagation headers.
 */

export const HeaderSubjectToken = "caracal-subject-token";
export const HeaderAgentSession = "caracal-agent-session";
export const HeaderDelegationEdge = "caracal-delegation-edge";
export const HeaderParentEdge = "caracal-parent-edge";
export const HeaderTrace = "caracal-trace";
export const HeaderHop = "caracal-hop";

export const MaxHop = 32;

export interface Envelope {
  subjectToken?: string;
  agentSessionId?: string;
  delegationEdgeId?: string;
  parentEdgeId?: string;
  traceId?: string;
  hop: number;
}

export type HeaderGetter = (name: string) => string | undefined;
export type HeaderSetter = (name: string, value: string) => void;

const headerKey = (h: Record<string, string | string[] | undefined>, name: string) => {
  const lower = name.toLowerCase();
  for (const k of Object.keys(h)) {
    if (k.toLowerCase() === lower) {
      const v = h[k];
      return Array.isArray(v) ? v[0] : v;
    }
  }
  return undefined;
};

export function fromHeaders(headers: Record<string, string | string[] | undefined>): Envelope {
  const get = (n: string) => headerKey(headers, n);
  return decodeEnvelope((n) => get(n));
}

export function decodeEnvelope(get: HeaderGetter): Envelope {
  const hopRaw = get(HeaderHop);
  const hop = hopRaw ? Math.max(0, Math.min(MaxHop, parseInt(hopRaw, 10) || 0)) : 0;
  return {
    subjectToken: get(HeaderSubjectToken),
    agentSessionId: get(HeaderAgentSession),
    delegationEdgeId: get(HeaderDelegationEdge),
    parentEdgeId: get(HeaderParentEdge),
    traceId: get(HeaderTrace),
    hop,
  };
}

export function encodeEnvelope(env: Envelope, set: HeaderSetter): void {
  if (env.subjectToken) set(HeaderSubjectToken, env.subjectToken);
  if (env.agentSessionId) set(HeaderAgentSession, env.agentSessionId);
  if (env.delegationEdgeId) set(HeaderDelegationEdge, env.delegationEdgeId);
  if (env.parentEdgeId) set(HeaderParentEdge, env.parentEdgeId);
  if (env.traceId) set(HeaderTrace, env.traceId);
  set(HeaderHop, String(env.hop));
}

export function toHeaders(env: Envelope): Record<string, string> {
  const out: Record<string, string> = {};
  encodeEnvelope(env, (n, v) => {
    out[n] = v;
  });
  return out;
}

export function inject(env: Envelope, carrier: Record<string, string>): void {
  encodeEnvelope(env, (n, v) => {
    carrier[n] = v;
  });
}

export function extract(carrier: Record<string, string | string[] | undefined>): Envelope {
  return fromHeaders(carrier);
}
