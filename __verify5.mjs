// Quick regression: standard mock-mode flow still works after the retry/logging refactor.
import { _electron as electron } from 'playwright-core'
import { rm } from 'node:fs/promises'
import path from 'node:path'

const APP_DIR = 'C:\\Users\\iusem\\Downloads\\My Work\\PSD Convertor'
const USER_DATA_DIR = 'C:\\Users\\iusem\\AppData\\Roaming\\psd-convertor'

await rm(path.join(USER_DATA_DIR, 'chats.json'), { force: true })
await rm(path.join(USER_DATA_DIR, 'chats'), { recursive: true, force: true })

const app = await electron.launch({ args: [APP_DIR], env: { ...process.env, PSD_GEN_MOCK_PROVIDERS: '1' }, timeout: 30000 })
const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(800)

await page.locator('button', { hasText: 'Settings' }).click()
await page.waitForTimeout(200)
await page.locator('input[type="password"]').first().fill('mock-mode-fake-key')
await page.locator('button', { hasText: 'Save' }).first().click()
await page.waitForTimeout(300)
await page.locator('button', { hasText: 'Done' }).click()
await page.waitForTimeout(200)

await page.locator('textarea').fill('a dog playing in a park')
await page.locator('button', { hasText: 'Generate' }).click()
await page.waitForTimeout(4000)

const progressText = await page.evaluate(() => document.querySelector('.progress-panel')?.innerText)
console.log('progress:', progressText)
const errorText = await page.evaluate(() => document.querySelector('.error-banner')?.textContent ?? null)
console.log('error banner:', errorText)

await app.close()
console.log('regression check done')
