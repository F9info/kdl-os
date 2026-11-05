'use client'

import { Component, type ReactNode } from 'react'

// Shows `fallback` instead of crashing the page when a preview child throws
// (a block that errors, or the lazy block bundle failing to load).
export class PreviewBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
