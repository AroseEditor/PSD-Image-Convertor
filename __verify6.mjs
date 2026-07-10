// Isolated test of the retry/backoff logic (src/main/services/pipeline/retry.ts) itself.
import { withRetry } from './src/main/services/pipeline/retry.ts'

let calls = 0
const rateLimited = {
  code: 'rate_limited',
  message: "You're being rate-limited by the provider. Try again shortly.",
  retryable: true,
  providerId: 'gemini',
  retryAfterMs: 50 // short delay for a fast test
}

const retries = []

const result = await withRetry(
  async () => {
    calls++
    if (calls < 3) throw rateLimited
    return 'success-on-attempt-' + calls
  },
  {
    maxRetries: 3,
    onRetry: (attempt, maxRetries, delayMs, error) => retries.push({ attempt, maxRetries, delayMs, code: error.code })
  }
)

console.log('result:', result)
console.log('total calls:', calls)
console.log('retries fired:', JSON.stringify(retries))
console.log(calls === 3 && result === 'success-on-attempt-3' && retries.length === 2 ? 'PASS: retry-then-succeed' : 'FAIL')

// Non-retryable error should throw immediately without retrying.
let calls2 = 0
try {
  await withRetry(
    async () => {
      calls2++
      throw { code: 'invalid_api_key', message: 'bad key', retryable: false, providerId: 'gemini' }
    },
    { maxRetries: 3 }
  )
  console.log('FAIL: should have thrown')
} catch (e) {
  console.log(calls2 === 1 ? 'PASS: non-retryable fails immediately' : 'FAIL: retried a non-retryable error')
}

// Exhausting all retries should surface the last error.
let calls3 = 0
try {
  await withRetry(
    async () => {
      calls3++
      throw rateLimited
    },
    { maxRetries: 2 }
  )
  console.log('FAIL: should have thrown after exhausting retries')
} catch (e) {
  console.log(calls3 === 3 && e.code === 'rate_limited' ? 'PASS: exhausts retries then throws' : 'FAIL')
}
