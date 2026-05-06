// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Schema migration runner: applies infra/postgres/migrations/*.up.sql idempotently on API startup.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { DB } from './db.js'

const MIGRATIONS_TABLE = 'schema_migrations'
const ADVISORY_LOCK_KEY = '4732518903281471'

function discoverMigrationsDir(): string {
  if (process.env.CARACAL_MIGRATIONS_DIR) return process.env.CARACAL_MIGRATIONS_DIR
  let dir = process.cwd()
  for (let depth = 0; depth < 8; depth++) {
    const candidate = join(dir, 'infra', 'postgres', 'migrations')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('migrations directory not found; set CARACAL_MIGRATIONS_DIR')
}

function listMigrations(dir: string): { version: string; path: string }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.up.sql'))
    .sort()
    .map((f) => ({ version: f.replace(/\.up\.sql$/, ''), path: join(dir, f) }))
}

export async function runMigrations(db: DB, log: (msg: string) => void): Promise<void> {
  const dir = discoverMigrationsDir()
  const migrations = listMigrations(dir)
  if (migrations.length === 0) return

  const client = await db.connect()
  try {
    // Serialize replicas during rolling deploys so only one process applies pending migrations.
    await client.query(`SELECT pg_advisory_lock($1::bigint)`, [ADVISORY_LOCK_KEY])
    try {
      await client.query(
        `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
           version TEXT PRIMARY KEY,
           applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`,
      )

      const { rows } = await client.query<{ version: string }>(
        `SELECT version FROM ${MIGRATIONS_TABLE}`,
      )
      const applied = new Set(rows.map((r) => r.version))

      for (const m of migrations) {
        if (applied.has(m.version)) continue
        const sql = readFileSync(m.path, 'utf8')
        log(`applying migration ${m.version}`)
        await client.query('BEGIN')
        try {
          await client.query(sql)
          await client.query(`INSERT INTO ${MIGRATIONS_TABLE} (version) VALUES ($1)`, [m.version])
          await client.query('COMMIT')
        } catch (err) {
          await client.query('ROLLBACK')
          throw new Error(`migration ${m.version} failed: ${(err as Error).message}`)
        }
      }
    } finally {
      await client.query(`SELECT pg_advisory_unlock($1::bigint)`, [ADVISORY_LOCK_KEY])
    }
  } finally {
    client.release()
  }
}
