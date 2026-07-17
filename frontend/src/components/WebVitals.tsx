'use client'

import { useReportWebVitals } from 'next/web-vitals'
import { reportWebVital } from '@/lib/vitals'

const TRACKED: ReadonlySet<string> = new Set(['LCP', 'CLS', 'INP'])

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (TRACKED.has(metric.name)) {
      reportWebVital(metric)
    }
  })

  return null
}
