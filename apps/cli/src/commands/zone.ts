// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// `caracal zone …` admin subcommands.

import type { CliConfig } from '../config.ts'
import {
  buildAdminClient,
  fail,
  flagBool,
  flagString,
  parseArgs,
  printJSON,
  printTable,
} from './shared.ts'

export async function zoneCommand(argv: string[], cfg?: CliConfig): Promise<void> {
  const [verb, ...rest] = argv
  const { client } = buildAdminClient(cfg)
  const { positional, flags } = parseArgs(rest)
  const json = flagBool(flags, 'json')

  try {
    switch (verb) {
      case 'list': {
        const rows = await client.zones.list()
        if (json) return printJSON(rows)
        return printTable(rows, ['id', 'name', 'slug', 'org_id', 'dcr_enabled', 'pkce_required'])
      }
      case 'get': {
        const id = positional[0]
        if (!id) return usage('zone get <id>')
        return printJSON(await client.zones.get(id))
      }
      case 'create': {
        const name = flagString(flags, 'name')
        if (!name) return usage('zone create --name <name> [--slug …] [--org <id>] [--dcr] [--no-pkce]')
        return printJSON(await client.zones.create({
          name,
          slug: flagString(flags, 'slug'),
          org_id: flagString(flags, 'org'),
          dcr_enabled: flagBool(flags, 'dcr') || undefined,
          pkce_required: flagBool(flags, 'no-pkce') ? false : undefined,
          login_flow: flagString(flags, 'login-flow'),
        }))
      }
      case 'patch': {
        const id = positional[0]
        if (!id) return usage('zone patch <id> [--name …] [--slug …] [--dcr=true|false] …')
        return printJSON(await client.zones.patch(id, {
          name: flagString(flags, 'name'),
          slug: flagString(flags, 'slug'),
          org_id: flagString(flags, 'org'),
          dcr_enabled: flags['dcr'] === undefined ? undefined : flagBool(flags, 'dcr'),
          pkce_required: flags['pkce'] === undefined ? undefined : flagBool(flags, 'pkce'),
          login_flow: flagString(flags, 'login-flow'),
        }))
      }
      case 'delete': {
        const id = positional[0]
        if (!id) return usage('zone delete <id>')
        await client.zones.delete(id)
        process.stdout.write(`deleted ${id}\n`)
        return
      }
      default:
        return usage('zone <list|get|create|patch|delete> [...]')
    }
  } catch (err) {
    fail(err)
  }
}

function usage(line: string): void {
  process.stderr.write(`Usage: caracal ${line}\n`)
  process.exit(1)
}
