import { createServerFn } from '@tanstack/react-start'
import { all, first, run } from './db'
import { getActiveViewer } from './viewer.server'
import { chapterInput } from './bibleProvider'
import sanitizeHtml from 'sanitize-html'

export type LibraryNote = { note_key: string; title: string; html: string; content_type: string | null; content_id: number | null; updated_at: string }
export type LibraryVerse = { version:string; book:string; chapter:number; verse:number; book_name:string; text:string; saved:number; highlight:string; updated_at:string }
export function cleanNote(html: unknown): string {
 if(typeof html !== 'string' || html.length>100000) throw new Error('Keep your note below 100,000 characters.')
 return sanitizeHtml(html,{allowedTags:['p','br','h1','h2','h3','strong','b','em','i','u','s','code','pre','blockquote','ul','ol','li','hr','mark','a'],allowedAttributes:{a:['href','target','rel'],p:['style'],h1:['style'],h2:['style'],h3:['style']},allowedSchemes:['https','http','mailto'],allowProtocolRelative:false,allowedStyles:{'*':{'text-align':[/^(left|right|center|justify)$/]}},transformTags:{a:sanitizeHtml.simpleTransform('a',{target:'_blank',rel:'noopener noreferrer'})}})
}
async function viewer() { const v=await getActiveViewer(); if(!v?.profileId) throw new Error('Sign in and choose a profile to save to your library.'); return {...v,profileId:v.profileId} }
function sameProfile(v:{userId:number;profileId:number}, expected:unknown) { if(expected!==undefined && expected!==`${v.userId}:${v.profileId}`) throw new Error('Your active profile changed. Reopen your library before saving. Your draft is still available.'); }
function key(value:unknown) { if(typeof value!=='string'||!/^(movie|teaching|tvshow|video|episode):[1-9]\d*$|^journal:[a-zA-Z0-9-]{6,64}$/.test(value)) throw new Error('Choose a valid note.'); return value }
export const getLibrary = createServerFn({method:'GET'}).handler(async()=>{
 const v=await getActiveViewer(); if(!v?.profileId) return {notes:[] as LibraryNote[],verses:[] as LibraryVerse[],signedIn:false,profileKey:null as string|null}
 const [notes,verses]=await Promise.all([all<LibraryNote>('SELECT note_key,title,html,content_type,content_id,updated_at FROM library_notes WHERE user_id=? AND profile_id=? ORDER BY updated_at DESC',v.userId,v.profileId),all<LibraryVerse>('SELECT version,book,chapter,verse,book_name,text,saved,highlight,updated_at FROM library_verses WHERE user_id=? AND profile_id=? ORDER BY updated_at DESC',v.userId,v.profileId)])
 return {notes,verses,signedIn:true,profileKey:`${v.userId}:${v.profileId}`}
})
export const saveLibraryNote = createServerFn({method:'POST'}).validator((d:{key:string;title:string;html:string;profileKey?:string|null})=>({key:key(d.key),title:String(d.title||'').trim().slice(0,240)||'Untitled note',html:cleanNote(d.html),profileKey:d.profileKey})).handler(async({data})=>{
 const v=await viewer(); sameProfile(v,data.profileKey); const [type,id]=data.key.split(':'); const title=data.title
 if(type!=='journal') {const table=type==='video'?'videos':type==='episode'?'episodes':'entertainments';const item=await first<any>(`SELECT name FROM ${table} WHERE id=? AND deleted_at IS NULL AND status=1${table==='entertainments'?' AND type=?':''}`,Number(id),...(table==='entertainments'?[type]:[]));if(!item) throw new Error('This title is no longer available.')}
 await run(`INSERT INTO library_notes(user_id,profile_id,note_key,title,html,content_type,content_id) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,profile_id,note_key) DO UPDATE SET title=excluded.title,html=excluded.html,updated_at=datetime('now')`,v.userId,v.profileId,data.key,title,data.html,type==='journal'?null:type,type==='journal'?null:Number(id))
 return {ok:true,html:data.html}
})
export const deleteLibraryNote = createServerFn({method:'POST'}).validator((d:{key:string;profileKey?:string|null})=>({key:key(d.key),profileKey:d.profileKey})).handler(async({data})=>{const v=await viewer();sameProfile(v,data.profileKey);await run('DELETE FROM library_notes WHERE user_id=? AND profile_id=? AND note_key=?',v.userId,v.profileId,data.key);return {ok:true}})
export const saveLibraryVerse = createServerFn({method:'POST'}).validator((d:{version:string;book:string;chapter:number;verse:number;book_name:string;text:string;saved:boolean;highlight:string;profileKey?:string|null})=>{
 const input=chapterInput(d); if(!Number.isInteger(d.verse)||d.verse<1||d.verse>176||!['','gold','blue','rose','green'].includes(d.highlight)||typeof d.saved!=='boolean'||typeof d.text!=='string'||!d.text.trim()||d.text.length>6000) throw new Error('Choose a valid verse.')
 return {...input,verse:d.verse,book_name:String(d.book_name).slice(0,80),text:d.text,saved:d.saved,highlight:d.highlight,profileKey:d.profileKey}
}).handler(async({data:d})=>{
 const v=await viewer();sameProfile(v,d.profileKey)
 if(!d.saved&&!d.highlight) await run('DELETE FROM library_verses WHERE user_id=? AND profile_id=? AND version=? AND book=? AND chapter=? AND verse=?',v.userId,v.profileId,d.version,d.book,d.chapter,d.verse)
 else await run(`INSERT INTO library_verses(user_id,profile_id,version,book,chapter,verse,book_name,text,saved,highlight) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,profile_id,version,book,chapter,verse) DO UPDATE SET saved=excluded.saved,highlight=excluded.highlight,text=excluded.text,updated_at=datetime('now')`,v.userId,v.profileId,d.version,d.book,d.chapter,d.verse,d.book_name,d.text,d.saved?1:0,d.highlight)
 return {ok:true}
})
