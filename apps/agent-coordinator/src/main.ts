// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Agent coordinator service entry point with graceful shutdown.

import { buildApp } from './app.js'
import { db } from './db.js'
import { buildRedis, closeRedis } from './redis.js'
import { startOutboxPublisher } from './jobs/outbox-publisher.js'
import { startTTLSweeper } from './jobs/ttl-sweeper.js'
import { startDeadlineEnforcer } from './jobs/deadline-enforcer.js'
import { cfg } from './config.js'

const app = await buildApp()
const redis = buildRedis()
const outbox = startOutboxPublisher(db, redis)
const ttl = startTTLSweeper(db)
const deadline = startDeadlineEnforcer(db)

let shuttingDown = false
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  app.log.info({ signal }, 'shutdown_begin')
  const grace = setTimeout(() => {
    app.log.error('shutdown_timeout_force_exit')
    process.exit(1)
  }, cfg.shutdownGraceMs)
  grace.unref()
  try {
    await app.close()
    await Promise.all([outbox.stop(), ttl.stop(), deadline.stop()])
    await db.end()
    await closeRedis()
    app.log.info('shutdown_complete')
    process.exit(0)
  } catch (err) {
    app.log.error({ err }, 'shutdown_failed')
    process.exit(1)
  }
}

process.on('SIGTERM', () => { void shutdown('SIGTERM') })
process.on('SIGINT', () => { void shutdown('SIGINT') })

try {
  await app.listen({ port: cfg.port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
