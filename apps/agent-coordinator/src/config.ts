// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Agent coordinator configuration.

import { getenv, mustGetenv } from '@caracalai/shared'

export const cfg = {
  port: parseInt(getenv('PORT', '4000'), 10),
  databaseUrl: mustGetenv('DATABASE_URL'),
  redisUrl: mustGetenv('REDIS_URL'),
  stsUrl: mustGetenv('STS_URL'),
  issuerUrl: getenv('ISSUER_URL', mustGetenv('STS_URL')),
  audience: getenv('AGENT_COORDINATOR_AUDIENCE', 'caracal.agent-coordinator'),
  requiredScope: getenv('AGENT_COORDINATOR_SCOPE', 'agent:lifecycle'),
}
