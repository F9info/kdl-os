'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

// global-error wraps the root <html> element — it must render a complete HTML
// skeleton. The design system classes are unavailable here (providers haven't
// mounted), so we use minimal inline styles.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Fatal application error:', error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          textAlign: 'center',
          padding: '16px',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          backgroundColor: '#ffffff',
          color: '#111827',
        }}
      >
        <AlertTriangle style={{ width: 40, height: 40, color: '#dc2626' }} />
        <p style={{ fontWeight: 500, margin: 0 }}>Something went seriously wrong.</p>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', maxWidth: 400, margin: 0 }}>
          {error.message || 'An unexpected error occurred. Please refresh the page.'}
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: 8,
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            backgroundColor: '#111827',
            color: '#ffffff',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
