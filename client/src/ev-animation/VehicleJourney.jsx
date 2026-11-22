import { useEffect, useRef, useSyncExternalStore } from 'react'
import TeslaVisual from './TeslaVisual'
import { createVehicleMotion } from './vehicle-scroll.mjs'
import './VehicleJourney.css'

const motionPreference = '(prefers-reduced-motion: reduce)'
const subscribeMotion = listener => {
  const query = window.matchMedia(motionPreference)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}
const readMotion = () => window.matchMedia(motionPreference).matches

const stages = [
  { title: 'Vehicle body', text: 'The painted shell lifts from the electric platform, exposing the battery between the axles.' },
  { title: 'Battery pack', text: 'The sealed cover moves aside to reveal the pack, its power connections, and control electronics.' },
  { title: 'Battery modules', text: 'Modules separate from the enclosure, revealing groups of cells and the orange high-voltage connections.' },
  { title: 'Cells & cooling', text: 'Cells lift above the cooling plate. Its channels help manage heat as the battery charges and drives.' },
]

export default function VehicleJourney() {
  const sectionRef = useRef(null)
  const reduced = useSyncExternalStore(subscribeMotion, readMotion, () => false)
  useEffect(() => createVehicleMotion(sectionRef.current, { reduced }), [reduced])

  return <section ref={sectionRef} className="ev-journey" id="full-picture" data-ev-journey data-ev-step="0" data-motion={reduced ? 'paused' : 'running'} aria-labelledby="ev-journey-title">
    <div className="ev-journey-sticky">
      <div className="ev-journey-layout">
        <div className="ev-journey-copy">
          <h2 id="ev-journey-title"><span className="ev-journey-title">A closer look</span></h2>
          <p className="ev-journey-intro">Scroll to lift the body, open the pack, and look inside the battery.</p>
          <ol className="ev-journey-steps" aria-label="EV deconstruction sequence">
            {stages.map((stage, index) => <li key={stage.title} data-ev-step-item={index} aria-current={index === 0 ? 'step' : undefined}>
              <span className="ev-step-dot" aria-hidden="true" /><h3>{stage.title}</h3>
            </li>)}
          </ol>
          <div className="ev-journey-details">
            {stages.map((stage, index) => <p key={stage.title} data-ev-detail={index}>{stage.text}</p>)}
          </div>
        </div>
        <div className="ev-journey-stage"><TeslaVisual interactive /></div>
      </div>
    </div>
  </section>
}
