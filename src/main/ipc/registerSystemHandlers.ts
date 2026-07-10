import { ipcMain, shell, dialog, BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { extname } from 'path'
import { IPC } from '@shared/ipcChannels'

interface SaveResult {
  ok: true
  canceled: boolean
  path?: string
}

function activeWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

export function registerSystemHandlers(): void {
  ipcMain.handle(IPC.SYSTEM_SHOW_IN_FOLDER, async (_e, filePath: string) => {
    shell.showItemInFolder(filePath)
    return { ok: true as const }
  })

  ipcMain.handle(IPC.SYSTEM_SAVE_IMAGE_AS, async (_e, base64: string, suggestedName: string): Promise<SaveResult> => {
    const win = activeWindow()
    const { canceled, filePath } = await dialog.showSaveDialog(win as BrowserWindow, {
      defaultPath: suggestedName,
      filters: [{ name: 'PNG Image', extensions: ['png'] }]
    })
    if (canceled || !filePath) return { ok: true, canceled: true }
    await fs.writeFile(filePath, Buffer.from(base64, 'base64'))
    return { ok: true, canceled: false, path: filePath }
  })

  ipcMain.handle(IPC.SYSTEM_SAVE_FILE_AS, async (_e, sourcePath: string, suggestedName: string): Promise<SaveResult> => {
    const win = activeWindow()
    const ext = extname(sourcePath).replace('.', '') || 'psd'
    const { canceled, filePath } = await dialog.showSaveDialog(win as BrowserWindow, {
      defaultPath: suggestedName,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
    })
    if (canceled || !filePath) return { ok: true, canceled: true }
    await fs.copyFile(sourcePath, filePath)
    return { ok: true, canceled: false, path: filePath }
  })
}
