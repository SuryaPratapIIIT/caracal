// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// API service configuration loaded from environment variables.

import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { getenv, mustGetenv } from '@caracalai/shared'

function loadEnvChain(): void {
  const seen = new Set<string>()
  const candidates: string[] = []

  if (process.env.CARACAL_ENV_FILE) candidates.push(process.env.CARACAL_ENV_FILE)
  candidates.push(resolve(process.cwd(), '.env'))

  let dir = process.cwd()
  for (let depth = 0; depth < 6; depth++) {
    candidates.push(join(dir, 'infra', 'docker', '.env'))
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  for (const path of candidates) {
    if (seen.has(path)) continue
    seen.add(path)
    if (existsSync(path)) loadEnvFile(path)
  }
}

loadEnvChain()

export interface Config {
  port: number
  databaseUrl: string
  redisUrl: string
  logLevel: string
  adminToken: string
}

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const user = encodeURIComponent(mustGetenv('POSTGRES_USER'))
  const password = encodeURIComponent(mustGetenv('POSTGRES_PASSWORD'))
  const host = getenv('POSTGRES_HOST', 'localhost')
  const port = getenv('POSTGRES_PORT', '5432')
  const db = mustGetenv('POSTGRES_DB')
  return `postgres://${user}:${password}@${host}:${port}/${db}`
}

function buildRedisUrl(): string {
  if (process.env.REDIS_URL) return process.env.REDIS_URL
  const password = encodeURIComponent(mustGetenv('REDIS_PASSWORD'))
  const host = getenv('REDIS_HOST', 'localhost')
  const port = getenv('REDIS_PORT', '6379')
  return `redis://:${password}@${host}:${port}`
}

export function loadConfig(): Config {
  return {
    port: parseInt(getenv('PORT', '3000'), 10),
    databaseUrl: buildDatabaseUrl(),
    redisUrl: buildRedisUrl(),
    logLevel: getenv('LOG_LEVEL', 'info'),
    adminToken: mustGetenv('CARACAL_ADMIN_TOKEN'),
  }
}
