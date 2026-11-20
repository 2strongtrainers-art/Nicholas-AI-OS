import { useState } from 'react'
import { movementFor } from '../lib/tv-movement-illustrations.js'

export default function MovementIllustration({ ex, collapsible = false }) {
  const [failed, setFailed] = useState(null)
  const asset = movementFor(ex)
  if (!asset) return null
  const src = asset.url || './' + asset.path
  const image = <img src={src} alt={asset.alt} width={asset.width} height={asset.height} loading="lazy" decoding="async" onError={() => setFailed(src)} style={asset.cropHeight ? {display: 'block', width: '100%', height: 'auto', maxHeight: 'none', position: 'absolute', top: -(asset.top / asset.cropHeight) * 100 + '%', left: 0} : undefined} />
  const figure = <figure className="tv-movement-figure" data-testid="tv-movement-figure" data-exercise-id={asset.id}>
    {failed === src ? <p role="status">Illustration unavailable. Use the written technique cues below.</p>
      : asset.cropHeight ? <div className="tv-movement-window" style={{position: 'relative', overflow: 'hidden', aspectRatio: asset.width / asset.cropHeight}}>{image}</div> : image}
    <div className="tv-movement-phases" aria-hidden="true"><span>1 · {asset.leftLabel}</span><span>2 · {asset.rightLabel}</span></div>
    <figcaption><span className="tv-movement-brand">TRIVALLEY.FIT · COACHED BY NICK KAPLAN</span>
      <span className="tv-coach-cue"><strong>Technique cue</strong>{asset.steps[asset.steps.length - 1]}</span>
      <span>AI-generated likeness illustration · two positions, not a video. Return with control.</span>
      {failed !== src && !asset.cropHeight && <a href={src} target="_blank" rel="noopener noreferrer">View larger illustration<span className="sr-only"> for {asset.name} (opens a new tab)</span></a>}
    </figcaption>
  </figure>
  return collapsible ? <details className="tv-movement-reference"><summary>View setup & movement illustration</summary>{figure}</details> : figure
}
