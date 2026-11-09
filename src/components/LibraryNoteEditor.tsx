import {lazy,Suspense,useEffect,useId,useRef,useState} from 'react'
import {Download,Save,Undo2} from 'lucide-react'
import {getLibrary,saveLibraryNote} from '@/lib/library'
import {useTypingViewport} from '@/hooks/useTypingViewport'
import {PlayerLoading} from './PlayerLoading'
import {NoteSaveNotification,type NoteSaveNotice} from './NoteSaveNotification'
import '../player-chat-refinement.css'
import '../release2-experience.css'
const RichTextEditor=lazy(()=>import('./ui/rich-text-editor'))
const escape=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')
export function LibraryNoteEditor({noteKey,title,initialHtml,onSaved}:{noteKey:string;title:string;initialHtml?:string;onSaved?:()=>void}) {
 const panelRef=useRef<HTMLElement>(null)
 const [notice,setNotice]=useState<NoteSaveNotice|null>(null)
 useTypingViewport(panelRef)
 const headingId=useId(),[html,setHtml]=useState(initialHtml??''),[saved,setSaved]=useState(initialHtml??''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(initialHtml===undefined),[status,setStatus]=useState(''),[legacy,setLegacy]=useState(''),[signedIn,setSignedIn]=useState(false),[pdfBusy,setPdfBusy]=useState(false),[draftKey,setDraftKey]=useState(''),[profileKey,setProfileKey]=useState<string|null>(null)
 const dirty=html!==saved;const dirtyRef=useRef(dirty);dirtyRef.current=dirty
 useEffect(()=>{let live=true;getLibrary().then(data=>{if(!live)return;setSignedIn(data.signedIn);setProfileKey(data.profileKey);const note=data.notes.find(n=>n.note_key===noteKey);if(note){setHtml(note.html);setSaved(note.html)}try{const storageKey=`halobox-note-draft:${data.profileKey||'guest'}:${noteKey}`;setDraftKey(storageKey);const draft=localStorage.getItem(storageKey);if(draft!==null&&draft!==(note?.html||initialHtml||'')){setHtml(draft);setStatus('Restored your unsaved draft. Save it to your dashboard when ready.')}setLegacy(localStorage.getItem(`streamit-notes:${noteKey}`)||'')}catch{} }).catch(()=>{if(live)setStatus('Your library could not load. Please reopen Notes to try again.')}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[noteKey])
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirtyRef.current){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[])
 useEffect(()=>{if(!draftKey||loading)return;try{if(dirty)localStorage.setItem(draftKey,html);else localStorage.removeItem(draftKey)}catch{}},[draftKey,loading,html,dirty])
 async function save(){setBusy(true);setStatus('');setNotice(null);try{const result=await saveLibraryNote({data:{key:noteKey,title,html,profileKey}});setHtml(result.html);setSaved(result.html);setNotice({kind:'success',message:'Saved to My Notes on your dashboard.'});onSaved?.()}catch(e){setNotice({kind:'error',message:`${e instanceof Error?e.message:'Please try again.'} Your unsaved note is still here.`})}finally{setBusy(false)}}
 async function download(){setPdfBusy(true);try{const {downloadNotePdf}=await import('@/lib/notePdf');await downloadNotePdf(title,html);setStatus('Your PDF is ready.')}catch{setStatus('The PDF could not be created. Please try again.')}finally{setPdfBusy(false)}}
 return <section ref={panelRef} className="section detail-supplement notes-panel" aria-labelledby={headingId} data-lenis-prevent><div className="supplement-heading"><h2 id={headingId}>{noteKey.startsWith('journal:')?title:`Notes for ${title}`}</h2><p>{signedIn?'Private to your profile. Save your thoughts and find them in My Notes.':'Sign in and choose a profile to save your notes. You can still write and download a PDF.'}</p></div>
 {legacy&&<div className="notes-import">A previous note is available on this device.<button type="button" className="library-action" onClick={()=>{setHtml(html+`<p>${escape(legacy)}</p>`);setLegacy('');setStatus('Previous note added. Save to keep it in your profile.')}}>Import previous note</button></div>}
 <span className="notes-label">Your note {dirty&&<span className="note-unsaved">· Unsaved changes</span>}</span>
 {loading?<PlayerLoading label="Loading your note…"/>:<Suspense fallback={<PlayerLoading label="Opening editor…"/>}><RichTextEditor value={html} onValueChange={setHtml} placeholder="Write a thought, scripture, or moment to revisit…" disabled={busy}/></Suspense>}
 <div className="notes-actions"><button type="button" className="btn btn-play" disabled={busy||loading||!signedIn} onClick={save}><Save size={17}/>{busy?'Saving…':'Save note'}</button><button type="button" className="btn btn-dark" disabled={pdfBusy||loading||!html.replace(/<[^>]*>/g,'').trim()} onClick={download}><Download size={17}/>{pdfBusy?'Creating PDF…':'Download PDF'}</button><button type="button" className="btn btn-dark" disabled={!dirty||busy} onClick={()=>{setHtml(saved);setStatus('Restored your last saved note.')}}><Undo2 size={16}/>Revert changes</button></div><p className="notes-status" role="status">{status}</p>{notice&&<NoteSaveNotification notice={notice} onDismiss={()=>setNotice(null)}/>}</section>
}
