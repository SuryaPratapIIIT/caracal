// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Workers-compatible fetch wrapper for STS RFC 8693 token exchange.

export interface WorkersExchangeResult {
  accessToken: string
  expiresIn: number
}

interface STSErrorResponse {
  error_description?: string
}

function parseSTSErrorResponse(body: string): STSErrorResponse {
  if (body === '') return {}
  return JSON.parse(body) as STSErrorResponse
}

export async function exchangeToken(
  stsUrl: string,
  clientId: string,
  subjectToken: string,
  resource: string,
  scopes?: string[],
): Promise<WorkersExchangeResult> {
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token: subjectToken,
    subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    resource,
    client_id: clientId,
  })
  if (scopes?.length) body.set('scope', scopes.join(' '))

  const res = await fetch(`${stsUrl}/oauth/2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    let err: STSErrorResponse
    try {
      err = parseSTSErrorResponse(await res.text())
    } catch {
      throw new Error(`STS error ${res.status}: invalid error response`)
    }
    throw new Error(err['error_description'] ?? `STS error ${res.status}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  return { accessToken: data['access_token'], expiresIn: data['expires_in'] }
}
