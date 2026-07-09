import { z } from 'zod'

export const layerBBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number()
})

export const layerPlanLayerSchema = z.object({
  name: z.string(),
  prompt: z.string(),
  z: z.number(),
  bbox: layerBBoxSchema,
  changed: z.boolean().optional()
})

export const layerPlanLetterTextSchema = z.object({
  content: z.string(),
  fontSize: z.number().optional(),
  layerName: z.string(),
  approxPosition: z.object({ x: z.number(), y: z.number() })
})

export const layerPlanSchema = z.object({
  enhancedPrompt: z.string(),
  canvasWidth: z.number(),
  canvasHeight: z.number(),
  layers: z.array(layerPlanLayerSchema).min(1),
  letterText: layerPlanLetterTextSchema.optional()
})
