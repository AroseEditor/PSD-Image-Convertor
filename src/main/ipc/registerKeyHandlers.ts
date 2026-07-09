import { ipcMain } from 'electron'
import { IPC } from '@shared/ipcChannels'
import type { ProviderId } from '@shared/types'
import { saveKey, clearKey, getStatus } from '../services/keyStore'

export function registerKeyHandlers(): void {
  ipcMain.handle(IPC.KEYS_SAVE, async (_e, provider: ProviderId, plaintext: string) => {
    await saveKey(provider, plaintext)
    return { ok: true as const }
  })

  ipcMain.handle(IPC.KEYS_CLEAR, async (_e, provider: ProviderId) => {
    await clearKey(provider)
    return { ok: true as const }
  })

  ipcMain.handle(IPC.KEYS_GET_STATUS, async () => {
    return getStatus()
  })
}
