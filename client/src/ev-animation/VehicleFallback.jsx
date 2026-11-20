import './VehicleFallback.css'

function Wheel({ position }) {
  return <div className={`ev-fallback-wheel ev-fallback-wheel-${position}`}>
    <span className="ev-fallback-wheel-inner" />
    <span className="ev-fallback-wheel-face"><i /></span>
  </div>
}

/** An original CSS model. All of its surfaces stay local and need no texture downloads. */
export function ElectricCar({ className = '', children }) {
  return <div className={`ev-fallback ev-fallback-car ${className}`} aria-hidden="true">
    <div className="ev-fallback-car-shadow" />
    <div className="ev-fallback-car-model">
      <div className="ev-fallback-car-floor" />
      <Wheel position="rear-far" />
      <Wheel position="front-far" />
      {children}
      <div className="ev-fallback-car-shell" data-ev-layer="body">
        <div className="ev-fallback-car-side ev-fallback-car-side-far" />
        <div className="ev-fallback-car-rear"><i /><i /></div>
        <div className="ev-fallback-car-deck" />
        <div className="ev-fallback-car-rear-glass" />
        <div className="ev-fallback-car-roof" />
        <div className="ev-fallback-car-glass ev-fallback-car-glass-far" />
        <div className="ev-fallback-car-windshield" />
        <div className="ev-fallback-car-hood"><i /></div>
        <div className="ev-fallback-car-front"><i /><i /><span /></div>
        <div className="ev-fallback-car-side ev-fallback-car-side-near">
          <span className="ev-fallback-car-door ev-fallback-car-door-rear" />
          <span className="ev-fallback-car-door ev-fallback-car-door-front" />
          <span className="ev-fallback-car-handle ev-fallback-car-handle-rear" />
          <span className="ev-fallback-car-handle ev-fallback-car-handle-front" />
          <span className="ev-fallback-car-sill" />
          <span className="ev-fallback-car-side-light" />
        </div>
        <div className="ev-fallback-car-glass ev-fallback-car-glass-near"><i /></div>
        <div className="ev-fallback-car-mirror"><i /></div>
      </div>
      <Wheel position="rear-near" />
      <Wheel position="front-near" />
    </div>
  </div>
}

