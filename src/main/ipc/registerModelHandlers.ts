import { ipcMain } from 'electron'
import { IPC } from '@shared/ipcChannels'
import { getCatalog } from '../services/modelCatalog/modelCatalog'

export function registerModelHandlers(): void {
  ipcMain.handle(IPC.MODELS_LIST_CATALOG, async () => {
    return getCatalog()
  })
}
