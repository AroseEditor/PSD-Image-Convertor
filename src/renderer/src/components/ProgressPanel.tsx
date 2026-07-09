import type { JSX } from 'react'
import { useAppStore } from '../state/useAppStore'

export function ProgressPanel(): JSX.Element | null {
  const phase = useAppStore((s) => s.phase)
  const progressLog = useAppStore((s) => s.progressLog)

  if (phase === 'idle' || progressLog.length === 0) return null

  return (
    <div className="progress-panel">
      {progressLog.map((event, i) => (
        <div key={i}>
          {event.message}
          {typeof event.percent === 'number' ? ` (${event.percent}%)` : ''}
        </div>
      ))}
    </div>
  )
}
