import sharp from 'sharp'
import { writePsdBuffer, readPsd, type Psd, type Layer } from 'ag-psd'
import type { LayerPlan, LayerPlanLetterText } from '@shared/types'
import { buildComposite, type CompositeLayer } from './compositor'

export interface AssemblyLayer extends CompositeLayer {
  usedChromaKeyFallback?: boolean
}

const DEFAULT_FONT_NAME = 'ArialMT'
const DEFAULT_FONT_SIZE = 36

async function pngToPixelData(pngBuffer: Buffer): Promise<{
  width: number
  height: number
  data: Uint8ClampedArray
}> {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)
  }
}

function buildTextLayer(plan: LayerPlan, letterText: LayerPlanLetterText): Layer | undefined {
  const hostLayer = plan.layers.find((l) => l.name === letterText.layerName)
  if (!hostLayer) return undefined

  const absoluteX = hostLayer.bbox.x + letterText.approxPosition.x
  const absoluteY = hostLayer.bbox.y + letterText.approxPosition.y

  return {
    name: 'Letter Text',
    text: {
      text: letterText.content,
      transform: [1, 0, 0, 1, absoluteX, absoluteY],
      style: {
        font: { name: DEFAULT_FONT_NAME },
        fontSize: letterText.fontSize ?? DEFAULT_FONT_SIZE,
        fillColor: { r: 25, g: 25, b: 25 }
      },
      paragraphStyle: { justification: 'left' }
    }
  }
}

/**
 * Builds a real, multi-layer, Photoshop-editable PSD: every scene element is its
 * own named/positioned image layer, plus (when present) a genuine editable text
 * layer for the letter's wording — not pixels baked into an image layer.
 */
export async function buildPsd(plan: LayerPlan, layers: AssemblyLayer[]): Promise<Buffer> {
  // Ascending z (bottom to top) — ag-psd's `children` array is bottom-first, confirmed
  // via round-trip readPsd() in verifyPsd() below.
  const sorted = [...layers].sort((a, b) => a.z - b.z)

  const imageLayers: Layer[] = await Promise.all(
    sorted.map(async (layer): Promise<Layer> => {
      const imageData = await pngToPixelData(layer.pngBuffer)
      return {
        name: layer.name,
        left: Math.round(layer.bbox.x),
        top: Math.round(layer.bbox.y),
        right: Math.round(layer.bbox.x + layer.bbox.w),
        bottom: Math.round(layer.bbox.y + layer.bbox.h),
        blendMode: 'normal',
        opacity: 255,
        imageData
      }
    })
  )

  const textLayer = plan.letterText ? buildTextLayer(plan, plan.letterText) : undefined
  const children = textLayer ? [...imageLayers, textLayer] : imageLayers

  const compositePng = await buildComposite(plan.canvasWidth, plan.canvasHeight, layers)
  const compositeImageData = await pngToPixelData(compositePng)

  const psd: Psd = {
    width: plan.canvasWidth,
    height: plan.canvasHeight,
    children,
    imageData: compositeImageData
  }

  // generateThumbnail needs a `canvas` (node-canvas) polyfill wired up via
  // ag-psd/initialize-canvas — skipped since every layer already carries raw
  // imageData and Photoshop regenerates its own thumbnail on open regardless.
  return writePsdBuffer(psd, { generateThumbnail: false })
}

export interface PsdVerificationResult {
  ok: boolean
  issues: string[]
  layerCount: number
  hasTextLayer: boolean
}

/** Round-trips the written PSD through ag-psd's own reader as a structural sanity check. */
export function verifyPsd(psdBuffer: Buffer, expectedLayerNames: string[]): PsdVerificationResult {
  const issues: string[] = []
  // skipLayerImageData avoids ag-psd's pixel decode path, which unconditionally needs a
  // node-canvas polyfill (ag-psd/initialize-canvas) we don't wire up — this check only
  // needs structure (names/bounds/text), not decoded pixels.
  const parsed = readPsd(psdBuffer, {
    skipCompositeImageData: true,
    skipThumbnail: true,
    skipLayerImageData: true
  })
  const children = parsed.children ?? []

  if (children.length < expectedLayerNames.length) {
    issues.push(`expected at least ${expectedLayerNames.length} layers, found ${children.length}`)
  }

  for (const name of expectedLayerNames) {
    const layer = children.find((c) => c.name === name)
    if (!layer) {
      issues.push(`missing expected layer "${name}"`)
    } else if (layer.right === layer.left || layer.bottom === layer.top) {
      issues.push(`layer "${name}" has a degenerate (zero-size) bounding box after round-trip`)
    }
  }

  const textLayer = children.find((c) => c.text)
  const hasTextLayer = !!textLayer
  if (textLayer && !textLayer.text?.text) {
    issues.push('text layer round-tripped without its text content')
  }

  return { ok: issues.length === 0, issues, layerCount: children.length, hasTextLayer }
}
