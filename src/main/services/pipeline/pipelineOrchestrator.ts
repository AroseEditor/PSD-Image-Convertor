import { promises as fs } from 'fs'
import { join } from 'path'
import { BrowserWindow } from 'electron'
import sharp from 'sharp'
import { IPC } from '@shared/ipcChannels'
import type {
  AttachedImage,
  GenerationRequest,
  GenerationProgressEvent,
  GenerationPreviewEvent,
  GenerationCompleteEvent,
  GenerationErrorEvent,
  LayerPlan,
  NormalizedError,
  ProviderId
} from '@shared/types'
import { getKey } from '../keyStore'
import { getLastUsedImageModelId, setLastUsedImageModelId } from '../settingsStore'
import { defaultModelId, providerOf } from '../modelCatalog/modelCatalog'
import { missingApiKeyError } from '../providers/normalizeError'
import { planLayers } from './layerPlanner'
import { generateChangedLayers } from './layerImageGenerator'
import { buildComposite, type CompositeLayer } from './compositor'
import { buildPsd, verifyPsd } from './psdAssembler'
import { generateChatTitle } from './chatTitle'
import * as chatStore from '../chatStore'

function emit<T>(channel: string, payload: T): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

function isNormalizedError(value: unknown): value is NormalizedError {
  return typeof value === 'object' && value !== null && 'code' in value && 'message' in value
}

function resolveTargetImageModel(
  chatLastProviderId: ProviderId | undefined,
  chatLastModelId: string | undefined,
  fallbackModelId: string
): { providerId: 'gemini' | 'openai'; modelId: string } {
  const candidate = chatLastModelId ?? fallbackModelId
  const candidateProvider = providerOf(candidate)
  if (candidateProvider === 'gemini' || candidateProvider === 'openai') {
    return { providerId: candidateProvider, modelId: candidate }
  }
  // Should not normally happen (chat's last image provider should never be anthropic),
  // fall back to the catalog default.
  const fallback = defaultModelId()
  const fallbackProvider = providerOf(fallback)
  return { providerId: (fallbackProvider as 'gemini' | 'openai') ?? 'gemini', modelId: fallback }
}

interface NormalizedAttachment {
  image: AttachedImage
  pngBase64: string
  width: number
  height: number
}

/** Re-encodes whatever the user uploaded/pasted/dragged as PNG, for consistent
 *  downstream handling (provider calls, chat display) and to read real dimensions. */
async function normalizeAttachedImage(raw: AttachedImage): Promise<NormalizedAttachment> {
  const inputBuffer = Buffer.from(raw.base64, 'base64')
  const pngBuffer = await sharp(inputBuffer).png().toBuffer()
  const metadata = await sharp(pngBuffer).metadata()
  const pngBase64 = pngBuffer.toString('base64')
  return {
    image: { base64: pngBase64, mimeType: 'image/png' },
    pngBase64,
    width: metadata.width ?? 1024,
    height: metadata.height ?? 1024
  }
}

/** Kicks off a new chat (with an AI-generated title) for a first message in a thread. */
export async function startNewChat(req: GenerationRequest): Promise<{ chatId: string }> {
  const title = await generateChatTitle(req.prompt, req.providerId)
  const attachment = req.attachedImage ? await normalizeAttachedImage(req.attachedImage) : undefined
  const chat = await chatStore.createChat(title, req.prompt, attachment?.pngBase64)
  return { chatId: chat.id }
}

export async function runGenerationJob(jobId: string, chatId: string, req: GenerationRequest): Promise<void> {
  const progress = (stage: GenerationProgressEvent['stage'], message: string, percent: number, layerName?: string): void =>
    emit<GenerationProgressEvent>(IPC.GENERATION_PROGRESS, { jobId, chatId, stage, message, percent, layerName })

  const fail = async (error: NormalizedError): Promise<void> => {
    await chatStore.appendAssistantMessage(chatId, { text: error.message, error })
    emit<GenerationErrorEvent>(IPC.GENERATION_ERROR, { jobId, chatId, error })
  }

  try {
    progress('starting', 'Starting…', 5)

    const existingChat = await chatStore.getChat(chatId)
    const previousPlan = existingChat?.lastLayerPlan
    const isEditTurn = !!previousPlan

    const attachment = req.attachedImage ? await normalizeAttachedImage(req.attachedImage) : undefined

    if (isEditTurn) {
      // The first user message is written by chatStore.createChat(); edit turns append here.
      const alreadyLogged = existingChat!.messages.some((m) => m.role === 'user' && m.text === req.prompt)
      if (!alreadyLogged) await chatStore.appendUserMessage(chatId, req.prompt, attachment?.pngBase64)
    }

    const plannerApiKey = await getKey(req.providerId)
    if (!plannerApiKey) return fail(missingApiKeyError(req.providerId))

    progress(
      req.providerId === 'anthropic' ? 'enhancing' : 'planning',
      req.providerId === 'anthropic' ? 'Enhancing prompt with Claude…' : 'Planning layers…',
      15
    )

    const plan: LayerPlan = await planLayers(
      req.providerId,
      req.modelId,
      plannerApiKey,
      req.prompt,
      {
        canvasWidth: attachment?.width ?? previousPlan?.canvasWidth ?? 1024,
        canvasHeight: attachment?.height ?? previousPlan?.canvasHeight ?? 1024,
        previousPlan,
        attachedImage: attachment?.image
      },
      (attempt, maxRetries, delayMs, error) =>
        progress(
          'planning',
          `${error.message} Retrying in ${Math.round(delayMs / 1000)}s… (attempt ${attempt}/${maxRetries})`,
          15
        )
    )

    const target =
      req.providerId === 'anthropic'
        ? resolveTargetImageModel(
            existingChat?.lastProviderId,
            existingChat?.lastModelId,
            (await getLastUsedImageModelId()) ?? defaultModelId()
          )
        : { providerId: req.providerId as 'gemini' | 'openai', modelId: req.modelId }

    if (req.providerId !== 'anthropic') {
      await setLastUsedImageModelId(req.modelId)
    }

    progress(
      'planning',
      `Planned layers: ${plan.layers.map((l) => l.name).join(', ')}`,
      30,
      undefined
    )

    const imageApiKey = await getKey(target.providerId)
    if (!imageApiKey) return fail(missingApiKeyError(target.providerId))

    const layersToGenerateCount = plan.layers.filter((l) => l.changed !== false).length
    progress('generating-layer', `Generating ${layersToGenerateCount} layer image(s)…`, 40)

    const generated = await generateChangedLayers(plan, target.providerId, target.modelId, imageApiKey, {
      onLayerDone: (name) => progress('generated-layer', `Generated "${name}"`, 55, name),
      referenceImage: attachment?.image,
      onRetry: (attempt, maxRetries, delayMs, error) =>
        progress(
          'generating-layer',
          `${error.message} Retrying in ${Math.round(delayMs / 1000)}s… (attempt ${attempt}/${maxRetries})`,
          40
        )
    })

    const assetDir = chatStore.chatAssetDir(chatId)
    await fs.mkdir(assetDir, { recursive: true })

    const layerAssetPaths: Record<string, string> = { ...(existingChat?.layerAssetPaths ?? {}) }
    const compositeLayers: CompositeLayer[] = []

    for (const layer of generated) {
      const filePath = join(assetDir, `layer-${sanitizeFileName(layer.name)}.png`)
      await fs.writeFile(filePath, layer.pngBuffer)
      layerAssetPaths[layer.name] = filePath
      compositeLayers.push({ name: layer.name, z: layer.z, bbox: layer.bbox, pngBuffer: layer.pngBuffer })
    }

    for (const layerPlan of plan.layers.filter((l) => l.changed === false)) {
      const existingPath = layerAssetPaths[layerPlan.name]
      if (!existingPath) continue
      const pngBuffer = await fs.readFile(existingPath)
      compositeLayers.push({ name: layerPlan.name, z: layerPlan.z, bbox: layerPlan.bbox, pngBuffer })
    }

    progress('compositing', 'Compositing preview…', 75)
    const previewBuffer = await buildComposite(plan.canvasWidth, plan.canvasHeight, compositeLayers)
    const previewPngBase64 = previewBuffer.toString('base64')

    emit<GenerationPreviewEvent>(IPC.GENERATION_PREVIEW_READY, {
      jobId,
      chatId,
      previewPngBase64,
      width: plan.canvasWidth,
      height: plan.canvasHeight
    })

    progress('assembling-psd', 'Assembling PSD…', 88)
    const psdBuffer = await buildPsd(plan, compositeLayers)

    const verification = verifyPsd(
      psdBuffer,
      plan.layers.map((l) => l.name)
    )
    if (!verification.ok) {
      console.warn('PSD verification issues:', verification.issues)
    }

    const psdPath = join(assetDir, 'output.psd')
    await fs.writeFile(psdPath, psdBuffer)

    await chatStore.updateChatAssets(chatId, {
      lastLayerPlan: plan,
      layerAssetPaths,
      lastModelId: target.modelId,
      lastProviderId: target.providerId
    })

    await chatStore.appendAssistantMessage(chatId, {
      text: isEditTurn ? 'Updated the image.' : 'Generated the image.',
      previewPngBase64,
      psdPath
    })

    progress('done', 'Done', 100)
    emit<GenerationCompleteEvent>(IPC.GENERATION_COMPLETE, { jobId, chatId, psdPath })
  } catch (error) {
    const normalized: NormalizedError = isNormalizedError(error)
      ? error
      : {
          code: 'unknown',
          message: error instanceof Error ? error.message : 'Generation failed.',
          retryable: true,
          providerId: req.providerId
        }
    await fail(normalized)
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
}
