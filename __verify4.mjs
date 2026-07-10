import { _electron as electron } from 'playwright-core'
import path from 'node:path'
import { readPsd } from 'ag-psd'
import { rm, readFile } from 'node:fs/promises'

const APP_DIR = 'C:\\Users\\iusem\\Downloads\\My Work\\PSD Convertor'
const SHOT_DIR = 'C:\\Users\\iusem\\AppData\\Local\\Temp\\claude\\C--Users-iusem-Downloads-My-Work-PSD-Convertor\\5ff43ce9-5cec-4807-90b2-7b7ed4d78693\\scratchpad'
const USER_DATA_DIR = 'C:\\Users\\iusem\\AppData\\Roaming\\psd-convertor'
const TEST_IMAGE = path.join(SHOT_DIR, 'test-upload.png')

await rm(path.join(USER_DATA_DIR, 'chats.json'), { force: true })
await rm(path.join(USER_DATA_DIR, 'chats'), { recursive: true, force: true })

const app = await electron.launch({ args: [APP_DIR], env: { ...process.env, PSD_GEN_MOCK_PROVIDERS: '1' }, timeout: 30000 })
app.process().stderr?.on('data', (d) => process.stdout.write('[main stderr] ' + d))

const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(800)

// Save a fake key so the missing-key gate doesn't block us.
await page.locator('button', { hasText: 'Settings' }).click()
await page.waitForTimeout(200)
await page.locator('input[type="password"]').first().fill('mock-mode-fake-key')
await page.locator('button', { hasText: 'Save' }).first().click()
await page.waitForTimeout(300)
await page.locator('button', { hasText: 'Done' }).click()
await page.waitForTimeout(200)

// Attach a file via the hidden file input (simulating the Attach button -> file picker)
await page.locator('input[type="file"]').setInputFiles(TEST_IMAGE)
await page.waitForTimeout(300)
const chipVisible = await page.locator('.attachment-chip img').isVisible()
console.log('attachment chip visible after file select:', chipVisible)
await page.screenshot({ path: path.join(SHOT_DIR, '20-attached.png') })

// Submit an edit instruction against the uploaded image
await page.locator('textarea').fill('make the background warmer')
await page.locator('button', { hasText: 'Send edit' }).click()
await page.waitForTimeout(4000)

const progressText = await page.evaluate(() => document.querySelector('.progress-panel')?.innerText)
console.log('progress log:', progressText)

await page.screenshot({ path: path.join(SHOT_DIR, '21-upload-edit-done.png') })

const userBubbleHasThumb = await page.locator('.message.user .message-attached-thumb').first().isVisible()
console.log('user bubble shows attached thumbnail:', userBubbleHasThumb)

const hasDownloadImageBtn = await page.locator('button', { hasText: 'Download image' }).count()
const hasFileAttachment = await page.locator('.file-attachment').count()
console.log('Download image buttons:', hasDownloadImageBtn, '| file-attachment chips:', hasFileAttachment)

await app.close()

const chats = JSON.parse(await readFile(path.join(USER_DATA_DIR, 'chats.json'), 'utf-8'))
console.log('chats:', chats.length)
const chat = chats[0]
console.log('messages:', chat.messages.length)
console.log('user message has attachedImagePngBase64:', !!chat.messages[0].attachedImagePngBase64)
console.log('lastLayerPlan layers:', chat.lastLayerPlan?.layers?.map((l) => l.name))

const lastAssistant = [...chat.messages].reverse().find((m) => m.psdPath)
const psdBuffer = await readFile(lastAssistant.psdPath)
const parsed = readPsd(psdBuffer, { skipCompositeImageData: true, skipThumbnail: true, skipLayerImageData: true })
console.log('PSD layers:', parsed.children?.map((c) => c.name))

console.log('ALL DONE')
