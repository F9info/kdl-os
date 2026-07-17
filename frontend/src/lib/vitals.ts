// Minimal subset of the web-vitals Metric shape needed for telemetry.
interface VitalMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  id: string
  navigationType?: string
}

// Endpoint added in KDL-295. Stub: backend returns 204; real persistence is a
// follow-up observability task. Failures are intentionally silent.
const VITALS_ENDPOINT = '/api/vitals'

export function reportWebVital(metric: VitalMetric): void {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    url: typeof window !== 'undefined' ? window.location.pathname : undefined,
  })

  // sendBeacon is preferred: it survives page unload and doesn't block render.
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(VITALS_ENDPOINT, new Blob([body], { type: 'application/json' }))
  } else {
    fetch(VITALS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  }
}
