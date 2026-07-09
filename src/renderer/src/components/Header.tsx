import type { JSX } from 'react'
import { useAppStore } from '../state/useAppStore'

export function Header(): JSX.Element {
  const openSettings = useAppStore((s) => s.openSettings)

  return (
    <div className="header">
      <h1>PSD Image Generator</h1>
      <button className="secondary" onClick={openSettings}>
        Settings
      </button>
    </div>
  )
}
