import './TeslaLoading.css'

export default function TeslaLoading({ className = '' }) {
  return <div className={`tesla-loading ${className}`} role="status">Loading Tesla model…</div>
}
