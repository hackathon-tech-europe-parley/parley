<p align="center">
  <img src="public/assets/logo.png" alt="Parley" width="120" />
</p>

<p align="center">
  <strong>Learn languages by living them.</strong><br/>
  Immersive AI roleplay for real-world conversation practice.
</p>

<p align="center">
  <a href="https://parley-ruby.vercel.app/fr"><strong>Try it live &rarr;</strong></a>
</p>

<p align="center">
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://openai.com/"><img src="https://img.shields.io/badge/OpenAI-GPT--4o-412991?logo=openai&logoColor=white" alt="OpenAI" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" /></a>
</p>

<p align="center">
  <em>&#x1F948; 2nd Place at <a href="https://luma.com/paris-hackathon">{Tech: Europe} Paris AI Hackathon</a></em>
</p>

---

## How it works

> **Pick a language** &rarr; **Choose a scenario & difficulty** &rarr; **Chat with an AI character** &rarr; **Get a debrief**

You're dropped into a situation — ordering at a cafe in Paris, haggling at a market in Madrid, convincing a landlord in Berlin — and have to talk your way through it. The NPC reacts to what you say, tracks your mood and manners, and judges whether you hit your goal.

---

## Features

### &#x1F3AD; 12 Scenarios + Custom

Taxi rides, cafe orders, job interviews, market haggling, doctor visits, apartment hunting, and more. Or generate your own scenario on the fly.

### &#x1F9E0; Smart NPCs

Each character gets a unique name, backstory, and personality. A conversation policy engine tracks hostility, cooperation, and engagement to shape how they respond. Push too far and they might call the police.

### &#x1F3AF; 4 Difficulty Levels

| | NPC Style | Hints | Goals |
|---|---|---|---|
| ![Beginner](https://img.shields.io/badge/Beginner-4ade80?style=flat-square) | Patient, simple vocabulary | Full phrase suggestions | Achievable |
| ![Intermediate](https://img.shields.io/badge/Intermediate-facc15?style=flat-square) | Natural speech | Vocabulary hints | Moderate |
| ![Advanced](https://img.shields.io/badge/Advanced-f97316?style=flat-square) | Idioms & slang, demanding | Minimal | Challenging |
| ![Impossible](https://img.shields.io/badge/Impossible-dc2626?style=flat-square) | Archaic register, uncooperative | None | Absurd |

### &#x1F50A; Voice In & Out

Hear NPC responses read aloud with gender-aware voices. Record your own voice to respond instead of typing. Powered by Gradium with support for all target languages.

### &#x1F3A8; AI-Generated Visuals

Photorealistic scene backgrounds generated per scenario via FAL AI. Animated NPC face expressions that shift with conversation mood (8 states). Confetti when you win. Jail bars when you don't.

### &#x1F4CA; Live Metrics & Debrief

Goal progress, relevance, politeness, and clarity tracked in real time. Post-conversation summary with key phrases learned and recommendations.

### &#x1F30D; 5 Languages

Practice in **English** &middot; **French** &middot; **German** &middot; **Spanish** &middot; **Portuguese**

Full UI localized in all five via next-intl.

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) 1.0+
- API keys for [OpenAI](https://platform.openai.com/), [FAL AI](https://fal.ai/), and [Gradium](https://gradium.ai/)

### Setup

```bash
bun install
```

Create `.env.local` (see `.env.example`):

```
OPENAI_API_KEY=sk-...
FAL_KEY=...
GRADIUM_API_KEY=...
```

### Run

```bash
bun run dev       # Development (Turbopack)
bun run build     # Production build
bun run start     # Production server
bun run lint      # Lint & format check (Biome)
```

---

## Tech Stack

| | |
|---|---|
| **Framework** | Next.js 15, React 19 |
| **Styling** | Tailwind CSS v4 |
| **AI** | OpenAI GPT-4o |
| **Images** | FAL AI (Flux) |
| **Voice** | Gradium (TTS & STT) |
| **i18n** | next-intl |
| **Tooling** | Biome, Zod, Pino |
| **Database** | PostgreSQL (optional) |
