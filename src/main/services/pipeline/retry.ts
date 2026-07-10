import type { NormalizedError } from '@shared/types'

function isNormalizedError(value: unknown): value is NormalizedError {
  return typeof value === 'object' && value !== null && 'code' in value && 'retryable' in value
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type OnRetry = (attempt: number, maxRetries: number, delayMs: number, error: NormalizedError) => void

/**
 * Retries a provider call when it fails with a NormalizedError flagged retryable
 * (rate limits, transient server errors) — using the provider's own suggested
 * backoff (e.g. Gemini's RetryInfo) when available, else a fixed default delay.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; defaultDelayMs?: number; onRetry?: OnRetry } = {}
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 2
  const defaultDelayMs = opts.defaultDelayMs ?? 20_000

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (!isNormalizedError(error) || !error.retryable || attempt >= maxRetries) {
        throw error
      }
      const delayMs = error.retryAfterMs ?? defaultDelayMs
      opts.onRetry?.(attempt + 1, maxRetries, delayMs, error)
      await sleep(delayMs)
    }
  }
}
