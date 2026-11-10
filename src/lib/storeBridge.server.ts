import { env } from 'cloudflare:workers'
import { STORE_ORIGIN } from './storeTypes'
const BRIDGE = `${STORE_ORIGIN}/wp-json/halobox-bridge/v1`
/** Signed call to the Halobox Store Bridge on uebertangel.org (quote/order/orders/status). */
export async function bridge(path: string, payload: object) {
  const secret = (env as any).STORE_BRIDGE_PRIVATE_KEY
  if (typeof secret !== 'string' || !secret.includes('BEGIN PRIVATE KEY')) throw new Error('Store checkout is being connected. You can shop directly at uebertangel.org meanwhile.')
  const body = JSON.stringify(payload), timestamp = String(Math.floor(Date.now()/1000)), nonce = crypto.randomUUID()
  const der = Uint8Array.from(atob(secret.replace(/-----[^-]+-----|\s/g, '')), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${timestamp}\n${nonce}\n${path}\n${body}`))
  const signature = btoa(String.fromCharCode(...new Uint8Array(digest)))
  const r = await fetch(`${BRIDGE}${path}`, { method: 'POST', headers: { 'Content-Type':'application/json', 'X-Halobox-Time':timestamp, 'X-Halobox-Nonce':nonce, 'X-Halobox-Signature':signature }, body, redirect:'manual', signal:AbortSignal.timeout(15000) })
  const data:any = await r.json()
  if (!r.ok) throw new Error(`The store connection is unavailable (HTTP ${r.status}${typeof data?.code === 'string' ? ' ' + data.code : ''}${typeof data?.message === 'string' ? ': ' + String(data.message).replace(/<[^>]*>/g, '').slice(0, 200) : ''}). Please try again shortly.`)
  return data
}
