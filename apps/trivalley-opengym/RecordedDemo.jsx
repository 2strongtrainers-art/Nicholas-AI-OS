import { useState } from 'react'
// Add only exercise-specific owner-recorded clips after Nick has reviewed both
// movement and captions. Empty registry is intentional: illustrations are not video.
export const RECORDED_DEMOS = Object.freeze({})
export default function RecordedDemo({ex}) {
 const [failed,setFailed]=useState(false), clip=RECORDED_DEMOS[ex?.id]
 if(!clip||clip.reviewedByNick!==true||!clip.captions||!/^https:\/\/video\.wixstatic\.com\//.test(clip.url)||!/^https:\/\/static\.wixstatic\.com\//.test(clip.captions))return null
 return <details className="tv-recorded-demo"><summary>Watch my demonstration</summary>{failed?<p>Video unavailable. Follow the written coaching notes or ask me for help.</p>:<video controls playsInline preload="none" poster={clip.poster||undefined} onError={()=>setFailed(true)} aria-label={'Nick demonstrates '+ex.n}><source src={clip.url} type="video/mp4"/><track kind="captions" src={clip.captions} srcLang="en" label="English" default/>Your browser cannot play this video.</video>}<p className="small muted">Recorded demonstration · Nick Kaplan. Video needs an internet connection.</p></details>
}
