import { ipcMain, shell } from 'electron'
import { IPC } from '@shared/ipcChannels'

export function registerSystemHandlers(): void {
  ipcMain.handle(IPC.SYSTEM_SHOW_IN_FOLDER, async (_e, filePath: string) => {
    shell.showItemInFolder(filePath)
    return { ok: true as const }
  })
}
