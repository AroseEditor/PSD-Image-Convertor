import type { JSX } from 'react'
import { useAppStore } from '../state/useAppStore'
import { bridge } from '../api/electronBridge'

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

export function ChatThread(): JSX.Element | null {
  const activeMessages = useAppStore((s) => s.activeMessages)

  if (activeMessages.length === 0) return null

  return (
    <div className="chat-thread">
      {activeMessages.map((message) => (
        <div key={message.id} className={`message ${message.role}`}>
          {message.role === 'user' ? (
            <div className="message-bubble">
              {message.attachedImagePngBase64 && (
                <img
                  className="message-attached-thumb"
                  src={`data:image/png;base64,${message.attachedImagePngBase64}`}
                  alt="Attached"
                />
              )}
              {message.text}
            </div>
          ) : (
            <div className="message-bubble assistant-bubble">
              {message.error ? (
                <div className="message-error">{message.error.message}</div>
              ) : (
                <>
                  <div>{message.text}</div>
                  {message.previewPngBase64 && (
                    <>
                      <img
                        className="message-image"
                        src={`data:image/png;base64,${message.previewPngBase64}`}
                        alt="Generated"
                      />
                      <button
                        className="secondary"
                        onClick={() => bridge.system.saveImageAs(message.previewPngBase64!, `${message.id}.png`)}
                      >
                        Download image
                      </button>
                    </>
                  )}
                  {message.psdPath && (
                    <div className="file-attachment">
                      <div className="file-attachment-icon">PSD</div>
                      <div className="file-attachment-info">
                        <div className="file-attachment-name">{fileNameFromPath(message.psdPath)}</div>
                        <div className="file-attachment-actions">
                          <button
                            className="link-button"
                            onClick={() =>
                              bridge.system.saveFileAs(message.psdPath!, fileNameFromPath(message.psdPath!))
                            }
                          >
                            Download
                          </button>
                          <button className="link-button" onClick={() => bridge.system.showInFolder(message.psdPath!)}>
                            Show in folder
                          </button>
                        </div>
                      </div>
                    </div>
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
