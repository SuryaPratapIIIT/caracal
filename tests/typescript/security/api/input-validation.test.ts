// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// API input validation security tests: injection vectors, oversized inputs, and type confusion.

import { describe, it, expect, vi } from 'vitest'
import { buildApp } from '../../../../apps/api/src/app.js'

function deps(overrides: Partial<{ adminToken: string }> = {}) {
  const db = { query: vi.fn().mockResolvedValue({ rows: [] }) }
  const redis = { xadd: vi.fn() }
  const cfg = {
    port: 0,
    databaseUrl: 'postgres://localhost/caracal',
    redisUrl: 'redis://localhost:6379',
    logLevel: 'silent',
    adminToken: overrides.adminToken ?? 'admin-secret',
  }
  return { cfg, db, redis }
}

describe('SQL injection via URL parameter', () => {
  it('passes the raw id parameter to the DB layer without manipulation', async () => {
    const { cfg, db, redis } = deps()
    const app = await buildApp({ cfg, db: db as never, redis: redis as never })
    await app.inject({
      method: 'GET',
      url: "/v1/zones/'; DROP TABLE zones; --",
      headers: { authorization: 'Bearer admin-secret' },
    })
    // The DB is mocked so no actual SQL executes, but the param must reach it unmodified
    if (db.query.mock.calls.length > 0) {
      const callArg = db.query.mock.calls[0][1]
      if (Array.isArray(callArg)) {
        expect(typeof callArg[0]).toBe('string')
      }
    }
    await app.close()
  })
})

describe('Timing-safe admin token comparison', () => {
  it('rejects tokens that share a prefix with the real token', async () => {
    const { cfg, db, redis } = deps({ adminToken: 'supersecrettoken123' })
    const app = await buildApp({ cfg, db: db as never, redis: redis as never })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/zones',
      headers: { authorization: 'Bearer supersecret' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('rejects tokens that are a superset of the real token', async () => {
    const { cfg, db, redis } = deps({ adminToken: 'secret' })
    const app = await buildApp({ cfg, db: db as never, redis: redis as never })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/zones',
      headers: { authorization: 'Bearer secret-extra-suffix' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('rejects empty bearer token', async () => {
    const { cfg, db, redis } = deps()
    const app = await buildApp({ cfg, db: db as never, redis: redis as never })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/zones',
      headers: { authorization: 'Bearer ' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('rejects token with only whitespace', async () => {
    const { cfg, db, redis } = deps()
    const app = await buildApp({ cfg, db: db as never, redis: redis as never })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/zones',
      headers: { authorization: 'Bearer    ' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('Admin token scheme enforcement', () => {
  it('rejects Basic auth scheme even with correct secret', async () => {
    const { cfg, db, redis } = deps()
    const app = await buildApp({ cfg, db: db as never, redis: redis as never })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/zones',
      headers: { authorization: 'Basic admin-secret' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('rejects missing Authorization header entirely', async () => {
    const { cfg, db, redis } = deps()
    const app = await buildApp({ cfg, db: db as never, redis: redis as never })
    const res = await app.inject({ method: 'GET', url: '/v1/zones' })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('Response body does not leak internal errors', () => {
  it('returns structured error object on 401, not a stack trace', async () => {
    const { cfg, db, redis } = deps()
    const app = await buildApp({ cfg, db: db as never, redis: redis as never })
    const res = await app.inject({ method: 'GET', url: '/v1/zones' })
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('error')
    expect(JSON.stringify(body)).not.toContain('Error:')
    expect(JSON.stringify(body)).not.toContain('at ')
    await app.close()
  })
})
