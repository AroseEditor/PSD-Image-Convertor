import type { ModelCatalog, ModelInfo, ProviderId } from '@shared/types'
import raw from './modelCatalog.json'

const catalog = raw as ModelCatalog

export function getCatalog(): ModelCatalog {
  return catalog
}

export function providerOf(modelId: string): ProviderId | undefined {
  for (const providerId of Object.keys(catalog.providers) as ProviderId[]) {
    if (catalog.providers[providerId].models.some((m) => m.id === modelId)) {
      return providerId
    }
  }
  return undefined
}

export function modelInfoOf(modelId: string): ModelInfo | undefined {
  for (const providerId of Object.keys(catalog.providers) as ProviderId[]) {
    const found = catalog.providers[providerId].models.find((m) => m.id === modelId)
    if (found) return found
  }
  return undefined
}

export function supportsNativeTransparency(modelId: string): boolean {
  return modelInfoOf(modelId)?.supportsNativeTransparency ?? false
}

export function defaultModelId(): string {
  return catalog.defaultModelId
}
