import '../queued-player.css'
import { getLibrary, saveLibraryVerse, type LibraryVerse } from '@/lib/library'
import { useEffect, useId, useState } from 'react'
import { BookOpen, Bookmark, Check, ChevronLeft, ChevronRight, RotateCw, Minus, Plus, X } from 'lucide-react'
import { getBibleBooks, getBibleChapter } from '../lib/bible'
import { BIBLE_VERSIONS, type BibleBook, type BibleChapter } from '../lib/bibleProvider'

const bookCache = new Map<string, BibleBook[]>()
const chapterCache = new Map<string, BibleChapter>()
export function BibleReader({initial}:{initial?:{version:string;book:string;chapter:number;verse?:number}}={}) {
  const id = useId()
  const [version, setVersion] = useState(initial?.version||'1')
  const [book, setBook] = useState(initial?.book||'JHN')
  const [chapter, setChapter] = useState(initial?.chapter||3)
  const [books, setBooks] = useState<BibleBook[]>([])
  const [passage, setPassage] = useState<BibleChapter | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [marks,setMarks]=useState<LibraryVerse[]>([])
  const [profileKey,setProfileKey]=useState<string|null>(null)
  const [selectedVerse,setSelectedVerse]=useState<number|null>(initial?.verse||null)
  const [saving,setSaving]=useState(false)
  const [readerStatus,setReaderStatus]=useState('')
  const [fontSize,setFontSize]=useState(18)
  useEffect(()=>{let live=true;getLibrary().then(data=>{if(live){setMarks(data.verses);setProfileKey(data.profileKey)}}).catch(()=>{if(live)setReaderStatus('Saved verses could not load. Reopen the Bible to try again.')});return()=>{live=false}},[])
  useEffect(()=>{setSelectedVerse(initial?.book===book&&initial?.chapter===chapter?initial?.verse||null:null)},[version,book,chapter])
  function markFor(number:number){return marks.find(m=>m.version===version&&m.book===book&&m.chapter===chapter&&m.verse===number)}
  async function markVerse(number:number,saved:boolean,highlight:string){
    if(saving)return;setSaving(true);setReaderStatus('')
    const verse=passage?.verses.find(v=>v.number===number);if(!verse){setSaving(false);return}
    const data={version,book,chapter,verse:number,book_name:books.find(b=>b.id===book)?.name||book,text:verse.text,saved,highlight,profileKey}
    try{await saveLibraryVerse({data});setMarks(previous=>[...previous.filter(m=>!(m.version===version&&m.book===book&&m.chapter===chapter&&m.verse===number)),{...data,saved:saved?1:0,updated_at:new Date().toISOString()}]);setReaderStatus(saved||highlight?'Saved to Highlights & Verses on your dashboard.':'Removed from your saved verses.')}catch(e){setReaderStatus(e instanceof Error?e.message:'Could not save this verse. Try again.')}finally{setSaving(false)}
  }

  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setPassage(null)
    const key = `${version}:${book}:${chapter}`
    void Promise.all([
      bookCache.has(version) ? Promise.resolve({ books: bookCache.get(version)!, error: null }) : getBibleBooks({ data: { version } }),
      chapterCache.has(key) ? Promise.resolve({ passage: chapterCache.get(key)!, error: null }) : getBibleChapter({ data: { version, book, chapter } }),
    ]).then(([index, reading]) => {
      if (!active) return
      if (index.books.length) { bookCache.set(version, index.books); setBooks(index.books) }
      if (reading.passage) {
        if (chapterCache.size >= 24) chapterCache.delete(chapterCache.keys().next().value!)
        chapterCache.set(key, reading.passage); setPassage(reading.passage)
      }
      setError(index.error || reading.error || '')
    }).catch(() => { if (active) setError('Unable to connect to the Bible service. Please try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [version, book, chapter, retry])
  useEffect(()=>{
    if(!loading && passage && initial?.verse && initial.book===book && initial.chapter===chapter) {
      const frame=requestAnimationFrame(()=>document.getElementById(`${id}-verse-${initial.verse}`)?.scrollIntoView({block:'nearest'}))
      return()=>cancelAnimationFrame(frame)
    }
  },[loading,passage,initial?.verse,book,chapter,id])
  const selected = books.find(item => item.id === book)
  return <section className="section detail-supplement bible-panel bible-reader" aria-labelledby={`${id}-heading`} data-lenis-prevent>
    <div className="bible-reader-heading"><BookOpen size={20} /><h2 id={`${id}-heading`}>Bible</h2><span>Read along</span></div>
    <div className="bible-reader-controls queued-bible-controls">
      <label htmlFor={`${id}-version`}><span id={`${id}-version-label`}>Translation</span><select aria-labelledby={`${id}-version-label`} id={`${id}-version`} value={version} onChange={event => setVersion(event.target.value)}>{BIBLE_VERSIONS.map(item => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
      <label htmlFor={`${id}-book`}><span id={`${id}-book-label`}>Book</span><select aria-labelledby={`${id}-book-label`} id={`${id}-book`} value={book} disabled={!books.length} onChange={event => { setBook(event.target.value); setChapter(1) }}>{books.length ? books.map(item => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="JHN">John</option>}</select></label>
      <label htmlFor={`${id}-chapter`}><span id={`${id}-chapter-label`}>Chapter</span><select aria-labelledby={`${id}-chapter-label`} id={`${id}-chapter`} value={chapter} disabled={!selected} onChange={event => setChapter(Number(event.target.value))}>{Array.from({ length: selected?.chapters || 3 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
    </div>
    <div className="reader-preferences"><span>Select a verse to save or highlight</span><button type="button" aria-label="Smaller reading text" disabled={fontSize<=16} onClick={()=>setFontSize(s=>s-1)}><Minus size={15}/></button><span aria-live="polite">Aa</span><button type="button" aria-label="Larger reading text" disabled={fontSize>=24} onClick={()=>setFontSize(s=>s+1)}><Plus size={15}/></button></div>
    <p className="reader-status" role="status">{readerStatus}</p>
    <div className="bible-reader-passage" aria-live="polite" aria-busy={loading}>
      {loading ? <p className="bible-loading">Loading {selected?.name || 'John'} {chapter}…</p> : <>
        {error && <div className="bible-reader-error" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value+1)}><RotateCw size={16} /> Try again</button></div>}
        {passage && <><h3>{selected?.name || book} {chapter}</h3><p className="bible-translation-name">{BIBLE_VERSIONS.find(item => item.id === passage.version)?.name}</p><div className="bible-reader-verses" style={{'--reading-size':`${fontSize}px`} as React.CSSProperties}>{passage.verses.map(verse => {
 const marked=markFor(verse.number), expanded=selectedVerse===verse.number
 return <div id={`${id}-verse-${verse.number}`} className="bible-verse-item" key={verse.number} data-highlight={marked?.highlight||undefined} data-saved={!!marked?.saved}><button type="button" className="bible-verse-select" aria-label={`Verse ${verse.number}: ${verse.text}`} aria-expanded={expanded} onClick={()=>setSelectedVerse(expanded?null:verse.number)}><sup>{verse.number}</sup>{verse.text}</button>{expanded&&<div className="verse-actions" role="group" aria-label={`Actions for verse ${verse.number}`}><button type="button" disabled={saving} onClick={()=>markVerse(verse.number,!marked?.saved,marked?.highlight||'')} aria-pressed={!!marked?.saved}>{marked?.saved?<Check size={15}/>:<Bookmark size={15}/>} {marked?.saved?'Saved':'Save verse'}</button>{(['gold','blue','rose','green'] as const).map(color=><button key={color} type="button" className="verse-color" style={{'--swatch':({gold:'#b79945',blue:'#4f90c3',rose:'#ba648f',green:'#5f9b74'})[color]} as React.CSSProperties} aria-label={`Highlight verse ${verse.number} ${color}`} aria-pressed={marked?.highlight===color} disabled={saving} onClick={()=>markVerse(verse.number,!!marked?.saved,marked?.highlight===color?'':color)}>{marked?.highlight===color&&<Check size={16}/>}</button>)}{marked?.highlight&&<button type="button" disabled={saving} onClick={()=>markVerse(verse.number,!!marked.saved,'')} aria-label="Remove highlight"><X size={14}/></button>}</div>}</div>
 })}</div></>}
      </>}
    </div>
    <nav className="bible-reader-navigation" aria-label="Bible chapters"><button type="button" disabled={chapter<=1 || loading} onClick={() => setChapter(value => value-1)}><ChevronLeft size={18} /> Previous</button><button type="button" disabled={!selected || chapter>=selected.chapters || loading} onClick={() => setChapter(value => value+1)}>Next chapter <ChevronRight size={18} /></button></nav>
  </section>
}
