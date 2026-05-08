// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Shared configuration loader for TypeScript services.

export interface BaseConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  stsUrl: string;
  logLevel: string;
}

export function mustGetenv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Required env var missing: ${key}`);
  return v;
}

export function getenv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export function loadBaseConfig(): BaseConfig {
  return {
    port: parseInt(mustGetenv('PORT'), 10),
    databaseUrl: mustGetenv('DATABASE_URL'),
    redisUrl: mustGetenv('REDIS_URL'),
    stsUrl: getenv('STS_URL', 'http://localhost:8080'),
    logLevel: getenv('LOG_LEVEL', 'info'),
  };
}
