// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// PostgresBackend: persists per-user MCP token state in PostgreSQL.

import { Pool } from 'pg'

export interface TokenState {
  sub: string
  scope: string
  expiresAt: Date
  updatedAt: Date
}

export class PostgresBackend {
  constructor(private readonly pool: Pool) {}

  async upsert(sub: string, scope: string, expiresAt: Date): Promise<void> {
    await this.pool.query(
      `INSERT INTO mcp_token_state (sub, scope, expires_at, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (sub) DO UPDATE
         SET scope = EXCLUDED.scope,
             expires_at = EXCLUDED.expires_at,
             updated_at = now()`,
      [sub, scope, expiresAt],
    )
  }

  async get(sub: string): Promise<TokenState | null> {
    const { rows } = await this.pool.query<TokenState>(
      `SELECT sub, scope, expires_at AS "expiresAt", updated_at AS "updatedAt"
       FROM mcp_token_state WHERE sub = $1`,
      [sub],
    )
    return rows[0] ?? null
  }

  async delete(sub: string): Promise<void> {
    await this.pool.query('DELETE FROM mcp_token_state WHERE sub = $1', [sub])
  }
}
