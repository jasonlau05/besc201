import { lazy, Suspense } from 'react'
import TeslaLoading from './TeslaLoading'

const TeslaScene = lazy(() => import('./TeslaScene'))

// Wait for the actual Tesla instead of flashing the older CSS vehicle while
// the renderer's module downloads.
export default function TeslaVisual({ interactive = false, className = '' }) {
  return <Suspense fallback={<TeslaLoading className={className} />}>
    <TeslaScene interactive={interactive} className={className} />
  </Suspense>
}
