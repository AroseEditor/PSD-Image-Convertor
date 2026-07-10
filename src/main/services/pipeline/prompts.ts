import type { AttachedImage, LayerPlan, LayerPlanLayer } from '@shared/types'

export const LAYER_PLAN_TOOL_NAME = 'submit_layer_plan'

export const LAYER_PLAN_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['enhancedPrompt', 'canvasWidth', 'canvasHeight', 'layers'],
  properties: {
    enhancedPrompt: { type: 'string' },
    canvasWidth: { type: 'integer' },
    canvasHeight: { type: 'integer' },
    layers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'prompt', 'z', 'bbox', 'changed'],
        properties: {
          name: { type: 'string' },
          prompt: { type: 'string' },
          z: { type: 'integer' },
          changed: {
            type: 'boolean',
            description:
              'true if this layer is new or its image needs (re)generating this turn; false to keep the previously generated image as-is.'
          },
          bbox: {
            type: 'object',
            additionalProperties: false,
            required: ['x', 'y', 'w', 'h'],
            properties: {
              x: { type: 'integer' },
              y: { type: 'integer' },
              w: { type: 'integer' },
              h: { type: 'integer' }
            }
          }
        }
      }
    },
    letterText: {
      type: 'object',
      additionalProperties: false,
      required: ['content', 'layerName', 'approxPosition'],
      properties: {
        content: { type: 'string' },
        fontSize: { type: 'integer' },
        layerName: {
          type: 'string',
          description: 'Must exactly match the "name" of the blank surface layer this text sits on.'
        },
        approxPosition: {
          type: 'object',
          additionalProperties: false,
          required: ['x', 'y'],
          properties: { x: { type: 'integer' }, y: { type: 'integer' } }
        }
      }
    }
  }
} as const

export const LAYER_PLANNER_SYSTEM_PROMPT = `You are a scene-decomposition assistant for an image-to-PSD pipeline. Given a
user's image request, you produce a structured plan that a downstream image
generation model will use to draw the scene as SEPARATE layers that get
assembled into a Photoshop file, so a human editor can drag/move/hide each
element independently.

You do two things:

1. Rewrite the request into a single richer, more visually specific
   description (materials, lighting, mood, composition) that all layers will
   share as style context. Keep it to 2-4 sentences.

2. Decompose the scene into a small ordered list of independent visual layers
   that, composited bottom-to-top, reproduce the scene. Rules:
   - Always include a "background" layer at z=0 unless the scene has no
     meaningful background (rare).
   - Give every other distinct physical object/character its own layer (e.g.
     a person, a pen, a piece of paper) — never merge two objects a human
     editor would want to move independently into one layer.
   - Provide an approximate bounding box (x, y, width, height) in a canvas of
     the given canvasWidth x canvasHeight for every layer, placed so the
     composited result matches a natural reading of the scene. Z-order must
     make physical sense (things "held" or "on top of" another object need a
     higher z than what they rest on).
   - If the scene involves any paper, letter, sign, book, screen, or other
     surface that would naturally display legible text, create a SEPARATE
     layer for that surface using a prompt describing it completely BLANK —
     explicitly state "no visible text, no handwriting, no printed words,
     blank surface only" in that layer's own prompt field, and ALSO populate
     the top-level letterText field with the words that should appear on it,
     its layerName set to that blank layer's exact name, and an approximate
     x/y position RELATIVE TO that layer's own bounding box (not the full
     canvas). If no such surface exists, omit letterText.
   - Each layer's own "prompt" field must describe ONLY that one element, in
     isolation, incorporating relevant style/lighting notes from your
     rewritten description so all layers look consistent when composited.

EDIT MODE: if a PREVIOUS PLAN is supplied along with a new instruction, you
are editing an existing image, not starting fresh. In that case:
   - Reuse the previous plan's layers, names, bboxes, and z-order as your
     starting point.
   - Only change what the new instruction asks for. For any layer whose
     prompt or bbox you actually change (or a brand-new layer you add), set
     changed: true. For every layer that stays exactly as it was, copy its
     previous name/prompt/z/bbox verbatim and set changed: false — do not
     silently reword an unchanged layer's prompt, since that would force an
     unnecessary, costly regeneration.
   - If the instruction only touches the letter's wording, keep every layer's
     changed flag false and only update letterText.
   - On the very first turn (no previous plan), set changed: true on every
     layer.

UPLOADED IMAGE MODE: if an image is attached, it is a real photo/picture the
user provided — look at it and describe what is ACTUALLY in it, don't invent
a different scene. Decompose what you see into the same kind of layer list
(background + one layer per distinct real object you can identify), sized and
positioned to match where those objects actually appear in the attached
image's own dimensions (canvasWidth x canvasHeight below refers to that
image's real pixel size). Fold the user's requested edit into the prompt of
whichever specific layer(s) it applies to (e.g. "make the pen red" only
changes the pen layer's prompt to describe it as red, set that layer's
changed: true; every other layer's prompt should describe what's already
there in the photo, unchanged, and can be set changed: false if this is also
an edit turn with a previous plan, or changed: true if this is the first time
this photo is being decomposed). Recreating another person's real photo from
a text description is inherently approximate — describe it as precisely as
you can rather than guessing generically. If both a previous plan AND a newly
attached image are present, prefer the attached image as the current visual
ground truth.

Call the submit_layer_plan tool exactly once with your result. Do not include
any other commentary.`

export interface PlannerContext {
  canvasWidth: number
  canvasHeight: number
  previousPlan?: LayerPlan
  /** A user-uploaded/pasted/dragged photo — vision-capable adapters attach the actual
   *  image bytes as a separate content block; this text just tells the model it's there. */
  attachedImage?: AttachedImage
}

export function buildPlannerUserMessage(rawPrompt: string, ctx: PlannerContext): string {
  const canvasLine = `Canvas size: ${ctx.canvasWidth}x${ctx.canvasHeight}.`
  const attachmentLine = ctx.attachedImage
    ? '\n\nAn image is attached above/alongside this message — see UPLOADED IMAGE MODE in your instructions.'
    : ''

  if (!ctx.previousPlan) {
    return `${canvasLine}\n\nUser request (new image): ${rawPrompt}${attachmentLine}`
  }
  return [
    canvasLine,
    '',
    'PREVIOUS PLAN (JSON):',
    JSON.stringify(ctx.previousPlan),
    '',
    `New instruction from the user (an edit to the existing image): ${rawPrompt}${attachmentLine}`
  ].join('\n')
}

export function buildLayerImagePrompt(
  layer: LayerPlanLayer,
  enhancedPrompt: string,
  transparentBackground: boolean,
  hasReferenceImage = false
): string {
  const referenceLine = hasReferenceImage
    ? `\n- A reference photo is attached — this subject should match how it actually looks in that photo (pose, colors, materials), isolated from everything else in it, with the requested edit applied if this element is the one being edited.`
    : ''

  return `${layer.prompt}

Style and lighting reference (for consistency across all elements in this composite image, do not depict any other elements from this description — draw ONLY the single subject above): ${enhancedPrompt}

Requirements:
- Depict exactly one isolated subject: ${layer.name}. No other objects, people, or background elements.
- ${
    transparentBackground
      ? 'Transparent background. Output a PNG with a clean alpha channel around the subject — no background color, texture, or shadow baked outside the subject silhouette.'
      : 'Background must be a single flat, saturated pure green (#00FF00), evenly lit, no gradients, no texture, no shadow on the background — only on the subject itself.'
  }
- No text, logos, or watermarks anywhere in the image unless the subject IS handwritten/printed text (this subject is not).
- Consistent art style, color palette, and lighting direction with the style reference above.
- Centered composition, subject fully contained within the frame with a small margin, matching an approximate ${layer.bbox.w}x${layer.bbox.h} aspect ratio.${referenceLine}`
}

export const CHAT_TITLE_SYSTEM_PROMPT =
  'Generate a short chat title (3-6 words, no quotes, no trailing period) that summarizes the image being requested. Reply with the title text only, nothing else.'
