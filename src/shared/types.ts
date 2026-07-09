export type ProviderId = 'gemini' | 'openai' | 'anthropic'

export interface ModelInfo {
  id: string
  label: string
  supportsNativeTransparency?: boolean
  isDefault?: boolean
}

export interface ProviderCatalogGroup {
  label: string
  models: ModelInfo[]
}

export interface ModelCatalog {
  catalogVersion: number
  defaultModelId: string
  providers: Record<ProviderId, ProviderCatalogGroup>
}

export type KeyStatus = Record<ProviderId, boolean>

export interface GenerationRequest {
  prompt: string
  modelId: string
  providerId: ProviderId
  /** Omit to start a brand-new chat; pass an existing id to continue it (edit-in-context). */
  chatId?: string
}

export type GenerationStage =
  | 'starting'
  | 'enhancing'
  | 'planning'
  | 'generating-layer'
  | 'generated-layer'
  | 'compositing'
  | 'assembling-psd'
  | 'done'

export interface GenerationProgressEvent {
  jobId: string
  chatId: string
  stage: GenerationStage
  layerName?: string
  message: string
  percent: number
}

export interface GenerationPreviewEvent {
  jobId: string
  chatId: string
  previewPngBase64: string
  width: number
  height: number
}

export interface GenerationCompleteEvent {
  jobId: string
  chatId: string
  psdPath?: string
}

export type NormalizedErrorCode =
  | 'invalid_api_key'
  | 'no_payment_method'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'model_access_denied'
  | 'network_error'
  | 'server_error'
  | 'missing_api_key'
  | 'unknown'

export interface NormalizedError {
  code: NormalizedErrorCode
  message: string
  retryable: boolean
  providerId: ProviderId
}

export interface GenerationErrorEvent {
  jobId: string
  chatId?: string
  error: NormalizedError
}

export interface LayerBBox {
  x: number
  y: number
  w: number
  h: number
}

export interface LayerPlanLayer {
  name: string
  prompt: string
  z: number
  bbox: LayerBBox
  /** Planner sets this on edit turns: false means reuse the previous image unchanged. */
  changed?: boolean
}

export interface LayerPlanLetterText {
  content: string
  fontSize?: number
  /** Name of the layer (e.g. the blank letter/paper) this text sits on top of. */
  layerName: string
  /** Position relative to that layer's own bbox top-left, not the full canvas. */
  approxPosition: { x: number; y: number }
}

export interface LayerPlan {
  enhancedPrompt: string
  canvasWidth: number
  canvasHeight: number
  layers: LayerPlanLayer[]
  letterText?: LayerPlanLetterText
}

export type ChatMessageRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatMessageRole
  text: string
  createdAt: string
  /** Present on assistant messages once generation succeeds. */
  previewPngBase64?: string
  psdPath?: string
  /** Present on assistant messages that failed. */
  error?: NormalizedError
}

export interface ChatSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface Chat extends ChatSummary {
  messages: ChatMessage[]
  /** Last successful layer plan, kept for edit-in-context continuity. */
  lastLayerPlan?: LayerPlan
  /** Absolute paths to each layer's PNG on disk, keyed by layer name, for edit-turn reuse. */
  layerAssetPaths?: Record<string, string>
  lastModelId?: string
  lastProviderId?: ProviderId
}
