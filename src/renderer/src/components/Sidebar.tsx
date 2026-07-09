import type { JSX, MouseEvent } from 'react'
import { useAppStore } from '../state/useAppStore'
import { bridge } from '../api/electronBridge'

export function Sidebar(): JSX.Element {
  const chats = useAppStore((s) => s.chats)
  const activeChatId = useAppStore((s) => s.activeChatId)
  const setChats = useAppStore((s) => s.setChats)
  const selectChat = useAppStore((s) => s.selectChat)
  const newChat = useAppStore((s) => s.newChat)

  async function handleSelect(chatId: string): Promise<void> {
    if (chatId === activeChatId) return
    const chat = await bridge.chats.get(chatId)
    if (chat) selectChat(chat.id, chat.messages)
  }

  async function handleDelete(e: MouseEvent, chatId: string): Promise<void> {
    e.stopPropagation()
    await bridge.chats.delete(chatId)
    const updated = await bridge.chats.list()
    setChats(updated)
    if (chatId === activeChatId) newChat()
  }

  return (
    <div className="sidebar">
      <button className="new-chat-button" onClick={newChat}>
        + New Chat
      </button>
      <div className="chat-list">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`chat-list-item ${chat.id === activeChatId ? 'active' : ''}`}
            onClick={() => handleSelect(chat.id)}
          >
            <span className="chat-list-title">{chat.title}</span>
            <button className="chat-delete-button" title="Delete chat" onClick={(e) => handleDelete(e, chat.id)}>
              ×
            </button>
          </div>
        ))}
        {chats.length === 0 && <div className="chat-list-empty">No chats yet</div>}
      </div>
    </div>
  )
}
