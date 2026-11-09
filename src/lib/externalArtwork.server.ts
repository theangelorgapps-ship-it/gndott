import { allowedExternalArtwork } from './imageUrls'
import { convertAvif, ImagePipelineError, MAX_IMAGE_BYTES, sha256, writeVerifiedAvif } from './imageProcessing.server'

export async function externalArtwork(value: string, bindings: any, fetcher: typeof fetch = fetch) {
  const url = allowedExternalArtwork(value)
  if (!url) return null
  const key = `external-artwork/v1/${await sha256(url.href)}.avif`
  let cached
  try { cached = await bindings.MEDIA.get(key) }
  catch { throw new ImagePipelineError('cache-read','Store artwork cache unavailable.') }
  if (cached?.httpMetadata?.contentType === 'image/avif' && cached.customMetadata?.sha256) return cached
  // Refuse redirects to prevent an allowlisted source from selecting an untrusted host.
  let response
  try { response = await fetcher(url.href,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{accept:'image/avif,image/webp,image/png,image/jpeg'}}) }
  catch { throw new ImagePipelineError('source-fetch','Store artwork unavailable.') }
  if (!response.ok) throw new ImagePipelineError(`source-http-${response.status}`,'Store artwork unavailable.')
  if (!response.body || !/^image\/(jpeg|png|webp|avif)(;|$)/i.test(response.headers.get('content-type') ?? '')) throw new ImagePipelineError('source-content-type','Store artwork unavailable.')
  if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) throw new ImagePipelineError('source-size','Store artwork unavailable.')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const {value,done} = await reader.read()
      if (done) break
      size += value.length
      if (size > MAX_IMAGE_BYTES) throw new Error('Store artwork exceeds the image size limit.')
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(()=>{}) }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length }
  const converted = await convertAvif(bytes,bindings,{preserveAvif:true})
  try { await writeVerifiedAvif(key,converted,bindings,{sourceUrl:url.href}) }
  catch { throw new ImagePipelineError('cache-write-verify','Store artwork cache unavailable.') }
  return bindings.MEDIA.get(key)
}
