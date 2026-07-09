import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { IPC } from '@shared/ipcChannels'
import type { GenerationRequest } from '@shared/types'
import { startNewChat, runGenerationJob } from '../services/pipeline/pipelineOrchestrator'

export function registerGenerationHandlers(): void {
  ipcMain.handle(IPC.GENERATION_SUBMIT, async (_e, req: GenerationRequest) => {
    const jobId = randomUUID()
    const chatId = req.chatId ?? (await startNewChat(req)).chatId

    runGenerationJob(jobId, chatId, req).catch((err) => {
      console.error('Unhandled generation job error', err)
    })

    return { jobId, chatId }
  })

  ipcMain.handle(IPC.GENERATION_CANCEL, async () => {
    // No in-flight cancellation yet — jobs are short enough (a handful of image
    // calls) that this is a known limitation rather than a core gap.
    return { ok: true as const }
  })
}
