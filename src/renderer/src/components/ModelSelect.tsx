import type { JSX } from 'react'
import { useAppStore } from '../state/useAppStore'
import type { ProviderId } from '@shared/types'

const PROVIDER_ORDER: ProviderId[] = ['gemini', 'openai', 'anthropic']

export function ModelSelect(): JSX.Element | null {
  const catalog = useAppStore((s) => s.catalog)
  const selectedModelId = useAppStore((s) => s.selectedModelId)
  const setSelectedModelId = useAppStore((s) => s.setSelectedModelId)
  const keyStatus = useAppStore((s) => s.keyStatus)

  if (!catalog) return null

  return (
    <div className="model-select">
      <select
        value={selectedModelId ?? catalog.defaultModelId}
        onChange={(e) => setSelectedModelId(e.target.value)}
      >
        {PROVIDER_ORDER.map((providerId) => {
          const group = catalog.providers[providerId]
          if (!group) return null
          const hasKey = keyStatus?.[providerId] ?? false
          return (
            <optgroup key={providerId} label={group.label}>
              {group.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                  {!hasKey ? ' (no API key set)' : ''}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
    </div>
  )
}
