# Parley - Situational Language Learning via Immersive Roleplay

## Core Concept

Parley is a ChatGPT App for situational language learning through immersive roleplay. The user describes a real-life scenario they want to navigate in a foreign language. The app generates a visual scene, plays an NPC character, and coaches the user through the interaction - adapting to their chosen level.

## Tech Stack (3+ partner technologies)

- **Skybridge/Alpic** - Framework + deployment (Alpic track)
- **OpenAI** - Powers ChatGPT, drives the NPC conversation logic
- **fal** - Generates and regenerates scene images based on mood shifts (side challenge eligible)
- **Gradium** - Voice input/output (stretch goal, 4th partner)

## Single Widget, Three Phases

### Setup Phase

The MCP tool receives from ChatGPT: scenario description, target language, user level (beginner/intermediate/advanced), and the user's goal. The server:
- Calls fal to generate the initial scene image
- Builds an NPC profile (name, personality, initial mood)
- Returns everything to the widget

Widget displays: scene image, situation description, goal, NPC info, level badge, and a "Start" button.

### Conversation Phase

Widget shows:
- Scene image (top) - updates every 2-3 exchanges to reflect NPC mood
- Scrollable chat log (middle) - NPC left-aligned, user right-aligned
- Hint button - level-appropriate suggestions
- Text input + send button (bottom)
- "Give up" button (secondary)

### Debrief Phase

When conversation ends (goal achieved, failed, or quit):
- Final scene image (outcome-based)
- Narrative summary ("The driver was skeptical at first, but your polite use of the conditional tense softened him...")
- 3-5 key phrases to remember (target language + translation)
- Goal achieved or not indicator

## MCP Tool Design

One tool: `"parley"`

### Input Schema

```
- action: "setup" | "message" | "quit"
- scenario: string (setup only)
- language: string (setup only)
- level: "beginner" | "intermediate" | "advanced" (setup only)
- message: string (message only)
- conversationId: string (message/quit)
```

### Output

```
- phase: "setup" | "conversation" | "debrief"
- sceneImageUrl: string
- npcName: string
- npcMessage: string
- conversationHistory: [{role, text}]
- hints: string[]
- debrief: {narrative, keyPhrases, goalAchieved} (debrief only)
- conversationId: string
```

## Server-Side State

In-memory Map keyed by conversationId holding:
- NPC profile & personality
- Conversation history
- Current NPC mood
- Message count since last image regen
- User's goal and level

## NPC Logic (OpenAI)

On each message, build a system prompt including:
- NPC personality and backstory
- Scenario context and user goal
- User level (controls vocabulary and tolerance)
- Current mood

OpenAI returns structured response:
- `npcMessage`: in target language
- `mood`: updated mood state
- `goalStatus`: "ongoing" | "achieved" | "failed"
- `hints`: contextual suggestions

### Level Adaptation

- **Beginner**: Short sentences, full phrase hints with translations, patient NPC
- **Intermediate**: Natural speech, vocabulary-only hints, moderate tolerance
- **Advanced**: Slang/idioms, no hints unless requested, demanding NPC

### Conversation End Triggers

- Mood reaches "convinced" → goal achieved → debrief
- Mood reaches "furious"/"done" → goal failed → debrief
- User quits → early exit → debrief
- ~15 exchanges → natural timeout → debrief

## fal Integration

- Setup: generate initial scene image
- Every 2-3 messages: regenerate with mood-adjusted prompt
- Conversation end: generate final outcome image

## Voice Stretch Goal (Gradium)

Layered on after core text flow works:
1. Toggle in setup: "Text mode" / "Voice mode"
2. Mic button replaces text input
3. Gradium speech-to-text for user input
4. Gradium text-to-speech for NPC responses
5. Transcript still visible in chat log

## Build Order

1. Server: parley tool registration (Zod schema, action routing, conversation store)
2. Server: fal integration (image generation)
3. Server: OpenAI integration (NPC response generation)
4. Widget: setup phase
5. Widget: conversation phase
6. Widget: debrief phase
7. Deploy to Alpic
8. Stretch: Gradium voice
