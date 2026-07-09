import type { JSX } from 'react'
import { useAppStore } from '../state/useAppStore'
import { bridge } from '../api/electronBridge'
import { providerOfModel } from '../lib/catalogUtils'

export function PromptBox(): JSX.Element {
  const prompt = useAppStore((s) => s.prompt)
  const setPrompt = useAppStore((s) => s.setPrompt)
  const selectedModelId = useAppStore((s) => s.selectedModelId)
  const catalog = useAppStore((s) => s.catalog)
  const keyStatus = useAppStore((s) => s.keyStatus)
  const phase = useAppStore((s) => s.phase)
  const activeChatId = useAppStore((s) => s.activeChatId)
  const startGeneration = useAppStore((s) => s.startGeneration)
  const failGeneration = useAppStore((s) => s.failGeneration)
  const openSettings = useAppStore((s) => s.openSettings)
  const setActiveChatId = useAppStore((s) => s.setActiveChatId)
  const appendOptimisticUserMessage = useAppStore((s) => s.appendOptimisticUserMessage)
  const setChats = useAppStore((s) => s.setChats)

  const modelId = selectedModelId ?? catalog?.defaultModelId ?? ''
  const providerId = catalog ? providerOfModel(catalog, modelId) : undefined
  const hasKey = providerId ? (keyStatus?.[providerId] ?? false) : false
  const isRunning = phase === 'running'
  const isEditTurn = !!activeChatId

  async function handleGenerate(): Promise<void> {
    const trimmed = prompt.trim()
    if (!trimmed || !providerId) return
    if (!hasKey) {
      openSettings()
      return
    }
    startGeneration()
    appendOptimisticUserMessage(trimmed)
    setPrompt('')
    try {
      const { chatId } = await bridge.generation.submit({
        prompt: trimmed,
        modelId,
        providerId,
        chatId: activeChatId ?? undefined
      })
      if (!activeChatId) setActiveChatId(chatId)
      bridge.chats.list().then(setChats)
    } catch (err) {
      failGeneration({
        code: 'unknown',
        message: err instanceof Error ? err.message : 'Failed to start generation',
        retryable: true,
        providerId
      })
    }
  }

  return (
    <div className="prompt-box">
      <textarea
        placeholder={
          isEditTurn
            ? 'Describe an edit… e.g. make the pen red'
            : 'Describe an image… e.g. a person writing a letter'
        }
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={isRunning}
      />
      <button onClick={handleGenerate} disabled={isRunning || !prompt.trim()}>
        {isRunning ? 'Generating…' : isEditTurn ? 'Send edit' : 'Generate'}
      </button>
    </div>
  )
}
