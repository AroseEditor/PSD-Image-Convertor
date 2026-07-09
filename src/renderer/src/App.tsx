import React, { useEffect } from 'react'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { ModelSelect } from './components/ModelSelect'
import { PromptBox } from './components/PromptBox'
import { SettingsModal } from './components/SettingsModal'
import { ProgressPanel } from './components/ProgressPanel'
import { PreviewCanvas } from './components/PreviewCanvas'
import { ChatThread } from './components/ChatThread'
import { ErrorBanner } from './components/ErrorBanner'
import { useAppStore } from './state/useAppStore'
import { bridge } from './api/electronBridge'

export default function App(): React.JSX.Element {
  const setCatalog = useAppStore((s) => s.setCatalog)
  const setKeyStatus = useAppStore((s) => s.setKeyStatus)
  const setChats = useAppStore((s) => s.setChats)
  const addProgress = useAppStore((s) => s.addProgress)
  const setLivePreview = useAppStore((s) => s.setLivePreview)
  const completeGeneration = useAppStore((s) => s.completeGeneration)
  const failGeneration = useAppStore((s) => s.failGeneration)
  const setActiveMessages = useAppStore((s) => s.setActiveMessages)

  useEffect(() => {
    bridge.models.listCatalog().then(setCatalog)
    bridge.keys.getStatus().then(setKeyStatus)
    bridge.chats.list().then(setChats)

    async function refreshIfActive(chatId: string): Promise<void> {
      bridge.chats.list().then(setChats)
      if (useAppStore.getState().activeChatId !== chatId) return
      const chat = await bridge.chats.get(chatId)
      if (chat) setActiveMessages(chat.messages)
    }

    const offProgress = bridge.generation.onProgress(addProgress)
    const offPreview = bridge.generation.onPreview((e) => setLivePreview(e.previewPngBase64))
    const offComplete = bridge.generation.onComplete((e) => {
      completeGeneration()
      refreshIfActive(e.chatId)
    })
    const offError = bridge.generation.onError((e) => {
      failGeneration(e.error)
      if (e.chatId) refreshIfActive(e.chatId)
    })

    return () => {
      offProgress()
      offPreview()
      offComplete()
      offError()
    }
  }, [])

  return (
    <div className="app">
      <Header />
      <div className="body">
        <Sidebar />
        <div className="main">
          <ChatThread />
          <div className="composer">
            <ModelSelect />
            <PromptBox />
          </div>
          <ProgressPanel />
          <ErrorBanner />
          <PreviewCanvas />
        </div>
      </div>
      <SettingsModal />
    </div>
  )
}
