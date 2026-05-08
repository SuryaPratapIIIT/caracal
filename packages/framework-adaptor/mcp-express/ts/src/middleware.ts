// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Express middleware that delegates MCP auth to @caracalai/transport-mcp.

import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { Claims } from '@caracalai/identity'
import type { RevocationStore } from '@caracalai/revocation'
import { authenticate, extractBearer, type AuthError } from '@caracalai/transport-mcp'

export interface MiddlewareOptions {
  issuer: string
  audience: string
  zoneId?: string
  requiredScopes?: string[]
  revocations?: RevocationStore
}

export interface CaracalRequest extends Request {
  caracalClaims?: Claims
}

export function caracalAuth(opts: MiddlewareOptions): RequestHandler {
  return async (req: CaracalRequest, res: Response, next: NextFunction): Promise<void> => {
    const token = extractBearer(req.headers['authorization'])
    if (!token) {
      res.status(401).json({ error: 'invalid_token', error_description: 'Missing bearer token' })
      return
    }

    const result = await authenticate(token, opts)
    if (!result.ok) {
      const { status, body } = mapError(result.error)
      res.status(status).json(body)
      return
    }

    req.caracalClaims = result.principal
    next()
  }
}

function mapError(err: AuthError): { status: number; body: { error: string; error_description: string } } {
  if (err.code === 'insufficient_scope') {
    return { status: 403, body: { error: 'insufficient_scope', error_description: err.description } }
  }
  return { status: 401, body: { error: 'invalid_token', error_description: err.description } }
}
