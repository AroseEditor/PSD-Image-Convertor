import { ipcMain } from 'electron'
import { IPC } from '@shared/ipcChannels'
import { listChats, getChat, deleteChat } from '../services/chatStore'

export function registerChatHandlers(): void {
  ipcMain.handle(IPC.CHATS_LIST, async () => {
    return listChats()
  })

  ipcMain.handle(IPC.CHATS_GET, async (_e, chatId: string) => {
    return getChat(chatId)
  })

  ipcMain.handle(IPC.CHATS_DELETE, async (_e, chatId: string) => {
    await deleteChat(chatId)
    return { ok: true as const }
  })
}
