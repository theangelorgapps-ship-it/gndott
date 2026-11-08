type AppleSigningConfig = {
  clientId: string
  teamId: string
  keyId: string
  privateKey: string
}

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const encode = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)))

/** Apple requires an ES256 JWT as its client secret. Sign a short-lived JWT
 * from the server-only .p8 key instead of storing an expiring six-month token. */
export async function appleClientSecret(config: AppleSigningConfig, now = Math.floor(Date.now() / 1000)) {
  const pem = config.privateKey.replace(/\\n/g, '\n')
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, '')), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const message = `${encode({ alg: 'ES256', kid: config.keyId })}.${encode({ iss: config.teamId, sub: config.clientId, aud: 'https://appleid.apple.com', iat: now, exp: now + 300 })}`
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(message))
  return `${message}.${base64url(new Uint8Array(signature))}`
}
