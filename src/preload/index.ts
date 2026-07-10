import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipcChannels'
import type {
  Chat,
  ChatSummary,
  GenerationRequest,
  GenerationProgressEvent,
  GenerationPreviewEvent,
  GenerationCompleteEvent,
  GenerationErrorEvent,
  KeyStatus,
  ModelCatalog,
  ProviderId
} from '@shared/types'

const api = {
  keys: {
    save: (provider: ProviderId, key: string): Promise<{ ok: true }> =>
      ipcRenderer.invoke(IPC.KEYS_SAVE, provider, key),
    clear: (provider: ProviderId): Promise<{ ok: true }> =>
      ipcRenderer.invoke(IPC.KEYS_CLEAR, provider),
    getStatus: (): Promise<KeyStatus> => ipcRenderer.invoke(IPC.KEYS_GET_STATUS)
  },
  models: {
    listCatalog: (): Promise<ModelCatalog> => ipcRenderer.invoke(IPC.MODELS_LIST_CATALOG)
  },
  chats: {
    list: (): Promise<ChatSummary[]> => ipcRenderer.invoke(IPC.CHATS_LIST),
    get: (chatId: string): Promise<Chat | null> => ipcRenderer.invoke(IPC.CHATS_GET, chatId),
    delete: (chatId: string): Promise<{ ok: true }> => ipcRenderer.invoke(IPC.CHATS_DELETE, chatId)
  },
  system: {
    showInFolder: (filePath: string): Promise<{ ok: true }> =>
      ipcRenderer.invoke(IPC.SYSTEM_SHOW_IN_FOLDER, filePath),
    saveImageAs: (base64: string, suggestedName: string): Promise<{ ok: true; canceled: boolean; path?: string }> =>
      ipcRenderer.invoke(IPC.SYSTEM_SAVE_IMAGE_AS, base64, suggestedName),
    saveFileAs: (sourcePath: string, suggestedName: string): Promise<{ ok: true; canceled: boolean; path?: string }> =>
      ipcRenderer.invoke(IPC.SYSTEM_SAVE_FILE_AS, sourcePath, suggestedName)
  },
  generation: {
    submit: (req: GenerationRequest): Promise<{ jobId: string; chatId: string }> =>
      ipcRenderer.invoke(IPC.GENERATION_SUBMIT, req),
    cancel: (jobId: string): Promise<{ ok: true }> =>
      ipcRenderer.invoke(IPC.GENERATION_CANCEL, jobId),
    onProgress: (cb: (e: GenerationProgressEvent) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, payload: GenerationProgressEvent): void =>
        cb(payload)
      ipcRenderer.on(IPC.GENERATION_PROGRESS, listener)
      return () => ipcRenderer.removeListener(IPC.GENERATION_PROGRESS, listener)
    },
    onPreview: (cb: (e: GenerationPreviewEvent) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, payload: GenerationPreviewEvent): void =>
        cb(payload)
      ipcRenderer.on(IPC.GENERATION_PREVIEW_READY, listener)
      return () => ipcRenderer.removeListener(IPC.GENERATION_PREVIEW_READY, listener)
    },
    onComplete: (cb: (e: GenerationCompleteEvent) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, payload: GenerationCompleteEvent): void =>
        cb(payload)
      ipcRenderer.on(IPC.GENERATION_COMPLETE, listener)
      return () => ipcRenderer.removeListener(IPC.GENERATION_COMPLETE, listener)
    },
    onError: (cb: (e: GenerationErrorEvent) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, payload: GenerationErrorEvent): void =>
        cb(payload)
      ipcRenderer.on(IPC.GENERATION_ERROR, listener)
      return () => ipcRenderer.removeListener(IPC.GENERATION_ERROR, listener)
    }
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
