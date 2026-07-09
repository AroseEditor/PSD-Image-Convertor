import { app, safeStorage } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { KeyStatus, ProviderId } from '@shared/types'

const PROVIDER_IDS: ProviderId[] = ['gemini', 'openai', 'anthropic']

function keysFilePath(): string {
  return join(app.getPath('userData'), 'provider-keys.json')
}

type StoredKeys = Partial<Record<ProviderId, string>>

async function readAll(): Promise<StoredKeys> {
  try {
    const raw = await fs.readFile(keysFilePath(), 'utf-8')
    return JSON.parse(raw) as StoredKeys
  } catch {
    return {}
  }
}

async function writeAll(data: StoredKeys): Promise<void> {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(keysFilePath(), JSON.stringify(data), 'utf-8')
}

export async function saveKey(provider: ProviderId, plaintext: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('secure_storage_unavailable')
  }
  const encrypted = safeStorage.encryptString(plaintext).toString('base64')
  const all = await readAll()
  all[provider] = encrypted
  await writeAll(all)
}

export async function getKey(provider: ProviderId): Promise<string | null> {
  const all = await readAll()
  const encrypted = all[provider]
  if (!encrypted) return null
  return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
}

export async function clearKey(provider: ProviderId): Promise<void> {
  const all = await readAll()
  delete all[provider]
  await writeAll(all)
}

export async function getStatus(): Promise<KeyStatus> {
  const all = await readAll()
  const status = {} as KeyStatus
  for (const provider of PROVIDER_IDS) {
    status[provider] = !!all[provider]
  }
  return status
}
