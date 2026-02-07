# Parley

Situational language learning through immersive roleplay. Pick a language, choose a scenario, and chat with an AI character to practice real-world conversations.

## Features

- **12 languages** — Spanish, French, German, Italian, Portuguese, Japanese, Korean, Chinese, Arabic, Russian, Dutch, Swedish
- **12 scenarios** — Taxi rides, caf\u00e9 orders, job interviews, market haggling, and more
- **4 difficulty levels** — Beginner, Intermediate, Advanced, and Impossible (absurdly hard goals even native speakers would struggle with)
- **AI-powered NPC** — Dynamic character with evolving mood, personality, and realistic responses
- **Scene generation** — AI-generated images that update as the conversation progresses
- **Debrief** — Post-conversation summary with key phrases and translations

## Getting Started

### Prerequisites

- Node.js 20+
- OpenAI API key
- FAL AI API key

### Setup

```bash
npm install
```

Create a `.env.local` file:

```
OPENAI_API_KEY=your-key-here
FAL_KEY=your-key-here
```

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm run start
```

## Tech Stack

- Next.js 15 (App Router, Turbopack)
- React 19
- Tailwind CSS v4
- TypeScript (strict mode)
- OpenAI SDK
- FAL AI (image generation)
- Zod (validation)
