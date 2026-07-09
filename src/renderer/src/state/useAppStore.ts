import { create } from 'zustand'
import type {
  ChatMessage,
  ChatSummary,
  GenerationProgressEvent,
  KeyStatus,
  ModelCatalog,
  NormalizedError,
  ProviderId
} from '@shared/types'

export type GenerationPhase = 'idle' | 'running' | 'done' | 'error'

interface AppState {
  catalog: ModelCatalog | null
  keyStatus: KeyStatus | null
  selectedModelId: string | null
  prompt: string
  settingsOpen: boolean

  chats: ChatSummary[]
  activeChatId: string | null
  activeMessages: ChatMessage[]

  phase: GenerationPhase
  progressLog: GenerationProgressEvent[]
  livePreviewDataUrl: string | null
  error: NormalizedError | null

  setCatalog: (catalog: ModelCatalog) => void
  setKeyStatus: (status: KeyStatus) => void
  patchKeyStatus: (provider: ProviderId, hasKey: boolean) => void
  setSelectedModelId: (modelId: string) => void
  setPrompt: (prompt: string) => void
  openSettings: () => void
  closeSettings: () => void

  setChats: (chats: ChatSummary[]) => void
  selectChat: (chatId: string, messages: ChatMessage[]) => void
  newChat: () => void
  setActiveChatId: (chatId: string) => void
  setActiveMessages: (messages: ChatMessage[]) => void
  appendOptimisticUserMessage: (text: string) => void

  startGeneration: () => void
  addProgress: (event: GenerationProgressEvent) => void
  setLivePreview: (dataUrl: string) => void
  completeGeneration: () => void
  failGeneration: (error: NormalizedError) => void
}

export const useAppStore = create<AppState>((set) => ({
  catalog: null,
  keyStatus: null,
  selectedModelId: null,
  prompt: '',
  settingsOpen: false,

  chats: [],
  activeChatId: null,
  activeMessages: [],

  phase: 'idle',
  progressLog: [],
  livePreviewDataUrl: null,
  error: null,

  setCatalog: (catalog) => set({ catalog }),
  setKeyStatus: (keyStatus) => set({ keyStatus }),
  patchKeyStatus: (provider, hasKey) =>
    set((s) => ({ keyStatus: s.keyStatus ? { ...s.keyStatus, [provider]: hasKey } : s.keyStatus })),
  setSelectedModelId: (selectedModelId) => set({ selectedModelId }),
  setPrompt: (prompt) => set({ prompt }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  setChats: (chats) => set({ chats }),
  selectChat: (activeChatId, activeMessages) =>
    set({
      activeChatId,
      activeMessages,
      phase: 'idle',
      progressLog: [],
      livePreviewDataUrl: null,
      error: null,
      prompt: ''
    }),
  newChat: () =>
    set({
      activeChatId: null,
      activeMessages: [],
      phase: 'idle',
      progressLog: [],
      livePreviewDataUrl: null,
      error: null,
      prompt: ''
    }),
  setActiveChatId: (activeChatId) => set({ activeChatId }),
  setActiveMessages: (activeMessages) => set({ activeMessages }),
  appendOptimisticUserMessage: (text) =>
    set((s) => ({
      activeMessages: [
        ...s.activeMessages,
        { id: `optimistic-${Date.now()}`, role: 'user', text, createdAt: new Date().toISOString() }
      ]
    })),

  startGeneration: () =>
    set({ phase: 'running', progressLog: [], livePreviewDataUrl: null, error: null }),
  addProgress: (event) => set((s) => ({ progressLog: [...s.progressLog, event] })),
  setLivePreview: (livePreviewDataUrl) => set({ livePreviewDataUrl }),
  completeGeneration: () => set({ phase: 'done' }),
  failGeneration: (error) => set({ phase: 'error', error })
}))
