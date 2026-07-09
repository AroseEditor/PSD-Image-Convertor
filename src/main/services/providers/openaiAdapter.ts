import OpenAI from 'openai'
import type { LayerPlan, ProviderId } from '@shared/types'
import { layerPlanSchema } from '@shared/layerPlanSchema'
import { normalizeOpenAiError } from './normalizeError'
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

const providerId: ProviderId = 'openai'

/**
 * The gpt-image-* family is a dedicated text-to-image endpoint with no chat/JSON
 * capability, so layer planning always goes through this fixed utility chat model
 * regardless of which OpenAI model the user picked for actual image generation.
 */
const PLANNER_MODEL_ID = 'gpt-5.4-mini'

function isImagesApiModel(modelId: string): boolean {
  return modelId.startsWith('gpt-image')
}

export async function generateImage(
  prompt: string,
  modelId: string,
  apiKey: string,
  transparentBackground: boolean
): Promise<ImageResult> {
  if (isMockMode()) return { pngBuffer: await mockPngBuffer(512, 512, mockLayerColor(prompt)) }
  const client = new OpenAI({ apiKey })
  try {
    if (isImagesApiModel(modelId)) {
      const response = await client.images.generate({
        model: modelId,
        prompt,
        size: 'auto',
        ...(transparentBackground ? { background: 'transparent' as const } : {})
      })
      const b64 = response.data?.[0]?.b64_json
      if (!b64) throw new Error('openai_no_image_returned')
      return { pngBuffer: Buffer.from(b64, 'base64') }
    }

    // Chat/reasoning models (gpt-5.x): generate via the Responses API image_generation tool.
    const response = await client.responses.create({
      model: modelId,
      input: prompt,
      tools: [{ type: 'image_generation' }]
    })

    const output = (response as unknown as { output?: Array<Record<string, unknown>> }).output ?? []
    const imageCall = output.find((item) => item.type === 'image_generation_call')
    const result = imageCall?.result
    if (typeof result !== 'string') throw new Error('openai_no_image_returned')
    return { pngBuffer: Buffer.from(result, 'base64') }
  } catch (error) {
    if (error instanceof Error && error.message === 'openai_no_image_returned') {
      throw normalizeOpenAiError(providerId, { status: 500 })
    }
    throw normalizeOpenAiError(providerId, error)
  }
}

export async function planLayers(
  rawPrompt: string,
  apiKey: string,
  ctx: PlannerContext
): Promise<LayerPlan> {
  if (isMockMode()) return mockLayerPlan(rawPrompt, ctx)
  const client = new OpenAI({ apiKey })
  try {
    const completion = await client.chat.completions.create({
      model: PLANNER_MODEL_ID,
      messages: [
        { role: 'system', content: LAYER_PLANNER_SYSTEM_PROMPT },
        { role: 'user', content: buildPlannerUserMessage(rawPrompt, ctx) }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'layer_plan', strict: true, schema: LAYER_PLAN_JSON_SCHEMA }
      }
    })

    const text = completion.choices[0]?.message?.content
    if (!text) throw new Error('openai_no_plan_returned')

    return layerPlanSchema.parse(JSON.parse(text))
  } catch (error) {
    if (error instanceof Error && error.message === 'openai_no_plan_returned') {
      throw normalizeOpenAiError(providerId, { status: 500 })
    }
    throw normalizeOpenAiError(providerId, error)
  }
}

export async function generateChatTitle(rawPrompt: string, apiKey: string): Promise<string | null> {
  if (isMockMode()) return mockTitle(rawPrompt)
  try {
    const client = new OpenAI({ apiKey })
    const completion = await client.chat.completions.create({
      model: PLANNER_MODEL_ID,
      messages: [
        { role: 'system', content: CHAT_TITLE_SYSTEM_PROMPT },
        { role: 'user', content: rawPrompt }
      ]
    })
    return completion.choices[0]?.message?.content?.trim() || null
  } catch {
    return null
  }
}
