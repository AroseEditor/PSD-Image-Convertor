import type { AttachedImage, LayerBBox, LayerPlan } from '@shared/types'
import * as geminiAdapter from '../providers/geminiAdapter'
import * as openaiAdapter from '../providers/openaiAdapter'
import { supportsNativeTransparency } from '../modelCatalog/modelCatalog'
import { mapWithConcurrency } from './concurrency'
import { chromaKeyGreenToAlpha } from './chromaKey'
import { buildLayerImagePrompt } from './prompts'
import { withRetry, type OnRetry } from './retry'

export interface GeneratedLayer {
  name: string
  z: number
  bbox: LayerBBox
  pngBuffer: Buffer
  usedChromaKeyFallback: boolean
}

export interface GenerateChangedLayersOptions {
  onLayerDone?: (name: string) => void
  referenceImage?: AttachedImage
  onRetry?: OnRetry
}

const CONCURRENCY = 3

export async function generateChangedLayers(
  plan: LayerPlan,
  targetProviderId: 'gemini' | 'openai',
  targetModelId: string,
  apiKey: string,
  opts: GenerateChangedLayersOptions = {}
): Promise<GeneratedLayer[]> {
  const transparentBackground = supportsNativeTransparency(targetModelId)
  const layersToGenerate = plan.layers.filter((l) => l.changed !== false)

  return mapWithConcurrency(layersToGenerate, CONCURRENCY, async (layer) => {
    const prompt = buildLayerImagePrompt(layer, plan.enhancedPrompt, transparentBackground, !!opts.referenceImage)

    const { pngBuffer } = await withRetry(
      () =>
        targetProviderId === 'gemini'
          ? geminiAdapter.generateImage(prompt, targetModelId, apiKey, opts.referenceImage)
          : openaiAdapter.generateImage(prompt, targetModelId, apiKey, transparentBackground, opts.referenceImage),
      { onRetry: opts.onRetry }
    )

    const finalBuffer = transparentBackground ? pngBuffer : await chromaKeyGreenToAlpha(pngBuffer)

    opts.onLayerDone?.(layer.name)

    return {
      name: layer.name,
      z: layer.z,
      bbox: layer.bbox,
      pngBuffer: finalBuffer,
      usedChromaKeyFallback: !transparentBackground
    }
  })
}
