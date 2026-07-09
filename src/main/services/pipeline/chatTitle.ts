import type { ProviderId } from '@shared/types'
import * as geminiAdapter from '../providers/geminiAdapter'
import * as openaiAdapter from '../providers/openaiAdapter'
import * as anthropicAdapter from '../providers/anthropicAdapter'
import { getKey } from '../keyStore'

function fallbackTitle(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 6).join(' ')
  return words.length > 0 ? words : 'New image'
}

/**
 * Generates a short chat title using whichever provider already has a key saved
 * (preferring the one the user is actively using), degrading to a plain
 * truncation of the prompt if no key is available or the call fails.
 */
export async function generateChatTitle(prompt: string, preferredProviderId: ProviderId): Promise<string> {
  const order: ProviderId[] = [
    preferredProviderId,
    ...(['anthropic', 'gemini', 'openai'] as ProviderId[]).filter((p) => p !== preferredProviderId)
  ]

  for (const providerId of order) {
    const apiKey = await getKey(providerId)
    if (!apiKey) continue

    const title =
      providerId === 'anthropic'
        ? await anthropicAdapter.generateChatTitle(prompt, apiKey)
        : providerId === 'gemini'
          ? await geminiAdapter.generateChatTitle(prompt, apiKey)
          : await openaiAdapter.generateChatTitle(prompt, apiKey)

    if (title) return title
  }

  return fallbackTitle(prompt)
}
