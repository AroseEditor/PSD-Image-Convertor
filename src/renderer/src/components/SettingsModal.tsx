import { useState } from 'react'
import type { JSX } from 'react'
import { useAppStore } from '../state/useAppStore'
import { bridge } from '../api/electronBridge'
import type { ProviderId } from '@shared/types'

const PROVIDERS: { id: ProviderId; label: string; helpUrl: string }[] = [
  { id: 'gemini', label: 'Gemini (Google)', helpUrl: 'https://aistudio.google.com/apikey' },
  { id: 'openai', label: 'ChatGPT (OpenAI)', helpUrl: 'https://platform.openai.com/api-keys' },
  {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    helpUrl: 'https://console.anthropic.com/settings/keys'
  }
]

export function SettingsModal(): JSX.Element | null {
  const settingsOpen = useAppStore((s) => s.settingsOpen)
  const closeSettings = useAppStore((s) => s.closeSettings)
  const keyStatus = useAppStore((s) => s.keyStatus)
  const patchKeyStatus = useAppStore((s) => s.patchKeyStatus)
  const [drafts, setDrafts] = useState<Partial<Record<ProviderId, string>>>({})
  const [savingProvider, setSavingProvider] = useState<ProviderId | null>(null)

  if (!settingsOpen) return null

  async function handleSave(providerId: ProviderId): Promise<void> {
    const value = drafts[providerId]?.trim()
    if (!value) return
    setSavingProvider(providerId)
    try {
      await bridge.keys.save(providerId, value)
      patchKeyStatus(providerId, true)
      setDrafts((d) => ({ ...d, [providerId]: '' }))
    } finally {
      setSavingProvider(null)
    }
  }

  async function handleClear(providerId: ProviderId): Promise<void> {
    await bridge.keys.clear(providerId)
    patchKeyStatus(providerId, false)
  }

  return (
    <div className="modal-overlay" onClick={closeSettings}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>API Keys</h2>
        {PROVIDERS.map((p) => {
          const hasKey = keyStatus?.[p.id] ?? false
          return (
            <div className="key-row" key={p.id}>
              <label>
                <span className={`dot ${hasKey ? 'set' : ''}`} />
                {p.label} {hasKey ? '— key set' : '— no key set'}
              </label>
              <div className="row">
                <input
                  type="password"
                  placeholder={hasKey ? 'Enter a new key to replace it' : 'Paste API key'}
                  value={drafts[p.id] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                />
                <button
                  className="secondary"
                  disabled={!drafts[p.id]?.trim() || savingProvider === p.id}
                  onClick={() => handleSave(p.id)}
                >
                  Save
                </button>
                {hasKey && (
                  <button className="secondary" onClick={() => handleClear(p.id)}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          )
        })}
        <div className="modal-actions">
          <button onClick={closeSettings}>Done</button>
        </div>
      </div>
    </div>
  )
}
