# CLAUDE.md

## Project Overview

Parley is a standalone Next.js 15 webapp for situational language learning through immersive roleplay. Users set up a scenario, chat with an AI NPC in a target language, and receive a debrief with key phrases.

## Commands

- `npm run dev` — Start dev server (Turbopack)
- `npm run build` — Production build
- `npm run start` — Start production server

## Architecture

Next.js 15 App Router with two pages:

- **`/`** — Setup form (scenario, language, level, goal)
- **`/chat/[id]`** — Conversation + debrief

### API Routes

- `POST /api/conversation` — Create conversation (generates scene image + NPC profile + opening)
- `GET /api/conversation/[id]` — Hydrate conversation state (for page refresh)
- `POST /api/conversation/[id]/message` — Send message (SSE stream response)
- `POST /api/conversation/[id]/quit` — Quit and generate debrief

### Key Directories

- `app/` — Pages and API route handlers
- `lib/` — Shared library (types, OpenAI, FAL, conversations store, SSE client)
- `components/` — React components

### State Management

- Server: in-memory `Map<string, Conversation>` via `globalThis` (survives dev hot reloads)
- Client: React `useState` + sessionStorage for hydration on navigation

## Tech Stack

Next.js 15, Tailwind CSS v4, Zod, OpenAI SDK, FAL SDK, TypeScript strict mode.

## Conventions

- TypeScript strict mode with `verbatimModuleSyntax`
- Plain `<img>` tags for dynamic FAL image URLs
- SSE via `fetch` POST (not `EventSource`) for message streaming
