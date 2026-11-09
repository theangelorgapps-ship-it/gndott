import { inspectTrustedAvif } from './trustedAvif'

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_MIGRATION_BYTES = 20 * 1024 * 1024
export const AVIF_CACHE_CONTROL = 'public, max-age=31536000, immutable'

export class ImagePipelineError extends Error {
  constructor(public readonly stage: string, message: string) { super(message); this.name = 'ImagePipelineError' }
}

export function imageType(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value)) return 'image/png'
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') return 'image/webp'
  if (bytes.length >= 16 && String.fromCharCode(...bytes.slice(4,8)) === 'ftyp') {
    const boxSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0)
    if (boxSize >= 16 && boxSize <= bytes.length) {
      for (let offset = 8; offset + 4 <= boxSize; offset += 4) {
        if (offset === 12) continue
        if (['avif','avis'].includes(String.fromCharCode(...bytes.slice(offset,offset+4)))) return 'image/avif'
      }
    }
  }
  throw new Error('Choose a JPEG, PNG, WebP or AVIF image.')
}

export async function sha256(bytes: Uint8Array | string) {
  const input = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', input as BufferSource))).map(n=>n.toString(16).padStart(2,'0')).join('')
}

export async function convertAvif(original: Uint8Array, bindings: any, options: {avatar?: boolean; migration?: boolean; preserveAvif?: boolean} = {}) {
  const limit = options.migration ? MAX_MIGRATION_BYTES : MAX_IMAGE_BYTES
  if (!original.byteLength || original.byteLength > limit) throw new Error('Image size exceeds the conversion limit.')
  const sourceType = imageType(original)
  if (!bindings.IMAGES) throw new Error('Image conversion is temporarily unavailable.')
  const source = new Blob([original as BlobPart])
  let details
  try { details = await bindings.IMAGES.info(source.stream()) }
  catch (error) {
    const reason = error && typeof error === 'object' && 'message' in error ? String(error.message) : ''
    if (options.preserveAvif && !options.avatar && sourceType === 'image/avif' && /IMAGES_INFO_ERROR 9516\b/.test(reason)) {
      // Only trusted external AVIF may use structural validation when Cloudflare's
      // decoder cannot handle its features. Uploads and owned media never use this path.
      details = inspectTrustedAvif(original)
    } else {
      // The image service receives bytes only: its error has no origin URL or credentials.
      console.warn('IMAGE_SOURCE_INFO_FAILED', {type:sourceType,reason:reason.slice(0,300) || 'Unknown image inspection failure'})
      throw new ImagePipelineError(`source-info-${sourceType.split('/')[1]}`, 'The source image could not be inspected.')
    }
  }
  if (!details.width || !details.height || details.width * details.height > (options.migration ? 100000000 : 25000000)) throw new Error('Image dimensions exceed the conversion limit.')
  // Store artwork may already be optimized AVIF. Validate its bytes and dimensions,
  // then retain them: AVIF re-encoding has stricter provider input/size restrictions.
  // This is opt-in for external artwork; avatar crop and normal uploads still transform.
  if (options.preserveAvif && !options.avatar && sourceType === 'image/avif') {
    return {bytes:original,width:details.width,height:details.height,sha256:await sha256(original)}
  }
  const output = await bindings.IMAGES.input(source.stream())
    // Cloudflare's AVIF encoder is limited to 1200px; larger requests silently fall back to WebP/JPEG.
    .transform(options.avatar ? {width:512,height:512,fit:'cover',gravity:'auto'} : {width:1200,height:1200,fit:'scale-down'})
    .output({format:'image/avif',quality:options.avatar ? 70 : 60,anim:false})
  const response = output.response()
  const outputType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? 'missing'
  if (!response.ok || outputType !== 'image/avif') {
    // Operational errors contain only response metadata, never source/image bytes or credentials.
    throw new Error(options.migration
      ? `AVIF output response rejected: status=${response.status}; contentType=${outputType}; resized=${response.headers.get('cf-resized') ?? 'missing'}`
      : 'This image could not be converted to AVIF.')
  }
  const converted = new Uint8Array(await response.arrayBuffer())
  let convertedType = 'unknown'
  try { convertedType = imageType(converted) } catch { /* Report a type failure without exposing image contents. */ }
  if (!converted.length || converted.length > limit || convertedType !== 'image/avif') throw new Error(options.migration
    ? `AVIF output bytes rejected: bytes=${converted.length}; detectedType=${convertedType}; contentType=${outputType}`
    : 'This image could not be converted to AVIF.')
  const verified = await bindings.IMAGES.info(new Blob([converted as BlobPart]).stream())
  if (!verified.width || !verified.height) throw new Error('The converted image could not be decoded.')
  return {bytes:converted,width:verified.width,height:verified.height,sha256:await sha256(converted)}
}

/** Read back the object before publishing its URL or removing a source. */
export async function writeVerifiedAvif(key: string, converted: Awaited<ReturnType<typeof convertAvif>>, bindings: any, metadata: Record<string,string> = {}) {
  await bindings.MEDIA.put(key,converted.bytes,{httpMetadata:{contentType:'image/avif',cacheControl:AVIF_CACHE_CONTROL},customMetadata:{...metadata,sha256:converted.sha256}})
  const stored = await bindings.MEDIA.get(key)
  if (!stored || stored.httpMetadata?.contentType !== 'image/avif') throw new Error('AVIF storage verification failed.')
  const bytes = new Uint8Array(await stored.arrayBuffer())
  if (imageType(bytes) !== 'image/avif' || await sha256(bytes) !== converted.sha256) throw new Error('AVIF storage verification failed.')
}

/** Convert once on write. Originals never enter MEDIA. */
export async function storeAvif(file: File, scope: string, avatar: boolean, bindings: any) {
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error('Choose an image smaller than 8 MB.')
  if (!bindings.IMAGES || !bindings.MEDIA) throw new Error('Image uploads are temporarily unavailable. Please try again later.')
  if (!/^[a-zA-Z0-9/_-]+$/.test(scope) || scope.includes('..')) throw new Error('Invalid image scope.')
  const original = new Uint8Array(await file.arrayBuffer())
  imageType(original)
  const digest = await sha256(original)
  const key = `uploads/${scope}/${avatar?'avatar-512-v2':'artwork-1200-v3'}-${digest}.avif`
  const existing = await bindings.MEDIA.head(key)
  if (existing?.httpMetadata?.contentType === 'image/avif' && existing.customMetadata?.sha256) return {url:`/media/${key}`,key}
  const converted = await convertAvif(original,bindings,{avatar})
  await writeVerifiedAvif(key,converted,bindings)
  return {url:`/media/${key}`,key}
}

export async function migratedAvifKey(sourceKey: string) {
  return `${sourceKey.startsWith('private/') ? 'private/' : ''}avif/v1/${await sha256(sourceKey)}.avif`
}

/** Original URLs remain valid after pruning; private objects are never exposed. */
export async function ownedAvifObject(key: string, bindings: any) {
  if (!key || key.startsWith('private/') || key.includes('..') || key.includes('\\')) return null
  if (key.endsWith('.avif')) return bindings.MEDIA.get(key)
  if (!/\.(jpe?g|png|webp)$/i.test(key)) return null
  const target = await migratedAvifKey(key)
  const cached = await bindings.MEDIA.get(target)
  if (cached?.httpMetadata?.contentType === 'image/avif' && cached.customMetadata?.sha256) return cached
  const original = await bindings.MEDIA.get(key)
  if (!original) return null
  if (original.size > MAX_MIGRATION_BYTES) throw new Error('Image size exceeds the conversion limit.')
  const converted = await convertAvif(new Uint8Array(await original.arrayBuffer()),bindings,{migration:true})
  await writeVerifiedAvif(target,converted,bindings,{sourceKey:key,sourceEtag:original.etag})
  return bindings.MEDIA.get(target)
}
