export function titleSlug(value: string) {
 return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,150).replace(/-$/,'') || 'title'
}
export function contentPath(item: {id:number;name?:string;slug?:string|null;type?:string|null}, base?:string) {
 const prefix=base||({movie:'/movie',teaching:'/teaching',tvshow:'/tv-show',video:'/video',episode:'/episode'}[item.type||'movie']||'/movie')
 const slug=item.slug||item.name ? titleSlug(item.slug||item.name!) : ''
 return `${prefix}/${slug ? (slug.endsWith(`-${item.id}`)?slug:`${slug}-${item.id}`) : item.id}`
}
export function contentIdFromPath(path:string) {const match=/^(?:[a-z0-9]+(?:-[a-z0-9]+)*-)?([1-9]\d*)$/.exec(path);const id=match?Number(match[1]):NaN;return Number.isSafeInteger(id)?id:NaN}
