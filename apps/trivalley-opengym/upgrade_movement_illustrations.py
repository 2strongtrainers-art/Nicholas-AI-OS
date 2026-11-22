#!/usr/bin/env python3
"""Integrate exact-ID original movement art without changing workout prescriptions."""
from pathlib import Path
import shutil
import sys
front=Path(sys.argv[1]).resolve()
assets=Path(__file__).resolve().parent
def edit(path,old,new):
    p=front/path
    text=p.read_text()
    if text.count(old)!=1: raise RuntimeError(f'{path}: expected one anchor: {old[:90]}')
    p.write_text(text.replace(old,new,1))
shutil.copyfile(assets/'tv-catalogue-art-batch2.mjs',front/'src/lib/tv-catalogue-art-batch2.mjs')
shutil.copyfile(assets/'tv-catalogue-art-abs-avatar.mjs',front/'src/lib/tv-catalogue-art-abs-avatar.mjs')
shutil.copyfile(assets/'tv-catalogue-art-core.mjs',front/'src/lib/tv-catalogue-art-core.mjs')
shutil.copyfile(assets/'tv-catalogue-art-batch9.mjs',front/'src/lib/tv-catalogue-art-batch9.mjs')
shutil.copyfile(assets/'tv-catalogue-art-batch10.mjs',front/'src/lib/tv-catalogue-art-batch10.mjs')
shutil.copyfile(assets/'tv-catalogue-art-batch11.mjs',front/'src/lib/tv-catalogue-art-batch11.mjs')
shutil.copyfile(assets/'tv-catalogue-art-batch12.mjs',front/'src/lib/tv-catalogue-art-batch12.mjs')
shutil.copyfile(assets/'tv-catalogue-art-batch13.mjs',front/'src/lib/tv-catalogue-art-batch13.mjs')
shutil.copyfile(assets/'tv-catalogue-art-batch14.mjs',front/'src/lib/tv-catalogue-art-batch14.mjs')
shutil.copyfile(assets/'MovementIllustration.jsx',front/'src/components/MovementIllustration.jsx')
shutil.copyfile(assets/'tv-movement-illustrations.mjs',front/'src/lib/tv-movement-illustrations.js')
shutil.copyfile(assets/'movement-illustrations.css',front/'src/movement-illustrations.css')
edit('src/main.jsx',"import './program-visuals.css'","import './program-visuals.css'\nimport './movement-illustrations.css'")
edit('src/lib/exercises.js',"import { EXDB }", "import { movementReferenceFor } from './tv-movement-illustrations.js'\nimport { EXDB }")
edit('src/lib/exercises.js','export const EXIDX = {}','// Reviewed English cues for this exact sixteen-exercise image set.\nEXDB.forEach(ex => { const art = movementReferenceFor(ex); if (art) ex.st = [...art.steps] })\nexport const EXIDX = {}')
edit('src/components/Media.jsx',"import Icon from './Icon.jsx'","import Icon from './Icon.jsx'\nimport MovementIllustration from './MovementIllustration.jsx'\nimport { movementFor, movementReferenceFor } from '../lib/tv-movement-illustrations.js'")
edit('src/components/Media.jsx','  return (\n    <div id={id}', '''  if (movementReferenceFor(ex)) return <div id={id} className={'exmedia tv-exercise-media tv-movement-media' + (mini ? ' mini' : '')}>
    {mini ? <div className="tv-mini-row"><strong>{ex.n}</strong><button type="button" className="tv-cue-toggle" onClick={toggle}>Show cues</button></div>
      : <><MovementIllustration ex={ex} /><div className="tv-ex-info"><strong>{ex.n}</strong>
        <ol className="tv-steps">{movementReferenceFor(ex).steps.map((step,i) => <li key={i}>{step}</li>)}</ol>
        {minimizable && <button type="button" className="tv-cue-toggle" onClick={toggle}>Hide cues</button>}</div></>}
  </div>
  return (
    <div id={id}''')
edit('src/components/Media.jsx',"<Icon name=\"dumbbell\" /></div>\n}","<Icon name=\"dumbbell\" />{movementFor(ex)?.path && <img className=\"tv-thumb-photo\" src={'./' + movementFor(ex).path} alt=\"\" loading=\"lazy\" width=\"56\" height=\"56\" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />}</div>\n}")
edit('src/components/WorkoutPoster.jsx',"import { useEffect, useState } from 'react'","import { useEffect, useState } from 'react'\nimport MovementIllustration from './MovementIllustration.jsx'")
edit('src/components/WorkoutPoster.jsx','    <ul className="tv-poster-sets" aria-label={ex.n + \' sets\'}>', '    <MovementIllustration ex={ex} poster />\n    <ul className="tv-poster-sets" aria-label={ex.n + \' sets\'}>')
edit('src/sheets.jsx','  const best = bestWeightFor(st, ex.id)\n  return <>\n    <h3 className="capitalize">{ex.n}</h3>\n    <Media ex={ex} />', '  const best = bestWeightFor(st, ex.id)\n  return <>\n    <div className="tv-exercise-detail-heading"><h3 className="capitalize">{ex.n}</h3><button type="button" className="btn" aria-label="Close exercise details" onClick={close}>Close</button></div>\n    <Media ex={ex} />')
print('Approved exact-ID start/finish illustrations shown in preview and active workout posters; details and thumbnails retained')
