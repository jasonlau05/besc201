const clamp = value => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
const ease = (value, start, end) => {
  const t = clamp((value - start) / (end - start))
  return t * t * (3 - 2 * t)
}

// Progress is distance travelled through the sticky scene, independent of the
// viewport size or frame rate. Each component has its own disassembly window.
export function vehicleJourneyProgress(top, height, viewport) {
  return clamp(-top / Math.max(1, height - viewport))
}

export function vehicleJourneyPose(value) {
  const progress = clamp(value)
  const bodyFocus = 1 - ease(progress, .19, .27)
  const packFocus = ease(progress, .19, .27) * (1 - ease(progress, .46, .54))
  const moduleFocus = ease(progress, .46, .54) * (1 - ease(progress, .72, .80))
  const cellFocus = ease(progress, .72, .80)
  return {
    progress,
    step: progress < .23 ? 0 : progress < .5 ? 1 : progress < .76 ? 2 : 3,
    bodyLift: 40 * ease(progress, .04, .39),
    bodyFade: .08 + .92 * bodyFocus,
    chassisFade: .12 + .88 * bodyFocus,
    packFade: .12 + .88 * packFocus,
    coverFade: .08 + .92 * packFocus * (1 - ease(progress, .30, .48)),
    moduleFade: .12 + .88 * moduleFocus,
    cellFade: .12 + .88 * cellFocus,
    coolingFade: .12 + .88 * cellFocus,
    batteryDrop: 8 * ease(progress, .12, .5),
    coverLift: 24 * ease(progress, .3, .65),
    moduleSpread: 34 * ease(progress, .49, .82),
    cellSpread: 18 * ease(progress, .68, .96),
    turn: -180 * progress,
    viewTilt: 10 * ease(progress, .2, .85),
  }
}

export function paintVehicleJourney(element, pose) {
  const variables = {
    '--ev-progress': pose.progress.toFixed(4),
    '--ev-body-lift': `${pose.bodyLift.toFixed(2)}px`,
    '--ev-body-fade': pose.bodyFade.toFixed(4),
    '--ev-chassis-fade': pose.chassisFade.toFixed(4),
    '--ev-pack-fade': pose.packFade.toFixed(4),
    '--ev-cover-fade': pose.coverFade.toFixed(4),
    '--ev-module-fade': pose.moduleFade.toFixed(4),
    '--ev-cell-fade': pose.cellFade.toFixed(4),
    '--ev-cooling-fade': pose.coolingFade.toFixed(4),
    '--ev-battery-drop': `${pose.batteryDrop.toFixed(2)}px`,
    '--ev-cover-lift': `${pose.coverLift.toFixed(2)}px`,
    '--ev-module-spread': `${pose.moduleSpread.toFixed(2)}px`,
    '--ev-cell-spread': `${pose.cellSpread.toFixed(2)}px`,
    '--ev-turn': `${pose.turn.toFixed(2)}deg`,
    '--ev-view-tilt': `${pose.viewTilt.toFixed(2)}deg`,
  }
  for (const [name, value] of Object.entries(variables)) element.style.setProperty(name, value)
  element.dataset.evStep = String(pose.step)
  for (const item of element.querySelectorAll('[data-ev-step-item]')) {
    if (Number(item.dataset.evStepItem) === pose.step) item.setAttribute('aria-current', 'step')
    else item.removeAttribute('aria-current')
  }
}
