import type { LayerPlan, ProviderId } from '@shared/types'
import type { PlannerContext } from './prompts'
import * as geminiAdapter from '../providers/geminiAdapter'
import * as openaiAdapter from '../providers/openaiAdapter'
import * as anthropicAdapter from '../providers/anthropicAdapter'

/**
 * Produces the same LayerPlan shape regardless of which provider did the planning —
 * the orchestrator never needs to know which branch ran.
 */
export async function planLayers(
  providerId: ProviderId,
  modelId: string,
  apiKey: string,
  rawPrompt: string,
  ctx: PlannerContext
): Promise<LayerPlan> {
  if (providerId === 'anthropic') {
    return anthropicAdapter.planLayers(rawPrompt, apiKey, modelId, ctx)
  }
  if (providerId === 'gemini') {
    return geminiAdapter.planLayers(rawPrompt, apiKey, modelId, ctx)
  }
  return openaiAdapter.planLayers(rawPrompt, apiKey, ctx)
}
