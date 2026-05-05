// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Workers-compatible JWKS validation using Web Crypto.

interface JwksKey {
  kty: string
  kid: string
  n?: string
  e?: string
  crv?: string
  x?: string
  use?: string
  alg?: string
}

interface Jwks {
  keys: JwksKey[]
}

const jwksCache = new Map<string, { keys: JwksKey[]; fetchedAt: number }>()
const JWKS_TTL_MS = 5 * 60 * 1000

async function getJwks(jwksUrl: string): Promise<JwksKey[]> {
  const now = Date.now()
  const cached = jwksCache.get(jwksUrl)
  if (cached && now - cached.fetchedAt < JWKS_TTL_MS) return cached.keys

  const res = await fetch(jwksUrl)
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`)
  const body = (await res.json()) as Jwks
  jwksCache.set(jwksUrl, { keys: body.keys, fetchedAt: now })
  return body.keys
}

export interface JwtClaims {
  sub: string
  iss: string
  aud: string | string[]
  exp: number
  zone_id?: string
  scope?: string
}

export async function validateJwt(
  token: string,
  jwksUrl: string,
  expectedAud: string,
  expectedIss: string,
  expectedZoneId?: string,
): Promise<JwtClaims> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT structure')

  const headerB64 = parts[0]!
  const payloadB64 = parts[1]!
  const sigB64 = parts[2]!

  const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/'))) as {
    kid?: string
    alg?: string
  }

  const payload = JSON.parse(
    atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')),
  ) as JwtClaims

  const now = Math.floor(Date.now() / 1000)
  if (payload.exp <= now) throw new Error('Token expired')
  if (payload.iss !== expectedIss) throw new Error('Invalid issuer')

  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!aud.includes(expectedAud)) throw new Error('Invalid audience')
  if (!payload.zone_id || (expectedZoneId && payload.zone_id !== expectedZoneId)) throw new Error('Invalid zone')

  const keys = await getJwks(jwksUrl)
  const key = header.kid ? keys.find((k) => k.kid === header.kid) : keys[0]
  if (!key) throw new Error('No matching JWKS key')

  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
    c.charCodeAt(0),
  )

  const cryptoKey = await importJwk(key)
  const valid = await crypto.subtle.verify(
    algorithmFor(header.alg ?? 'RS256'),
    cryptoKey,
    sigBytes,
    signingInput,
  )
  if (!valid) throw new Error('Invalid signature')

  return payload
}

function algorithmFor(alg: string): AlgorithmIdentifier | RsaPssParams | EcdsaParams {
  if (alg === 'RS256') return { name: 'RSASSA-PKCS1-v1_5' }
  if (alg === 'RS384') return { name: 'RSASSA-PKCS1-v1_5' }
  if (alg === 'ES256') return { name: 'ECDSA', hash: 'SHA-256' }
  throw new Error(`Unsupported algorithm: ${alg}`)
}

async function importJwk(key: JwksKey): Promise<CryptoKey> {
  const alg = key.alg ?? 'RS256'
  if (alg.startsWith('RS')) {
    return crypto.subtle.importKey(
      'jwk',
      key as JsonWebKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
  }
  return crypto.subtle.importKey(
    'jwk',
    key as JsonWebKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  )
}
