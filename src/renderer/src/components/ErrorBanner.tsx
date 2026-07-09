import type { JSX } from 'react'
import { useAppStore } from '../state/useAppStore'

export function ErrorBanner(): JSX.Element | null {
  const error = useAppStore((s) => s.error)
  const phase = useAppStore((s) => s.phase)

  if (phase !== 'error' || !error) return null

  return <div className="error-banner">{error.message}</div>
}
