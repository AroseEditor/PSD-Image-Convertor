import Anthropic from '@anthropic-ai/sdk'
import type { LayerPlan, ProviderId } from '@shared/types'
import { layerPlanSchema } from '@shared/layerPlanSchema'
import { normalizeAnthropicError } from './normalizeError'
import { isMockMode, mockLayerPlan, mockTitle } from './mock'
import {
  LAYER_PLANNER_SYSTEM_PROMPT,
  LAYER_PLAN_JSON_SCHEMA,
  LAYER_PLAN_TOOL_NAME,
  CHAT_TITLE_SYSTEM_PROMPT,
  buildPlannerUserMessage,
  type PlannerContext
} from '../pipeline/prompts'

const providerId: ProviderId = 'anthropic'

export async function planLayers(
  rawPrompt: string,
  apiKey: string,
  modelId: string,
  ctx: PlannerContext
): Promise<LayerPlan> {
  if (isMockMode()) return mockLayerPlan(rawPrompt, ctx)
  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: modelId,
      max_tokens: 4096,
      system: LAYER_PLANNER_SYSTEM_PROMPT,
      tools: [
        {
          name: LAYER_PLAN_TOOL_NAME,
          description: 'Submit the enhanced prompt and structured layer decomposition.',
          input_schema: LAYER_PLAN_JSON_SCHEMA as unknown as Anthropic.Tool.InputSchema
        }
      ],
      tool_choice: { type: 'tool', name: LAYER_PLAN_TOOL_NAME },
      messages: [{ role: 'user', content: buildPlannerUserMessage(rawPrompt, ctx) }]
    })

    const toolUse = message.content.find((block) => block.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('anthropic_no_plan_returned')
    }

    return layerPlanSchema.parse(toolUse.input)
  } catch (error) {
    if (error instanceof Error && error.message === 'anthropic_no_plan_returned') {
      throw normalizeAnthropicError(providerId, { status: 500 })
    }
    throw normalizeAnthropicError(providerId, error)
  }
}

export async function generateChatTitle(rawPrompt: string, apiKey: string): Promise<string | null> {
  if (isMockMode()) return mockTitle(rawPrompt)
  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 32,
      system: CHAT_TITLE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: rawPrompt }]
    })
    const textBlock = message.content.find((block) => block.type === 'text')
    return textBlock && textBlock.type === 'text' ? textBlock.text.trim() : null
  } catch {
    return null
  }
}

export type { PlannerContext }
