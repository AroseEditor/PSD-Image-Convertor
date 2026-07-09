import sharp from 'sharp'
import type { LayerBBox } from '@shared/types'

export interface CompositeLayer {
  name: string
  z: number
  bbox: LayerBBox
  pngBuffer: Buffer
}

export async function buildComposite(
  canvasWidth: number,
  canvasHeight: number,
  layers: CompositeLayer[]
): Promise<Buffer> {
  const sorted = [...layers].sort((a, b) => a.z - b.z)

  const composites = await Promise.all(
    sorted.map(async (layer) => {
      const resized = await sharp(layer.pngBuffer)
        .resize(Math.max(1, Math.round(layer.bbox.w)), Math.max(1, Math.round(layer.bbox.h)), {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer()
      return { input: resized, left: Math.round(layer.bbox.x), top: Math.round(layer.bbox.y) }
    })
  )

  return sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(composites)
    .png()
    .toBuffer()
}
