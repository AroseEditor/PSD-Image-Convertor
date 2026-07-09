import type { JSX } from 'react'
import { useAppStore } from '../state/useAppStore'

export function PreviewCanvas(): JSX.Element | null {
  const livePreviewDataUrl = useAppStore((s) => s.livePreviewDataUrl)
  const phase = useAppStore((s) => s.phase)

  if (!livePreviewDataUrl || phase !== 'running') return null

  return (
    <div className="preview-canvas">
      <img src={`data:image/png;base64,${livePreviewDataUrl}`} alt="Generating preview" />
    </div>
  )
}
