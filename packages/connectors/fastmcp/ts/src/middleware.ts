// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// FastMCP token verifier that delegates to @caracalai/transport-mcp.

import { authenticate, extractBearer } from '@caracalai/transport-mcp'
import type { RevocationStore } from '@caracalai/revocation'

export interface FastMcpAuthOptions {
  issuer: string
  audience: string
  zoneId?: string
  requiredScopes?: string[]
  revocations: RevocationStore
}

export interface FastMcpContext {
  sub: string
  zoneId: string
  scope: string
}

export async function verifyFastMcpToken(
  token: string,
  opts: FastMcpAuthOptions,
): Promise<FastMcpContext> {
  const result = await authenticate(token, opts)
  if (!result.ok) throw new Error(result.error.description)
  const claims = result.principal
  return { sub: claims.sub, zoneId: claims.zoneId, scope: claims.scope }
}

export { extractBearer }
