# Parley ChatGPT App Specification

## Product Summary
Parley is a ChatGPT App for situational language learning through immersive roleplay. Users describe a real-life situation, choose target language and level, then practice with an adaptive NPC to reach a concrete objective.

## Value Proposition
### Problem
Language learners often freeze in high-pressure moments and fail to communicate effectively in real contexts.

### Target Users
- Travelers
- Expats
- Learners from beginner to advanced level

### Core MVP Actions
1. Generate a scene visual and role context.
2. Run adaptive text roleplay with an NPC.
3. Provide level-aware hints and better phrasing.
4. Produce outcome debrief and retry guidance.

## Why This Works in ChatGPT
- Users can describe situations naturally and get instant tailored simulation.
- LLM handles intent parsing, dynamic roleplay, adaptation, and coaching.
- Widget gives a shared interactive surface for both user and LLM.

## MVP Tech Stack
1. Skybridge/Alpic (app framework + deploy)
2. OpenAI (NPC and coaching logic)
3. fal (scene image generation)

Stretch:
- Gradium (voice STT/TTS)
- Dify (workflow orchestration)

## UX and Widget Flow
Single widget with 3 phases.

### Setup Phase
Inputs:
- Scenario description
- Target language
- User level: beginner/intermediate/advanced
- User goal

Server behavior:
- Generate initial image via fal
- Generate NPC profile
- Initialize conversation state

Widget shows:
- Scene image
- Situation and goal summary
- NPC card + level badge
- Start button

### Conversation Phase
Widget shows:
- Scene image (updated periodically)
- Scrollable transcript
- Hint button
- User message input and send
- Give up button

Behavior:
- NPC responds in target language
- Hints adapt by level
- Optional image refresh every 2-3 turns based on mood

### Debrief Phase
Triggered by success, failure, quit, or timeout.

Widget shows:
- Final image
- Narrative summary
- 3-5 key phrases (target language + translation)
- Goal achieved status
- Retry suggestion

## MCP Tool Contract
Tool name: `parley`

### Input
- `action`: `"setup" | "message" | "quit"`
- `scenario`: string (`setup` only)
- `language`: string (`setup` only)
- `level`: `"beginner" | "intermediate" | "advanced"` (`setup` only)
- `goal`: string (`setup` only)
- `message`: string (`message` only)
- `conversationId`: string (`message`/`quit` only)

### Output
- `phase`: `"setup" | "conversation" | "debrief"`
- `sceneImageUrl`: string
- `npcName`: string
- `npcMessage`: string
- `conversationHistory`: `{ role: string; text: string }[]`
- `hints`: string[]
- `debrief`: `{ narrative: string; keyPhrases: string[]; goalAchieved: boolean }` (`debrief` only)
- `conversationId`: string

## State Model
In-memory state keyed by `conversationId`:
- Scenario context
- NPC profile and mood
- Conversation history
- User level and goal
- Turn counters
- Image regeneration counter

## NPC and Adaptation Logic
Per message, prompt OpenAI with:
- Scenario + goal
- NPC profile and current mood
- User level constraints
- Safety constraints

Expected structured response:
- `npcMessage`
- `mood`
- `goalStatus`: `ongoing | achieved | failed`
- `hints`

Level behavior:
- Beginner: short sentences, explicit translated hints, patient NPC
- Intermediate: natural speech, lighter hints
- Advanced: richer language, minimal hints unless requested

## Conversation End Conditions
- Mood indicates success (e.g., convinced) -> success debrief
- Mood indicates failure (e.g., done/frustrated) -> failure debrief
- User quits -> debrief
- Turn limit (~15) -> timeout debrief

## Safety Requirements
- Reframe unsafe or illegal user goals into safe communication goals.
- Keep coaching focused on de-escalation and respectful communication.
- Do not provide manipulation/coercion tactics.
- Enforce constraints in both scenario setup and turn generation.

## Non-Goals (MVP)
- Persistent accounts and long-term progress tracking
- Multi-widget architecture
- Mandatory voice mode

## Build Plan
1. Register `parley` tool and Zod schemas in server.
2. Implement action routing (`setup`, `message`, `quit`).
3. Add in-memory conversation store.
4. Integrate fal image generation.
5. Integrate OpenAI turn and debrief generation.
6. Build widget UI with 3 phases.
7. Validate locally via Skybridge DevTools.
8. Deploy on Alpic and test `/try`.

## Hackathon Deliverables
- Public GitHub repo with README + setup + API docs
- 2-minute demo video
- Submission explicitly listing partner technologies used
