# Parley

**2nd Place Winner at [{Tech: Europe} Paris AI Hackathon](https://luma.com/paris-hackathon)**

Situational language learning through immersive roleplay. Pick a language, choose a scenario, and chat with an AI character to practice real-world conversations.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?logo=openai&logoColor=white)](https://openai.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Features

### Immersive Roleplay

- **12 handcrafted scenarios** — Taxi rides, cafe orders, job interviews, market haggling, doctor visits, apartment hunting, and more
- **Custom scenarios** — Generate your own scenario with AI on the fly
- **Difficulty-specific goals** — Each scenario has unique objectives per difficulty level

### AI-Powered Conversations

- **Dynamic NPC** — AI-generated personality with name, backstory, and evolving mood (8 mood states with animated face expressions)
- **Real-time streaming** — NPC responses streamed token-by-token via SSE
- **Conversation policy engine** — Tracks hostility, disengagement, and constructiveness to shape NPC behavior
- **Content moderation** — Built-in taboo word and topic filtering across all languages

### 4 Difficulty Levels

| Level | NPC Behavior | Hints | Goals |
|-------|-------------|-------|-------|
| **Beginner** | Patient, simple vocabulary | Full phrase suggestions | Achievable |
| **Intermediate** | Natural speech, moderate tolerance | Vocabulary hints | Moderate |
| **Advanced** | Idioms and slang, demanding | Minimal hints | Challenging |
| **Impossible** | Literary/archaic register, uncooperative | No hints | Absurd |

### Voice Interaction

- **Text-to-Speech** — NPC responses read aloud with gender-aware voices (with replay)
- **Speech-to-Text** — Record your voice to respond instead of typing
- Powered by Gradium API with support for all target languages

### Visual Experience

- **AI-generated scenes** — Photorealistic background images generated per scenario via FAL AI (Flux)
- **NPC face expressions** — Visual mood indicators that change with conversation tone
- **Police intervention** — In Impossible mode, the NPC can call the police — complete with siren sound, jail bars drop animation, and a new officer NPC to negotiate with
- **Confetti celebration** — Visual burst when you achieve your goal

### Live Metrics & Debrief

- **Real-time evaluation** — Goal progress, relevance, cooperation, politeness, and clarity tracked live during conversation
- **Post-conversation debrief** — Summary with goal achievement status, key phrases learned, and recommended phrases for improvement

### Internationalized UI

Full interface available in 5 languages:

`English` `French` `German` `Spanish` `Portuguese`

---

## Getting Started

### Prerequisites

- Node.js 20+
- OpenAI API key
- FAL AI API key
- Gradium API key (for TTS/STT)

### Setup

```bash
npm install
```

Create a `.env.local` file (see `.env.example` for all options):

```
OPENAI_API_KEY=your-key-here
FAL_KEY=your-key-here
GRADIUM_API_KEY=your-key-here
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

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 15 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4 |
| Language | TypeScript (strict mode) |
| AI | OpenAI SDK (GPT-4o) |
| Image Generation | FAL AI (Flux) |
| Voice | Gradium (TTS & STT) |
| i18n | next-intl |
| Validation | Zod |
| Database | PostgreSQL (optional, for production) |
