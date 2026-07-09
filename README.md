<div align="center">

# PSD Image Generator

**Describe a scene in plain English. Get back a real, layered, Photoshop-editable `.psd` file.**

[![Release](https://github.com/AroseEditor/PSD-Image-Convertor/actions/workflows/release.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/release.yml)
![Platform](https://img.shields.io/badge/platform-Windows-0078D6)
![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)

</div>


---

## What this is

Type *"a person writing a letter"* into the box, pick a model, and instead of getting back one flat picture, you get a `.psd` where the **person**, the **pen**, and the **letter** are each their own draggable Photoshop layer — and any writing on the letter is a real, independently editable **text layer**, not pixels baked into the image.

Every generation is saved as a chat, like a conversation with an AI assistant. Come back to it later and ask for a tweak — *"make the pen red"* — and only the parts that actually need to change get regenerated; everything else is reused exactly as it was. Start a **New Chat** and you get a completely blank slate, with zero memory of anything before it.

## Features

- **Multi-provider model picker** — Gemini and OpenAI models actually render images; Claude models are grouped separately as prompt enhancers, since Anthropic has no image-generation API.
- **Real layered PSD output** — every scene element is generated as its own isolated image and assembled into a genuine multi-layer Photoshop file via [`ag-psd`](https://github.com/Agamnentzar/ag-psd), not a Frankenstein of pasted pixels.
- **Genuine editable text layers** — any letter/sign/paper in the scene is rendered blank, then a real Photoshop text layer is added on top with the actual wording, fully editable in Photoshop's type tool.
- **Chat history with edit-in-context** — a sidebar of past generations, each with an AI-generated title, that you can reopen and continue editing with full context.
- **Bring your own API keys** — each provider's key is entered locally, encrypted at rest with Electron's OS-level `safeStorage`, and never leaves your machine except in the API calls you make yourself.
- **Readable errors** — invalid key, no billing set up, quota exceeded, rate limited, wrong account tier — all normalized into a plain-English message instead of a raw stack trace.
- **CI-built installer** — push a version tag and GitHub Actions builds a signed-off NSIS `setup.exe` and drafts a GitHub Release with auto-generated notes, ready for a maintainer to review and publish.

## Table of contents

- [How it works](#how-it-works)
- [Getting started](#getting-started)
- [API keys & security](#api-keys--security)
- [Using the app](#using-the-app)
- [Architecture](#architecture)
- [Model catalog maintenance](#model-catalog-maintenance)
- [Testing without spending API credits](#testing-without-spending-api-credits)
- [Releases & CI](#releases--ci)
- [Known limitations](#known-limitations)
- [Project structure](#project-structure)

## How it works

```
your prompt
     │
     ▼
┌─────────────────┐   Claude (optional) rewrites/expands the prompt and
│   1. Plan        │   plans a small set of independent layers — background,
└─────────────────┘   each distinct object, and a blank version of any
     │                 surface that should show text.
     ▼
┌─────────────────┐   Each layer is rendered separately, in parallel, on
│  2. Generate     │   a transparent (or green-screen → chroma-keyed)
└─────────────────┘   background, so it can stand alone as its own layer.
     │
     ▼
┌─────────────────┐   All layers are flattened into a preview PNG so
│  3. Composite    │   you can see the result immediately.
└─────────────────┘
     │
     ▼
┌─────────────────┐   A real .psd is written to disk: every element is
│  4. Assemble     │   its own named, positioned, draggable layer, plus a
└─────────────────┘   genuine editable Photoshop text layer for any wording.
     │
     ▼
┌─────────────────┐   Ask for a change in the same chat and only the
│  5. Edit in      │   affected layers are regenerated — everything else
│     place        │   is reused from the previous turn.
└─────────────────┘
```

## Getting started

**Requirements:** Node.js **20.19+ or 22.12+**. (Older Node 20.x patch releases are too old for the current Electron/electron-vite toolchain and will fail during `npm install`'s Electron binary download — this bit us during development, see the workflow file for the exact Node version CI uses.)

```bash
npm install
npm run dev      # launches the app with hot reload
```

Production build (compiled app, no installer):

```bash
npm run build
```

Windows installer (same thing CI does, if you want it locally):

```bash
npm run dist
```

## API keys & security

- Each provider (Gemini, OpenAI, Anthropic) needs your **own** API key, entered via the Settings modal (top-right of the app).
- Keys are encrypted with Electron's OS-level `safeStorage` API and saved to a file in your **local user-data folder** (`%APPDATA%\psd-convertor\provider-keys.json` on Windows) — **never inside this project folder**, so they cannot end up in this repo or get pushed to GitHub, even by accident.
- All provider API calls happen in the Electron **main process**; the renderer (the UI) never sees raw key material, only a yes/no "is a key set" status per provider.
- **Nothing in this codebase contains a real API key.** If you fork or publish this repo, there is nothing to scrub — your keys live only in your own machine's app-data folder, not in git history.
- Common provider errors (invalid key, no billing/payment method on file, quota exceeded, rate limited, model not available on your account tier) are caught and shown as a plain-English message in the app instead of a raw error dump.

## Using the app

- **Model dropdown**: grouped by provider — Gemini and ChatGPT/OpenAI models actually generate images; Claude models are listed at the bottom labeled "(Prompt Enhancer)". Picking a Claude model rewrites/expands your prompt and plans the layers, then automatically hands off to the last image model you used (or the default Gemini model) to actually render — no extra click needed.
- **Sidebar**: every generation is saved as a chat with an AI-generated title. Click a chat to reload its history and continue editing that same image with full context. Click **+ New Chat** to start with zero carried-over context.
- **Editing an image**: with a chat open, just describe the change ("make the pen red", "change the letter to say Goodbye"). The planner reuses the previous layout and only regenerates the layers that actually need to change.
- **Getting the file**: each generated image's chat bubble has a "Show PSD in folder" button that reveals the `.psd` on disk in Explorer.

## Architecture

- **Main process** (`src/main`) owns all secrets and network calls: encrypted key storage (`services/keyStore.ts`), the model catalog, provider adapters (`services/providers/*`), and the generation pipeline (`services/pipeline/*`).
- **Preload** (`src/preload`) exposes a narrow, typed `window.api` surface via `contextBridge` — the renderer has no direct Node/Electron access (`contextIsolation`, `sandbox`, and `nodeIntegration: false` are all on).
- **Renderer** (`src/renderer`) is a plain React + TypeScript UI (Sidebar, model picker, chat thread, settings modal), using `zustand` for state.
- **Pipeline** (`src/main/services/pipeline`):
  - `layerPlanner.ts` — routes to whichever provider should produce the structured `LayerPlan` (Claude via a forced tool call, or the selected Gemini/OpenAI model via structured JSON output).
  - `layerImageGenerator.ts` — generates each changed layer's image with bounded concurrency, applying a chroma-key fallback for models without native transparent-background support.
  - `compositor.ts` — flattens layers into a preview PNG via `sharp`.
  - `psdAssembler.ts` — builds the real multi-layer `.psd` via `ag-psd`, including the editable text layer, plus a lightweight structural round-trip check on every write.
  - `pipelineOrchestrator.ts` — glues the above together and persists results into the chat store.
- **Chats** (`services/chatStore.ts`) are persisted as JSON in the user-data folder, with each chat's generated layer PNGs and PSD stored in its own subfolder for reuse on edit turns.

## Model catalog maintenance

`src/main/services/modelCatalog/modelCatalog.json` is a plain, hand-editable file listing every selectable model per provider. AI providers ship new models faster than this app can track automatically — **check this file's entries against each provider's current model list periodically** and update the `id` values (the exact API model identifier) as needed. Nothing else in the codebase hardcodes a model ID.

## Testing without spending API credits

Set `PSD_GEN_MOCK_PROVIDERS=1` when launching the app (`dev` or the built binary) to make every provider adapter return synthetic data instead of calling a real API — useful for exercising the full plan → generate → composite → PSD pipeline, the chat sidebar, and the edit-in-context flow at zero cost. This is a developer/testing switch only; it's never enabled by the app itself.

## Releases & CI

Pushing a version tag builds and drafts a release automatically:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This runs [`.github/workflows/release.yml`](.github/workflows/release.yml), which:

1. Installs dependencies and type-checks the project on `windows-latest`.
2. Builds the app and packages it into an NSIS `setup.exe` via `electron-builder`.
3. Opens a **draft** GitHub Release for the tag, with GitHub's auto-generated "What's changed" notes (every merged PR / commit since the previous tag) and the installer attached.

Nothing goes live automatically — a maintainer reviews the draft on the repo's Releases page and clicks **Publish** when it's ready. You can also trigger a build manually from the Actions tab (`workflow_dispatch`) without pushing a tag.

## Known limitations

- **No cancel-in-flight**: the Cancel IPC channel exists but doesn't yet abort an in-progress generation job — jobs are short enough that this is a soft gap rather than a blocker.
- **Model IDs may drift**: several catalog entries (e.g. newer Gemini/GPT model versions) were added from a specific point-in-time model list and should be double-checked against the provider's current docs if generation fails with a "model not found"-style error.
- **Chroma-key fallback isn't perfect**: models without native transparent-background support are asked to render on a solid green background that then gets keyed to alpha; very fine detail at the edge of a subject (hair, fur) may show minor fringing.
- **Windows only, for now**: the CI workflow and `electron-builder.yml` target NSIS/Windows specifically; macOS/Linux targets would need their own build config.

## Project structure

```
.github/
  workflows/
    release.yml    # tag-triggered build + draft GitHub Release
src/
  shared/            # types, IPC channel names, zod schema — shared by main & renderer
  main/
    ipc/              # ipcMain.handle registrations
    services/
      keyStore.ts       # encrypted API key storage
      settingsStore.ts  # small app settings (last-used image model, etc.)
      chatStore.ts       # chat persistence
      providers/          # per-provider adapters + error normalization
      modelCatalog/         # the hand-editable model list
      pipeline/              # planning, image generation, compositing, PSD assembly
  preload/            # contextBridge surface
  renderer/           # React UI
electron-builder.yml  # NSIS installer packaging config
```
