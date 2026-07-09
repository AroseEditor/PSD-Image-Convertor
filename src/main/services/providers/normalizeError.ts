import type { NormalizedError, ProviderId } from '@shared/types'

const MESSAGES: Record<NormalizedError['code'], string> = {
  invalid_api_key: 'Your API key looks invalid. Check it in Settings.',
  no_payment_method: 'This provider account has no payment method / billing set up.',
  quota_exceeded: 'You have exceeded your usage quota for this provider.',
  rate_limited: "You're being rate-limited by the provider. Try again shortly.",
  model_access_denied: "This model isn't available on your account tier.",
  network_error: 'Network error — check your internet connection.',
  server_error: 'The provider is having server issues. Try again shortly.',
  missing_api_key: 'No API key is set for this provider. Add one in Settings.',
  unknown: 'Something went wrong talking to the provider.'
}

function build(
  providerId: ProviderId,
  code: NormalizedError['code'],
  retryable: boolean
): NormalizedError {
  return { code, message: MESSAGES[code], retryable, providerId }
}

export function missingApiKeyError(providerId: ProviderId): NormalizedError {
  return build(providerId, 'missing_api_key', false)
}

export function normalizeGeminiError(providerId: ProviderId, error: unknown): NormalizedError {
  const status = extractStatus(error)
  const statusText = extractStatusText(error)
  const googleError = extractGoogleApiError(error)
  const reason = googleError?.details?.find((d) => typeof d.reason === 'string')?.reason
  const googleStatus = googleError?.status

  if (reason === 'API_KEY_INVALID' || status === 401 || statusText === 'UNAUTHENTICATED') {
    return build(providerId, 'invalid_api_key', false)
  }
  if (googleStatus === 'PERMISSION_DENIED' || status === 403 || statusText === 'PERMISSION_DENIED') {
    return build(providerId, 'model_access_denied', false)
  }
  if (googleStatus === 'RESOURCE_EXHAUSTED' || status === 429 || statusText === 'RESOURCE_EXHAUSTED') {
    return build(providerId, 'rate_limited', true)
  }
  if (typeof status === 'number' && status >= 500) {
    return build(providerId, 'server_error', true)
  }
  if (isNetworkError(error)) {
    return build(providerId, 'network_error', true)
  }
  return build(providerId, 'unknown', false)
}

interface GoogleApiErrorDetail {
  reason?: string
}

interface GoogleApiErrorBody {
  code?: number
  message?: string
  status?: string
  details?: GoogleApiErrorDetail[]
}

function extractGoogleApiError(error: unknown): GoogleApiErrorBody | undefined {
  if (typeof error !== 'object' || error === null || !('message' in error)) return undefined
  const message = (error as { message?: unknown }).message
  if (typeof message !== 'string') return undefined
  try {
    const parsed = JSON.parse(message) as { error?: GoogleApiErrorBody }
    return parsed.error
  } catch {
    return undefined
  }
}

export function normalizeOpenAiError(providerId: ProviderId, error: unknown): NormalizedError {
  const status = extractStatus(error)
  const code = extractCode(error)

  if (status === 401) return build(providerId, 'invalid_api_key', false)
  if (code === 'insufficient_quota') return build(providerId, 'quota_exceeded', false)
  if (code === 'billing_hard_limit_reached') return build(providerId, 'no_payment_method', false)
  if (status === 429) return build(providerId, 'rate_limited', true)
  if (status === 403) return build(providerId, 'model_access_denied', false)
  if (typeof status === 'number' && status >= 500) return build(providerId, 'server_error', true)
  if (isNetworkError(error)) return build(providerId, 'network_error', true)
  return build(providerId, 'unknown', false)
}

export function normalizeAnthropicError(providerId: ProviderId, error: unknown): NormalizedError {
  const status = extractStatus(error)
  const errorType = extractErrorType(error)

  if (status === 401) return build(providerId, 'invalid_api_key', false)
  if (status === 403) return build(providerId, 'model_access_denied', false)
  if (status === 429) return build(providerId, 'rate_limited', true)
  if (errorType && /billing/i.test(errorType)) return build(providerId, 'no_payment_method', false)
  if (typeof status === 'number' && status >= 500) return build(providerId, 'server_error', true)
  if (isNetworkError(error)) return build(providerId, 'network_error', true)
  return build(providerId, 'unknown', false)
}

function extractStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const s = (error as { status?: unknown }).status
    return typeof s === 'number' ? s : undefined
  }
  return undefined
}

function extractStatusText(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null) {
    const e = error as { status?: unknown; code?: unknown }
    if (typeof e.status === 'string') return e.status
    if (typeof e.code === 'string') return e.code
  }
  return undefined
}

function extractCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const c = (error as { code?: unknown }).code
    return typeof c === 'string' ? c : undefined
  }
  return undefined
}

function extractErrorType(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null) {
    const e = error as { error?: { type?: unknown }; type?: unknown }
    if (typeof e.type === 'string') return e.type
    if (typeof e.error?.type === 'string') return e.error.type
  }
  return undefined
}

function isNetworkError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const c = (error as { code?: unknown }).code
    return c === 'ECONNREFUSED' || c === 'ENOTFOUND' || c === 'ECONNRESET' || c === 'ETIMEDOUT'
  }
  return false
}
