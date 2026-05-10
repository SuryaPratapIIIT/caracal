// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// A2A call helper: exchanges subject authority for a target agent token.

import { OAuthClient } from '@caracalai/oauth'
import { toEnvelope, toHeaders, tryCurrent, type Envelope } from '@caracalai/sdk/advanced'
import type { A2AOptions, A2ARequest, A2AResponse, FetchLike } from './types.js'

export async function a2aCall(
  req: A2ARequest,
  subjectToken: string,
  zoneId: string,
  applicationId: string,
  opts: A2AOptions,
): Promise<A2AResponse> {
  const token = await new OAuthClient(opts.stsUrl, zoneId, applicationId).exchange(
    subjectToken,
    req.resource ?? req.agentUrl,
    {
      clientSecret: opts.clientSecret,
      clientAssertion: opts.clientAssertion,
      clientAssertionType: opts.clientAssertionType,
      scopes: req.scopes,
      sessionId: req.sessionId,
      agentSessionId: req.agentSessionId,
      delegationEdgeId: req.delegationEdgeId,
      ttlSeconds: opts.ttlSeconds,
    },
  )

  const ctx = tryCurrent()
  const envelope: Envelope = ctx
    ? toEnvelope(ctx)
    : {
        subjectToken: token.accessToken,
        agentSessionId: req.agentSessionId,
        delegationEdgeId: req.delegationEdgeId,
        hop: 0,
      }
  const envHeaders = toHeaders(envelope)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token.accessToken}`,
    ...envHeaders,
  }

  const fetchImpl = opts.fetchImpl ?? (globalThis as unknown as { fetch: FetchLike }).fetch
  const res = await fetchImpl(`${req.agentUrl}/a2a`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      method: req.method,
      params: req.params,
      requestId: req.requestId,
      zoneId,
      applicationId,
      resource: req.resource ?? req.agentUrl,
      scopes: req.scopes,
      sessionId: req.sessionId,
      agentSessionId: req.agentSessionId,
      delegationEdgeId: req.delegationEdgeId,
      transport: 'a2a',
      target: req.agentUrl,
      metadata: req.metadata,
    }),
  })

  if (!res.ok) {
    throw new Error(`A2A call failed: ${res.status}`)
  }

  return (await res.json()) as A2AResponse
}
