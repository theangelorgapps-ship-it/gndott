export const MAX_IMAGE_BYTES=8*1024*1024
export function imageType(bytes:Uint8Array){
 if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return'image/jpeg'
 if(bytes[0]===137&&String.fromCharCode(...bytes.slice(1,4))==='PNG')return'image/png'
 if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return'image/webp'
 if(String.fromCharCode(...bytes.slice(4,8))==='ftyp'&&['avif','avis'].includes(String.fromCharCode(...bytes.slice(8,12))))return'image/avif'
 throw new Error('Choose a JPEG, PNG, WebP or AVIF image.')
}
/** Convert once on write and retain only the optimized bytes. Content hashes deduplicate retries. */
export async function storeAvif(file:File,scope:string,avatar:boolean,bindings:any){
 if(!file.size||file.size>MAX_IMAGE_BYTES)throw new Error('Choose an image smaller than 8 MB.')
 const original=new Uint8Array(await file.arrayBuffer());imageType(original)
 if(!bindings.IMAGES||!bindings.MEDIA)throw new Error('Image uploads are temporarily unavailable. Please try again later.')
 const details=await bindings.IMAGES.info(new Blob([original]).stream())
 if(!details.width||!details.height||details.width*details.height>25000000)throw new Error('Choose an image smaller than 25 megapixels.')
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',original))).map(n=>n.toString(16).padStart(2,'0')).join('')
 const key=`uploads/${scope}/${avatar?'avatar-512-v1':'artwork-1920-v1'}-${digest}.avif`
 if(await bindings.MEDIA.head(key))return {url:`/media/${key}`,key}
 const output=await bindings.IMAGES.input(new Blob([original]).stream()).transform(avatar?{width:512,height:512,fit:'cover',gravity:'auto'}:{width:1920,height:1920,fit:'scale-down'}).output({format:'image/avif',quality:avatar?70:65,anim:false})
 const response=output.response();if(!response.ok||response.headers.get('content-type')?.split(';')[0]!=='image/avif')throw new Error('This image could not be converted. Try a different photo.')
 const converted=await response.arrayBuffer();if(converted.byteLength>MAX_IMAGE_BYTES||imageType(new Uint8Array(converted))!=='image/avif')throw new Error('This image could not be converted to AVIF.')
 await bindings.MEDIA.put(key,converted,{httpMetadata:{contentType:'image/avif',cacheControl:'public, max-age=31536000, immutable'}})
 return {url:`/media/${key}`,key}
}
