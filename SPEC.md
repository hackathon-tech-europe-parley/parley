# Parley - SPEC

## Value Proposition

**Problem:** Language learners freeze in stressful real-life situations and fail to reach practical goals. Most tools focus on vocabulary drills instead of dynamic, goal-driven practice.

**Target users:** Travelers and expats from beginner to advanced levels.

**Solution:** Situational language learning through immersive roleplay inside ChatGPT. Users describe a real-life scenario, get a generated visual scene, and practice with an adaptive NPC character.

## Core Actions (MVP)

1. Generate a scenario visual + role context
2. Run text roleplay with adaptive NPC behavior
3. Provide hints and next-best phrasing based on level and objective
4. End with narrative debrief and retry guidance

## UX Flow

Practice a language scenario:
1. User describes scenario, language, level, and goal
2. See generated scene with NPC introduction
3. Start conversation - text back-and-forth with NPC
4. Receive hints when needed
5. Conversation ends (goal achieved/failed/quit)
6. View narrative debrief with key phrases

## Tools and Widgets

**Widget: parley**
- **Input**: `{ scenario, language, level, goal }`
- **Output**: `{ phase, conversationId, sceneImageUrl, npcName, npcPersonality, scenario, goal, language, level }`
- **Views**: setup (scene + start), conversation (chat + hints), debrief (narrative + phrases)
- **Behavior**: manages conversation state locally, calls `parley-message` tool for NPC turns

**Tool: parley-message**
- **Input**: `{ conversationId, message }`
- **Output**: `{ phase, sceneImageUrl, npcMessage, mood, hints, conversationHistory, goalStatus, debrief? }`

**Tool: parley-quit**
- **Input**: `{ conversationId }`
- **Output**: `{ phase, sceneImageUrl, debrief, conversationHistory }`

## Tech Stack

- Skybridge/Alpic (framework + deployment)
- OpenAI (NPC logic + debrief generation)
- fal (scene image generation)
- Gradium (voice - stretch goal)
