// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// TTL sweeper unit tests covering leader election and outbox enqueue.

import { describe, expect, it, vi } from 'vitest'
import { runTTLSweep } from '../../../../../../apps/agent-coordinator/src/jobs/ttl-sweeper.js'

function clientWith(rows: unknown[], acquired = true) {
  return {
    query: vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ acquired }] })
      .mockResolvedValueOnce({ rows })
      .mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  }
}

describe('runTTLSweep', () => {
  it('skips work when the advisory lock is held by another node', async () => {
    const client = clientWith([], false)
    const db = { connect: vi.fn().mockResolvedValueOnce(client) }
    await expect(runTTLSweep(db as never)).resolves.toBe(0)
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
  })

  it('terminates expired sessions and enqueues outbox events', async () => {
    const rows = [
      { id: 'agent-1', zone_id: 'z1', session_sid: 'sid-1', parent_id: null },
      { id: 'agent-2', zone_id: 'z1', session_sid: 'sid-2', parent_id: 'agent-1' },
    ]
    const client = clientWith(rows)
    const db = { connect: vi.fn().mockResolvedValueOnce(client) }

    const count = await runTTLSweep(db as never)
    expect(count).toBe(2)

    const outboxInserts = client.query.mock.calls.filter((call) => String(call[0]).includes('caracal_outbox'))
    expect(outboxInserts.length).toBe(4)
    const dedupeKeys = outboxInserts.map((call) => call[1]?.[2])
    expect(dedupeKeys).toEqual(expect.arrayContaining([
      'agent_ttl:agent-1', 'terminate:agent-1',
      'agent_ttl:agent-2', 'terminate:agent-2',
    ]))
    expect(client.query).toHaveBeenCalledWith('COMMIT')
  })

  it('commits with no inserts when nothing expired', async () => {
    const client = clientWith([])
    const db = { connect: vi.fn().mockResolvedValueOnce(client) }
    await expect(runTTLSweep(db as never)).resolves.toBe(0)
    const outboxInserts = client.query.mock.calls.filter((call) => String(call[0]).includes('caracal_outbox'))
    expect(outboxInserts.length).toBe(0)
    expect(client.query).toHaveBeenCalledWith('COMMIT')
  })
})
