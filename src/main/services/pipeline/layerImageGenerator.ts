import type { LayerBBox, LayerPlan } from '@shared/types'
import * as geminiAdapter from '../providers/geminiAdapter'
import * as openaiAdapter from '../providers/openaiAdapter'
import { supportsNativeTransparency } from '../modelCatalog/modelCatalog'
import { mapWithConcurrency } from './concurrency'
import { chromaKeyGreenToAlpha } from './chromaKey'
import { buildLayerImagePrompt } from './prompts'

export interface GeneratedLayer {
  name: string
  z: number
  bbox: LayerBBox
  pngBuffer: Buffer
  usedChromaKeyFallback: boolean
}

const CONCURRENCY = 3

export async function generateChangedLayers(
  plan: LayerPlan,
  targetProviderId: 'gemini' | 'openai',
  targetModelId: string,
  apiKey: string,
  onLayerDone?: (name: string) => void
): Promise<GeneratedLayer[]> {
  const transparentBackground = supportsNativeTransparency(targetModelId)
  const layersToGenerate = plan.layers.filter((l) => l.changed !== false)

  return mapWithConcurrency(layersToGenerate, CONCURRENCY, async (layer) => {
    const prompt = buildLayerImagePrompt(layer, plan.enhancedPrompt, transparentBackground)

    const { pngBuffer } =
      targetProviderId === 'gemini'
        ? await geminiAdapter.generateImage(prompt, targetModelId, apiKey)
        : await openaiAdapter.generateImage(prompt, targetModelId, apiKey, transparentBackground)

    const finalBuffer = transparentBackground ? pngBuffer : await chromaKeyGreenToAlpha(pngBuffer)

    onLayerDone?.(layer.name)

    return {
      name: layer.name,
      z: layer.z,
      bbox: layer.bbox,
      pngBuffer: finalBuffer,
      usedChromaKeyFallback: !transparentBackground
    }
  })
}
