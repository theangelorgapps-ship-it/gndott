import { createRoot } from 'react-dom/client'
import { useEffect, useRef, useState } from 'react'
import { createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { LibraryNoteEditor } from '../../src/components/LibraryNoteEditor'
import { TitlePeople } from '../../src/components/TitlePeople'

function PlayerNotes({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close() }, [])
  return <dialog ref={ref} aria-label="Fixture playback" style={{ background: '#111318', color: 'white', width: 'min(800px, 95vw)', maxHeight: '90dvh', border: 0, borderRadius: 24 }} onCancel={onClose}>
    <div ref={surface} style={{ background: '#111318', color: 'white' }}>
      <button onClick={onClose}>Close fixture playback</button>
      <button onClick={() => surface.current?.requestFullscreen()}>Enter fixture full screen</button>
      <LibraryNoteEditor noteKey="movie:2" title="Player reflection" />
    </div>
  </dialog>
}
function Fixture() {
  const [player, setPlayer] = useState(false)
  return <main style={{ maxWidth: 1100, margin: '0 auto', padding: '30px 12px' }}>
    <button onClick={() => setPlayer(true)}>Open fixture playback</button>
    <LibraryNoteEditor noteKey="journal:reflection" title="A reflection" />
    <TitlePeople cast={[
      { id: 1, name: 'Robert Brown', file_url: '/images/castcrew/actor/robert_brown.avif', designation: 'Speaker' },
      { id: 2, name: 'Megan Collins', file_url: '/images/castcrew/actor/megan_collins.avif', designation: 'Host' },
      { id: 3, name: 'Guest without portrait' },
    ]} locations={[{ id: 1, name: 'London gathering', address: 'London, United Kingdom' }]} />
    {player && <PlayerNotes onClose={() => setPlayer(false)} />}
  </main>
}
const root = createRootRoute({ component: Fixture })
const router = createRouter({ routeTree: root })
createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />)
