const CONTENT_BASES: Record<string, string> = {
 movie: '/sermon', teaching: '/teachings', tvshow: '/shows', video: '/videos', episode: '/episode',
}
const LEGACY_BASES: Record<string, string> = {
 '/movie': '/sermon', '/teaching': '/teachings', '/tv-show': '/shows', '/video': '/videos',
}

/** Public paths are independent of the migrated database's content types. */
export function canonicalContentURL(location: { pathname: string; searchStr: string; hash: string }) {
 const pathname = location.pathname.replace(/^\/(movie|teaching|tv-show|video)(?=\/)/, base => LEGACY_BASES[base])
 return pathname + location.searchStr + (location.hash ? '#' + location.hash.replace(/^#/, '') : '')
}

export function titleSlug(value: string) {
 return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,150).replace(/-$/,'') || 'title'
}
export function contentPath(item: {id:number;name?:string;slug?:string|null;type?:string|null}, base?:string) {
 const prefix = base ? (LEGACY_BASES[base] || base) : (CONTENT_BASES[item.type || 'movie'] || '/sermon')
 const slug=item.slug||item.name ? titleSlug(item.slug||item.name!) : ''
 return `${prefix}/${slug ? (slug.endsWith(`-${item.id}`)?slug:`${slug}-${item.id}`) : item.id}`
}
export function contentIdFromPath(path:string) {const match=/^(?:[a-z0-9]+(?:-[a-z0-9]+)*-)?([1-9]\d*)$/.exec(path);const id=match?Number(match[1]):NaN;return Number.isSafeInteger(id)?id:NaN}
