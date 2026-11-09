/** One spoken status; decorative shapes never become fake content or controls. */
export function PlayerLoading({ label, kind = 'note' }: { label: string; kind?: 'note' | 'chat' | 'video' }) {
  return <div className={`player-loading player-loading-${kind}`} role="status" aria-live="polite">
    <span className="chat-sr-only">{label}</span>
    <div className="player-loading-shapes" aria-hidden="true">
      {kind === 'video' ? <span className="player-shimmer player-loading-track" /> : <>
        <span className="player-shimmer player-loading-heading" />
        <span className="player-shimmer player-loading-line" />
        <span className="player-shimmer player-loading-line" />
        <span className="player-shimmer player-loading-line" />
      </>}
    </div>
  </div>
}
