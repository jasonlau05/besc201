import { useLayoutEffect, useRef } from 'react'
import { ElectricCar } from './VehicleFallback'
import { vehicleJourneyPose } from './vehicle-journey-motion.mjs'
import './VehicleAssembly.css'
import './VehicleFit.css'

function BatteryModule({ column, row }) {
  return <div className="ev-assembly-module" data-ev-layer="modules" style={{ '--module-column': column, '--module-row': row, '--module-x': column - 1.5, '--module-y': row - .5 }}>
    <div className="ev-assembly-module-base" />
    <div className="ev-assembly-module-front" />
    <div className="ev-assembly-module-side" />
    {[0, 1].map(cellRow => <div className="ev-assembly-cell-row" data-ev-layer="cells" key={cellRow} style={{ '--cell-row': cellRow }}>
      {[0, 1, 2].map(cell => <span className="ev-assembly-cell" key={cell}><b /><i /><em /></span>)}
    </div>)}
    <div className="ev-assembly-module-terminal"><i /><i /></div>
  </div>
}

/** One coordinate system keeps the vehicle, pack and cells physically aligned. */
export default function VehicleAssembly({ className = '' }) {
  const fitRef = useRef(null)
  useLayoutEffect(() => {
    const host = fitRef.current
    const car = host.firstElementChild
    const journey = host.closest('[data-ev-journey]')
    const renderer = host.closest('.tesla-scene')
    let frame = 0, scale = 1, x = 0, y = 0
    let fixed = null
    const parts = [...car.querySelectorAll('*')].filter(part => !part.matches('.ev-fallback-car-model, .ev-fallback-car-shell, .ev-fallback-car-shadow'))
    const modules = [...car.querySelectorAll('[data-ev-layer="modules"]')]
    const geometry = { bodyLift: '--ev-body-lift', batteryDrop: '--ev-battery-drop', coverLift: '--ev-cover-lift', moduleSpread: '--ev-module-spread', cellSpread: '--ev-cell-spread', turn: '--ev-turn', viewTilt: '--ev-view-tilt' }
    const measure = bounds => {
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
      for (const part of parts) {
        const rect = part.getBoundingClientRect()
        if (!rect.width && !rect.height) continue
        left = Math.min(left, (rect.left - bounds.left - x) / scale)
        right = Math.max(right, (rect.right - bounds.left - x) / scale)
        top = Math.min(top, (rect.top - bounds.top - y) / scale)
        bottom = Math.max(bottom, (rect.bottom - bounds.top - y) / scale)
      }
      const centerX = modules.reduce((sum, part) => { const rect = part.getBoundingClientRect(); return sum + ((rect.left + rect.right) / 2 - bounds.left - x) / scale }, 0) / modules.length
      const moduleY = modules.reduce((sum, part) => { const rect = part.getBoundingClientRect(); return sum + ((rect.top + rect.bottom) / 2 - bounds.top - y) / scale }, 0) / modules.length
      return { left, right, top, bottom, centerX, moduleY }
    }
    const fit = () => {
      frame = 0
      if (renderer && renderer.dataset.renderer !== 'fallback') return
      const bounds = host.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      const desktop = window.matchMedia('(min-width: 761px)').matches
      if (!fixed || fixed.width !== bounds.width || fixed.height !== bounds.height || fixed.desktop !== desktop) {
        // Measure all poses only when the viewport changes. Scrolling then uses
        // the same scale, with a small margin between sampled CSS rotations.
        scale = 1; x = 0; y = 0
        car.style.transform = 'none'
        let halfWidth = 0, halfHeight = 0
        for (let step = 0; step <= 32; step++) {
          const pose = vehicleJourneyPose(step / 32)
          for (const [field, property] of Object.entries(geometry)) car.style.setProperty(property, `${pose[field]}${field === 'turn' || field === 'viewTilt' ? 'deg' : 'px'}`)
          const frameBounds = measure(bounds)
          halfWidth = Math.max(halfWidth, frameBounds.centerX - frameBounds.left, frameBounds.right - frameBounds.centerX)
          const assemblyY = (frameBounds.top + frameBounds.bottom) / 2
          for (const centerY of desktop ? [assemblyY, frameBounds.moduleY] : [assemblyY]) halfHeight = Math.max(halfHeight, centerY - frameBounds.top, frameBounds.bottom - centerY)
        }
        for (const property of Object.values(geometry)) car.style.removeProperty(property)
        fixed = { width: bounds.width, height: bounds.height, desktop, scale: Math.min(1, bounds.width * .89 / (2 * halfWidth), bounds.height * .89 / (2 * halfHeight)) }
      }
      const { top, bottom, centerX, moduleY } = measure(bounds)
      const bodyFade = journey ? Number.parseFloat(getComputedStyle(journey).getPropertyValue('--ev-body-fade')) : 1
      const focus = desktop ? 1 - Math.min(1, Math.max(0, ((Number.isFinite(bodyFade) ? bodyFade : 1) - .08) / .92)) : 0
      const centerY = (top + bottom) / 2 * (1 - focus) + moduleY * focus
      scale = fixed.scale
      x = bounds.width / 2 - centerX * scale
      y = bounds.height / 2 - centerY * scale
      car.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
      host.dataset.fittedScale = String(scale)
      host.dataset.fittedProgress = journey ? getComputedStyle(journey).getPropertyValue('--ev-progress').trim() : '0'
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(fit) }
    const resize = new ResizeObserver(schedule)
    resize.observe(host)
    const pose = new MutationObserver(schedule)
    if (journey) pose.observe(journey, { attributes: true, attributeFilter: ['style'] })
    if (renderer) pose.observe(renderer, { attributes: true, attributeFilter: ['data-renderer'] })
    schedule()
    return () => { cancelAnimationFrame(frame); resize.disconnect(); pose.disconnect() }
  }, [])

  return <div ref={fitRef} className="ev-assembly-fit"><ElectricCar className={`ev-assembly ${className}`}>
    <div className="ev-assembly-axle ev-assembly-axle-rear" />
    <div className="ev-assembly-axle ev-assembly-axle-front" />
    <div className="ev-assembly-pack" data-ev-layer="battery">
      <div className="ev-assembly-cooling" data-ev-layer="cooling"><i /><span /><b /></div>
      <div className="ev-assembly-tray">
        <div className="ev-assembly-tray-front" />
        <div className="ev-assembly-tray-side" />
        <div className="ev-assembly-busbar"><i /><i /></div>
        {Array.from({ length: 8 }, (_, index) => <BatteryModule key={index} column={index % 4} row={Math.floor(index / 4)} />)}
        <span className="ev-assembly-connector ev-assembly-connector-a" />
        <span className="ev-assembly-connector ev-assembly-connector-b" />
      </div>
      <div className="ev-assembly-cover" data-ev-layer="cover"><span /><i /><b /></div>
      <div className="ev-assembly-electronics" data-ev-layer="electronics"><i /><span /><b /><em /></div>
    </div>
  </ElectricCar></div>
}
