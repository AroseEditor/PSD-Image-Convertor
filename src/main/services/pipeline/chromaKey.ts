import sharp from 'sharp'

const KEY_R = 0
const KEY_G = 255
const KEY_B = 0
const FULLY_TRANSPARENT_DISTANCE = 60
const SOFT_EDGE_DISTANCE = 120

/** Keys a solid green (#00FF00) background out to alpha transparency, with a soft edge falloff. */
export async function chromaKeyGreenToAlpha(pngBuffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const distance = Math.sqrt((r - KEY_R) ** 2 + (g - KEY_G) ** 2 + (b - KEY_B) ** 2)

    if (distance < FULLY_TRANSPARENT_DISTANCE) {
      data[i + 3] = 0
    } else if (distance < SOFT_EDGE_DISTANCE) {
      const t = (distance - FULLY_TRANSPARENT_DISTANCE) / (SOFT_EDGE_DISTANCE - FULLY_TRANSPARENT_DISTANCE)
      data[i + 3] = Math.min(data[i + 3], Math.round(255 * t))
    }
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer()
}
