import sharp from 'sharp'
import type { LayerPlan } from '@shared/types'
import type { PlannerContext } from '../pipeline/prompts'

/**
 * Dev-only mock mode: set PSD_GEN_MOCK_PROVIDERS=1 to bypass real provider API calls
 * everywhere (planning, image generation, chat titling) and exercise the full
 * plan -> generate -> composite -> PSD pipeline with synthetic data, at zero cost.
 * Never enabled in a normal user run (the env var is never set by the app itself).
 */
export function isMockMode(): boolean {
  return process.env.PSD_GEN_MOCK_PROVIDERS === '1'
}

export async function mockPngBuffer(width: number, height: number, color: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({
    create: { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)), channels: 4, background: { ...color, alpha: 1 } }
  })
    .png()
    .toBuffer()
}

const PALETTE = [
  { r: 120, g: 170, b: 230 },
  { r: 230, g: 150, b: 120 },
  { r: 150, g: 210, b: 150 },
  { r: 210, g: 180, b: 90 }
]

export function mockLayerPlan(rawPrompt: string, ctx: PlannerContext): LayerPlan {
  const w = ctx.canvasWidth
  const h = ctx.canvasHeight

  if (ctx.previousPlan) {
    // Edit turn: keep everything, mark just the first layer changed to exercise the reuse path.
    return {
      ...ctx.previousPlan,
      enhancedPrompt: `${ctx.previousPlan.enhancedPrompt} (edited: ${rawPrompt})`,
      layers: ctx.previousPlan.layers.map((l, i) => ({ ...l, changed: i === 0 }))
    }
  }

  return {
    enhancedPrompt: `Mock render of: ${rawPrompt}`,
    canvasWidth: w,
    canvasHeight: h,
    layers: [
      { name: 'background', prompt: 'background', z: 0, bbox: { x: 0, y: 0, w, h }, changed: true },
      {
        name: 'subject',
        prompt: 'subject',
        z: 1,
        bbox: { x: Math.round(w * 0.25), y: Math.round(h * 0.2), w: Math.round(w * 0.5), h: Math.round(h * 0.6) },
        changed: true
      },
      {
        name: 'letter',
        prompt: 'blank letter, no visible text, no handwriting, blank surface only',
        z: 2,
        bbox: { x: Math.round(w * 0.55), y: Math.round(h * 0.55), w: Math.round(w * 0.3), h: Math.round(h * 0.2) },
        changed: true
      }
    ],
    letterText: {
      content: rawPrompt.slice(0, 60),
      layerName: 'letter',
      approxPosition: { x: 10, y: 10 },
      fontSize: 18
    }
  }
}

export function mockLayerColor(layerName: string): { r: number; g: number; b: number } {
  let hash = 0
  for (let i = 0; i < layerName.length; i++) hash = (hash * 31 + layerName.charCodeAt(i)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

export function mockTitle(rawPrompt: string): string {
  return `Mock: ${rawPrompt.slice(0, 30)}`
}
