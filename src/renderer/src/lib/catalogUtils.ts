import type { ModelCatalog, ProviderId } from '@shared/types'

export function providerOfModel(catalog: ModelCatalog, modelId: string): ProviderId | undefined {
  for (const providerId of Object.keys(catalog.providers) as ProviderId[]) {
    if (catalog.providers[providerId].models.some((m) => m.id === modelId)) {
      return providerId
    }
  }
  return undefined
}
