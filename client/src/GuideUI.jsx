import './ReadingPages.css'

export function ArrowIcon({ direction = 'right' }) {
  return <svg className={`reading-arrow reading-arrow-${direction}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
}

export function PageContents({ links }) {
  return <nav className="reading-contents" aria-label="On this page">
    <span>On this page</span>
    <div>{links.map(({ href, label }) => <a key={href} href={href}>{label}<ArrowIcon direction="down" /></a>)}</div>
  </nav>
}

export function RangeControl({ id, label, value, onChange, min, max, step = 1, unit }) {
  const displayValue = `${value} ${unit.trim()}`
  return <div className="guide-control">
    <label htmlFor={id}><span id={`${id}-label`}>{label}</span><output htmlFor={id}>{displayValue}</output></label>
    <input id={id} type="range" min={min} max={max} step={step} value={value}
      aria-labelledby={`${id}-label`} aria-valuetext={displayValue}
      style={{ '--range-progress': `${(value - min) / (max - min) * 100}%` }}
      onChange={event => onChange(Number(event.target.value))} />
  </div>
}
