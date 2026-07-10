import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { Chat, ChatMessage, ChatSummary, LayerPlan, ProviderId } from '@shared/types'

function chatsFilePath(): string {
  return join(app.getPath('userData'), 'chats.json')
}

export function chatAssetDir(chatId: string): string {
  return join(app.getPath('userData'), 'chats', chatId)
}

async function readAll(): Promise<Chat[]> {
  try {
    const raw = await fs.readFile(chatsFilePath(), 'utf-8')
    return JSON.parse(raw) as Chat[]
  } catch {
    return []
  }
}

async function writeAll(chats: Chat[]): Promise<void> {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(chatsFilePath(), JSON.stringify(chats), 'utf-8')
}

export async function listChats(): Promise<ChatSummary[]> {
  const chats = await readAll()
  return chats
    .map(({ id, title, createdAt, updatedAt }) => ({ id, title, createdAt, updatedAt }))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export async function getChat(chatId: string): Promise<Chat | null> {
  const chats = await readAll()
  return chats.find((c) => c.id === chatId) ?? null
}

export async function createChat(
  title: string,
  firstUserMessageText: string,
  attachedImagePngBase64?: string
): Promise<Chat> {
  const now = new Date().toISOString()
  const chat: Chat = {
    id: randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [
      { id: randomUUID(), role: 'user', text: firstUserMessageText, createdAt: now, attachedImagePngBase64 }
    ]
  }
  const chats = await readAll()
  chats.push(chat)
  await writeAll(chats)
  await fs.mkdir(chatAssetDir(chat.id), { recursive: true })
  return chat
}

export async function appendUserMessage(
  chatId: string,
  text: string,
  attachedImagePngBase64?: string
): Promise<void> {
  const chats = await readAll()
  const chat = chats.find((c) => c.id === chatId)
  if (!chat) return
  chat.messages.push({
    id: randomUUID(),
    role: 'user',
    text,
    createdAt: new Date().toISOString(),
    attachedImagePngBase64
  })
  chat.updatedAt = new Date().toISOString()
  await writeAll(chats)
}

export async function appendAssistantMessage(
  chatId: string,
  message: Omit<ChatMessage, 'id' | 'role' | 'createdAt'>
): Promise<void> {
  const chats = await readAll()
  const chat = chats.find((c) => c.id === chatId)
  if (!chat) return
  chat.messages.push({
    id: randomUUID(),
    role: 'assistant',
    createdAt: new Date().toISOString(),
    ...message
  })
  chat.updatedAt = new Date().toISOString()
  await writeAll(chats)
}

export async function updateChatAssets(
  chatId: string,
  update: {
    lastLayerPlan?: LayerPlan
    layerAssetPaths?: Record<string, string>
    lastModelId?: string
    lastProviderId?: ProviderId
  }
): Promise<void> {
  const chats = await readAll()
  const chat = chats.find((c) => c.id === chatId)
  if (!chat) return
  Object.assign(chat, update)
  chat.updatedAt = new Date().toISOString()
  await writeAll(chats)
}

export async function deleteChat(chatId: string): Promise<void> {
  const chats = await readAll()
  const remaining = chats.filter((c) => c.id !== chatId)
  await writeAll(remaining)
  await fs.rm(chatAssetDir(chatId), { recursive: true, force: true }).catch(() => {})
}
