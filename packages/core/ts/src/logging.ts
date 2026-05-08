// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Structured JSON logger for TypeScript services.

type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Level[] = ['debug', 'info', 'warn', 'error'];

function shouldLog(msgLevel: Level, configLevel: Level): boolean {
  return ORDER.indexOf(msgLevel) >= ORDER.indexOf(configLevel);
}

export type Logger = ReturnType<typeof createLogger>;

export function createLogger(service: string, level: Level = 'info') {
  const emit = (msgLevel: Level, msg: string, fields?: Record<string, unknown>) => {
    if (!shouldLog(msgLevel, level)) return;
    process.stderr.write(
      JSON.stringify({ level: msgLevel, service, msg, time: new Date().toISOString(), ...fields }) +
        '\n',
    );
  };
  return {
    debug: (msg: string, fields?: Record<string, unknown>) => emit('debug', msg, fields),
    info: (msg: string, fields?: Record<string, unknown>) => emit('info', msg, fields),
    warn: (msg: string, fields?: Record<string, unknown>) => emit('warn', msg, fields),
    error: (msg: string, fields?: Record<string, unknown>) => emit('error', msg, fields),
  };
}
