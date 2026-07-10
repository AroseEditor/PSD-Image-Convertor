import { useRef, useState } from 'react'
import type { ClipboardEvent, DragEvent, JSX } from 'react'
import { useAppStore } from '../state/useAppStore'
import { bridge } from '../api/electronBridge'
import { providerOfModel } from '../lib/catalogUtils'
import { fileToAttachment } from '../lib/fileToAttachment'

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
  const attachedImage = useAppStore((s) => s.attachedImage)
  const setAttachedImage = useAppStore((s) => s.setAttachedImage)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const modelId = selectedModelId ?? catalog?.defaultModelId ?? ''
  const providerId = catalog ? providerOfModel(catalog, modelId) : undefined
  const hasKey = providerId ? (keyStatus?.[providerId] ?? false) : false
  const isRunning = phase === 'running'
  const isEditTurn = !!activeChatId

  async function attachFile(file: File | undefined | null): Promise<void> {
    if (!file || !file.type.startsWith('image/')) return
    setAttachedImage(await fileToAttachment(file))
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>): void {
    const item = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'))
    if (!item) return
    e.preventDefault()
    attachFile(item.getAsFile())
  }

  function handleDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    setIsDragOver(false)
    attachFile(e.dataTransfer.files?.[0])
  }

  async function handleGenerate(): Promise<void> {
    const trimmed = prompt.trim()
    if (!trimmed || !providerId) return
    if (!hasKey) {
      openSettings()
      return
    }
    startGeneration()
    appendOptimisticUserMessage(trimmed, attachedImage?.dataUrl ? attachedImage.base64 : undefined)
    setPrompt('')
    const attachmentToSend = attachedImage
    setAttachedImage(null)
    try {
      const { chatId } = await bridge.generation.submit({
        prompt: trimmed,
        modelId,
        providerId,
        chatId: activeChatId ?? undefined,
        attachedImage: attachmentToSend
          ? { base64: attachmentToSend.base64, mimeType: attachmentToSend.mimeType }
          : undefined
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
    <div
      className={`prompt-box ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="prompt-box-main">
        {attachedImage && (
          <div className="attachment-chip">
            <img src={attachedImage.dataUrl} alt="Attached" />
            <button className="attachment-remove" onClick={() => setAttachedImage(null)}>
              ×
            </button>
          </div>
        )}
        <textarea
          placeholder={
            attachedImage
              ? 'Describe the change you want… e.g. make the sky red'
              : isEditTurn
                ? 'Describe an edit… e.g. make the pen red'
                : 'Describe an image, or paste/drag one in to edit it…'
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onPaste={handlePaste}
          disabled={isRunning}
        />
      </div>
      <div className="prompt-box-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => attachFile(e.target.files?.[0])}
        />
        <button
          className="secondary attach-button"
          title="Attach an image"
          onClick={() => fileInputRef.current?.click()}
          disabled={isRunning}
        >
          Attach
        </button>
        <button onClick={handleGenerate} disabled={isRunning || !prompt.trim()}>
          {isRunning ? 'Generating…' : attachedImage ? 'Send edit' : isEditTurn ? 'Send edit' : 'Generate'}
        </button>
      </div>
    </div>
  )
}
