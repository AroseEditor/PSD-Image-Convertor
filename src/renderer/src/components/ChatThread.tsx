import type { JSX } from 'react'
import { useAppStore } from '../state/useAppStore'
import { bridge } from '../api/electronBridge'

export function ChatThread(): JSX.Element | null {
  const activeMessages = useAppStore((s) => s.activeMessages)

  if (activeMessages.length === 0) return null

  return (
    <div className="chat-thread">
      {activeMessages.map((message) => (
        <div key={message.id} className={`message ${message.role}`}>
          {message.role === 'user' ? (
            <div className="message-bubble">{message.text}</div>
          ) : (
            <div className="message-bubble assistant-bubble">
              {message.error ? (
                <div className="message-error">{message.error.message}</div>
              ) : (
                <>
                  <div>{message.text}</div>
                  {message.previewPngBase64 && (
                    <img
                      className="message-image"
                      src={`data:image/png;base64,${message.previewPngBase64}`}
                      alt="Generated"
                    />
                  )}
                  {message.psdPath && (
                    <button
                      className="secondary"
                      onClick={() => bridge.system.showInFolder(message.psdPath!)}
                    >
                      Show PSD in folder
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
