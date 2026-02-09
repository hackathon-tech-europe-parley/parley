# CLAUDE.md

## Project Overview

Parley is a standalone Next.js 15 webapp for situational language learning through immersive roleplay. Users pick a language, choose a difficulty and scenario, then chat with an AI NPC in the target language. After the conversation they receive a debrief with key phrases.

## Commands

- `bun run dev` — Start dev server (Turbopack)
- `bun run build` — Production build
- `bun run start` — Start production server
- `bun run lint` — Lint and format check (Biome)
- `bun run lint:fix` — Auto-fix lint and formatting issues

## Architecture

Next.js 15 App Router with two pages:

- **`/`** — 2-step setup: pick language, then pick difficulty + scenario (each scenario has per-level goals)
- **`/chat/[id]`** — Conversation with goal banner, scene image, hints, and debrief

### Difficulty Levels

- **Beginner** — Simple vocabulary, patient NPC, full phrase hints
- **Intermediate** — Natural speech, moderate tolerance, vocabulary hints
- **Advanced** — Idioms and slang, demanding NPC, minimal hints
- **Impossible** — Literary/archaic register, uncooperative NPC, no hints, absurd goals

### API Routes

- `POST /api/conversation` — Create conversation (generates scene image + NPC profile + opening)
- `GET /api/conversation/[id]` — Hydrate conversation state (for page refresh)
- `POST /api/conversation/[id]/message` — Send message (SSE stream response)
- `POST /api/conversation/[id]/quit` — Quit and generate debrief

### Key Directories

- `app/` — Pages, layout (global header), and API route handlers
- `core/` — Domain logic organized by feature:
  - `core/npc/` — NPC conversation feature (generation, prompts, policy, assets, messages, parsing)
  - `core/debrief/` — Post-conversation debrief (generation, metrics, prompts)
  - `core/scenario/` — Custom scenario generation (generation, prompts)
  - `core/safety/` — Content moderation (taboo rules)
  - `core/types/` — TypeScript types, Zod schemas, constants, LLM response schemas
  - `core/env.ts` — Environment variable validation
  - `core/logger.ts` — Pino logger with AsyncLocalStorage context
- `infra/` — External provider bindings (thin adapters):
  - `infra/llm/` — LLM abstraction wrapping Vercel AI SDK
  - `infra/image/` — Image generation (FAL)
  - `infra/tts/` — Text-to-speech (Gradium)
  - `infra/stt/` — Speech-to-text (Gradium)
  - `infra/storage/` — Conversation persistence (PostgreSQL or in-memory)
- `components/` — React components (setup-form, chat)
  - `components/chat/lib/` — Client-side utilities (SSE consumer, TTS player, audio recorder)

### Layout

- Global header with logo and "New session" link (in `app/layout.tsx`)
- Footer only on the home page (in `app/page.tsx`), not on the chat page

### State Management

- Server: in-memory `Map<string, Conversation>` via `globalThis` (survives dev hot reloads)
- Client: React `useState` + sessionStorage for hydration on navigation

## Tech Stack

Next.js 15, Tailwind CSS v4, Biome (lint + format), Zod, OpenAI SDK, FAL SDK, TypeScript strict mode.

## Conventions

- TypeScript strict mode with `verbatimModuleSyntax`
- Plain `<img>` tags for dynamic FAL image URLs
- SSE via `fetch` POST (not `EventSource`) for message streaming
- Dark theme throughout (slate-950 background, blue-600 primary, red-600 for impossible mode)
