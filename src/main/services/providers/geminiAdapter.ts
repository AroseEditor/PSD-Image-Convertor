import { GoogleGenAI } from '@google/genai'
import type { AttachedImage, LayerPlan, ProviderId } from '@shared/types'
import { layerPlanSchema } from '@shared/layerPlanSchema'
import { normalizeGeminiError, logProviderError } from './normalizeError'
import { isMockMode, mockLayerColor, mockLayerPlan, mockPngBuffer, mockTitle } from './mock'
import {
  LAYER_PLANNER_SYSTEM_PROMPT,
  LAYER_PLAN_JSON_SCHEMA,
  CHAT_TITLE_SYSTEM_PROMPT,
  buildPlannerUserMessage,
  type PlannerContext
} from '../pipeline/prompts'

export interface ImageResult {
  pngBuffer: Buffer
}

const providerId: ProviderId = 'gemini'

/** Internal utility model used for chat titling only — not user-selectable. */
const TITLE_MODEL_ID = 'gemini-2.5-flash'

export async function generateImage(
  prompt: string,
  modelId: string,
  apiKey: string,
  referenceImage?: AttachedImage
): Promise<ImageResult> {
  if (isMockMode()) return { pngBuffer: await mockPngBuffer(512, 512, mockLayerColor(prompt)) }
  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: modelId,
      contents: referenceImage
        ? [{ inlineData: { mimeType: referenceImage.mimeType, data: referenceImage.base64 } }, { text: prompt }]
        : prompt
    })

    const parts = response.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find((p) => p.inlineData?.data)

    if (!imagePart?.inlineData?.data) {
      throw new Error('gemini_no_image_returned')
    }

    return { pngBuffer: Buffer.from(imagePart.inlineData.data, 'base64') }
  } catch (error) {
    if (error instanceof Error && error.message === 'gemini_no_image_returned') {
      logProviderError(providerId, 'generateImage', error)
      throw normalizeGeminiError(providerId, { status: 500 })
    }
    logProviderError(providerId, 'generateImage', error)
    throw normalizeGeminiError(providerId, error)
  }
}

export async function planLayers(
  rawPrompt: string,
  apiKey: string,
  modelId: string,
  ctx: PlannerContext
): Promise<LayerPlan> {
  if (isMockMode()) return mockLayerPlan(rawPrompt, ctx)
  try {
    const ai = new GoogleGenAI({ apiKey })
    const plannerText = buildPlannerUserMessage(rawPrompt, ctx)
    const response = await ai.models.generateContent({
      model: modelId,
      contents: ctx.attachedImage
        ? [
            { inlineData: { mimeType: ctx.attachedImage.mimeType, data: ctx.attachedImage.base64 } },
            { text: plannerText }
          ]
        : plannerText,
      config: {
        systemInstruction: LAYER_PLANNER_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: LAYER_PLAN_JSON_SCHEMA
      }
    })

    const text = response.text
    if (!text) throw new Error('gemini_no_plan_returned')

    return layerPlanSchema.parse(JSON.parse(text))
  } catch (error) {
    if (error instanceof Error && error.message === 'gemini_no_plan_returned') {
      logProviderError(providerId, 'planLayers', error)
      throw normalizeGeminiError(providerId, { status: 500 })
    }
    logProviderError(providerId, 'planLayers', error)
    throw normalizeGeminiError(providerId, error)
  }
}

export async function generateChatTitle(rawPrompt: string, apiKey: string): Promise<string | null> {
  if (isMockMode()) return mockTitle(rawPrompt)
  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: TITLE_MODEL_ID,
      contents: rawPrompt,
      config: { systemInstruction: CHAT_TITLE_SYSTEM_PROMPT }
    })
    return response.text?.trim() || null
  } catch (error) {
    logProviderError(providerId, 'generateChatTitle', error)
    return null
  }
}
