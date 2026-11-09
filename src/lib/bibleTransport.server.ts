import { connect } from 'cloudflare:sockets'

const MAX_BYTES = 1024 * 1024
const PATH = /^https:\/\/api\.prayerpulse\.io(\/bible\/get-books\/(?:KJV|ESV|AMP|NIV)\/|\/bible\/get-text\/(?:KJV|ESV|AMP|NIV)\/(?:[1-3]?[A-Z]{2,3}|B\d{2})\/(?:[1-9]|[1-9]\d|1[0-4]\d|150)\/\?clean=true)$/

function response(bytes: Uint8Array): Response {
  let end = -1
  for (let i = 0; i < Math.min(bytes.length - 3, 16384); i++) {
    if (bytes[i] === 13 && bytes[i + 1] === 10 && bytes[i + 2] === 13 && bytes[i + 3] === 10) { end = i; break }
  }
  if (end < 0) throw new Error('Invalid Bible response headers.')
  const [status, ...lines] = new TextDecoder().decode(bytes.subarray(0, end)).split('\r\n')
  if (!/^HTTP\/1\.[01] 200(?: .*)?$/.test(status)) throw new Error('Bible provider returned an unsuccessful response.')
  const headers = new Headers()
  for (const line of lines) {
    const colon = line.indexOf(':')
    if (colon < 1) throw new Error('Invalid Bible response header.')
    headers.append(line.slice(0, colon), line.slice(colon + 1).trim())
  }
  const length = headers.get('content-length') ?? ''
  const body = bytes.subarray(end + 4)
  // ponytail: fixed provider GETs need only identity JSON with explicit length; reject other framing.
  if (headers.has('transfer-encoding') || !/^(identity)?$/i.test(headers.get('content-encoding') ?? '')
    || headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
    || !/^\d+$/.test(length) || Number(length) !== body.byteLength) throw new Error('Unsupported or incomplete Bible response.')
  const json = new TextDecoder('utf-8', { fatal: true }).decode(body)
  JSON.parse(json)
  return new Response(json, { headers: { 'Content-Type': 'application/json' } })
}

/** Dedicated provider transport: native TLS verifies the fixed hostname; no redirects or plaintext fallback. */
export const bibleTransport: typeof fetch = async (input, init) => {
  const url = (typeof input === 'string' || input instanceof URL) ? String(input) : ''
  const path = PATH.exec(url)?.[1]
  if (!path || url !== `https://api.prayerpulse.io${path}` || (init?.method && init.method !== 'GET') || init?.body != null) throw new Error('Invalid Bible request.')
  const signal = init?.signal
  if (signal?.aborted) throw signal.reason ?? new Error('Bible request aborted.')
  const socket = connect({ hostname: 'api.prayerpulse.io', port: 443 }, { secureTransport: 'on', allowHalfOpen: false })
  void socket.closed.catch(() => {})
  let timer: ReturnType<typeof setTimeout> | undefined
  let abort = () => {}
  const cancelled = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Bible request timed out.')), 12000)
    abort = () => reject(signal?.reason ?? new Error('Bible request aborted.'))
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
  })
  const read = async () => {
    await socket.opened
    const writer = socket.writable.getWriter()
    try {
      await writer.write(new TextEncoder().encode(`GET ${path} HTTP/1.0\r\nHost: api.prayerpulse.io\r\nAccept: application/json\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n`))
    } finally { writer.releaseLock() }
    const reader = socket.readable.getReader()
    const chunks: Uint8Array[] = []
    let length = 0
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        length += value.byteLength
        if (length > MAX_BYTES) throw new Error('Bible response is too large.')
        chunks.push(value)
      }
    } finally { reader.releaseLock() }
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return response(bytes)
  }
  try { return await Promise.race([read(), cancelled]) }
  finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
    await socket.close().catch(() => {})
  }
}
