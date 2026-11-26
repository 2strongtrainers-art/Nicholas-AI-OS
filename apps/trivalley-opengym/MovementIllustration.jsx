import { useState } from 'react'
import { movementFor } from '../lib/tv-movement-illustrations.js'

// Reviewed, exercise-ID-specific likeness references. The portrait at the top
// of the workout is a real photo; these paired movement images are generated
// illustrations, not video recordings or proof of one-to-one biomechanics.
export default function MovementIllustration({ ex, collapsible = false, poster = false }) {
  const [failed, setFailed] = useState(null)
  const asset = movementFor(ex)
  if (!asset) return null
  const src = asset.url || './' + asset.path
  const crop = asset.cropHeight
  const imgStyle = crop ? {
    display: 'block', width: '100%', height: 'auto', maxHeight: 'none',
    position: 'absolute', top: -(asset.top / crop) * 100 + '%', left: 0
  } : undefined
  const image = <img src={src} alt={asset.alt} width={asset.width} height={asset.height}
    loading="lazy" decoding="async" onError={() => setFailed(src)} style={imgStyle} />
  const figure = <figure className={'tv-movement-figure' + (poster ? ' tv-movement-poster' : '')}
      data-testid="tv-movement-figure" data-exercise-id={asset.id}>
    {poster && <div className="tv-movement-poster-heading">
      <strong>START & FINISH POSITIONS</strong>
      <span>Train with Nick · visual reference</span>
    </div>}
    {failed === src ? <p role="status">Illustration unavailable. Use the written technique cues below.</p>
      : crop ? <div className="tv-movement-window"
          style={{position: 'relative', overflow: 'hidden', aspectRatio: asset.width / crop}}>
          {image}
        </div> : image}
    <div className="tv-movement-phases" role="group" aria-label={'Start and finish positions for ' + asset.name}>
      <span><strong>START</strong>{asset.leftLabel}</span>
      <span><strong>FINISH</strong>{asset.rightLabel}</span>
    </div>
    <figcaption>
      <span className="tv-movement-brand">TRIVALLEY.FIT · COACHED BY NICK KAPLAN</span>
      {!poster && <span className="tv-coach-cue"><strong>Technique cue</strong>{asset.steps[asset.steps.length - 1]}</span>}
      <span>AI-generated likeness illustration · two positions, not a video. Return with control.</span>
      {failed !== src && !crop && !poster && <a href={src} target="_blank" rel="noopener noreferrer">
        View larger illustration<span className="sr-only"> for {asset.name} (opens a new tab)</span>
      </a>}
    </figcaption>
  </figure>
  return collapsible && !poster
    ? <details className="tv-movement-reference"><summary>View setup & movement illustration</summary>{figure}</details>
    : figure
}
