import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'

interface AppSettings {
  lastUsedImageModelId?: string
}

function settingsFilePath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

async function readSettings(): Promise<AppSettings> {
  try {
    const raw = await fs.readFile(settingsFilePath(), 'utf-8')
    return JSON.parse(raw) as AppSettings
  } catch {
    return {}
  }
}

async function writeSettings(settings: AppSettings): Promise<void> {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(settingsFilePath(), JSON.stringify(settings), 'utf-8')
}

export async function getLastUsedImageModelId(): Promise<string | undefined> {
  const settings = await readSettings()
  return settings.lastUsedImageModelId
}

export async function setLastUsedImageModelId(modelId: string): Promise<void> {
  const settings = await readSettings()
  settings.lastUsedImageModelId = modelId
  await writeSettings(settings)
}
