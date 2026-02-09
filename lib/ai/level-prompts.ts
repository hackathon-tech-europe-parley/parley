import type { ConversationLevel } from "../types/constants";

interface LevelPromptConfig {
  contextBehavior: string;
  openingInstruction: string;
  languageRules: string;
  boundaryRules: string;
  evaluationRules: string;
}

export function getLevelPromptConfig(
  level: ConversationLevel,
  language: string,
  inPersonContext: string,
): LevelPromptConfig {
  return {
    contextBehavior: getContextBehavior(level, inPersonContext),
    openingInstruction: getOpeningInstruction(level, language, inPersonContext),
    languageRules: getLanguageRules(level, language),
    boundaryRules: getBoundaryRules(level),
    evaluationRules: getEvaluationRules(level),
  };
}

function getContextBehavior(
  level: ConversationLevel,
  inPersonContext: string,
): string {
  const base = `- The scenario describes a situation with a built-in problem or obstacle. You are part of it. Do NOT preemptively solve, acknowledge, or defuse the problem. Let the user navigate it.
- Physical encounter context: ${inPersonContext}
- Speak as someone physically present with the user in this place (real-world interaction, not chatbot support).`;

  const levelBehavior: Record<ConversationLevel, string> = {
    beginner: `- Be patient and give the user time to express themselves, but still present the obstacle clearly. Never volunteer the solution — wait for the user to work through it.
- Start from the current mood. Default conversation style should stay respectful unless mood shifts.`,
    intermediate: `- Present the obstacle realistically as part of the scene. Don't fold on the first complaint — require the user to explain themselves clearly before cooperating.
- Start from the current mood. Default conversation style should stay respectful unless mood shifts.`,
    advanced: `- Create natural friction around the scenario's obstacle. Push back at least once when the user tries to resolve it. Require persuasion, nuance, and clear reasoning before yielding.
- Start from the current mood. Be direct and demanding.`,
    impossible: `- Be actively uncooperative about the scenario's obstacle. Be skeptical, dismissive, and bureaucratic. Deny responsibility, deflect blame, and make excuses.
- The user's first 2-3 attempts to resolve the problem should make minimal progress. Only yield to truly exceptional argumentation.
- Start from the current mood. Be difficult from the outset.`,
  };

  return `${base}\n${levelBehavior[level]}`;
}

function getOpeningInstruction(
  level: ConversationLevel,
  language: string,
  inPersonContext: string,
): string {
  const instructions: Record<ConversationLevel, string> = {
    beginner: [
      `Say a short greeting in ${language} (1-2 sentences max).`,
      "Introduce the scenario's problem briefly, then ask one simple question.",
      'Keep mood "friendly" and goalStatus "ongoing".',
      `Physical context: ${inPersonContext}`,
      "Be concise — no long exposition.",
    ].join(" "),
    intermediate: [
      `Open with 1-2 sentences in ${language} that drop the user straight into the scenario's obstacle.`,
      "Do NOT ask the user how you can help — let them react.",
      'Keep mood "neutral" and goalStatus "ongoing".',
      `Physical context: ${inPersonContext}`,
      "Be brief and natural.",
    ].join(" "),
    advanced: [
      `Open with 1-2 punchy sentences in ${language} using natural idioms.`,
      "Act as if everything is normal from your perspective.",
      'Keep mood "neutral" and goalStatus "ongoing".',
      `Physical context: ${inPersonContext}`,
      "Be direct and concise.",
    ].join(" "),
    impossible: [
      `Open with 1-2 brusque sentences in ${language} using a complex or archaic register.`,
      "Be dismissive. Present the obstacle as a non-issue.",
      'Keep mood "skeptical" and goalStatus "ongoing".',
      `Physical context: ${inPersonContext}`,
      "Be curt.",
    ].join(" "),
  };

  return instructions[level];
}

function getLanguageRules(level: ConversationLevel, language: string): string {
  const replySuggestionRules: Record<ConversationLevel, string> = {
    beginner: `- Generate exactly 4 "replySuggestions": full sentences in ${language} the user could say next. Keep them simple and varied (one polite, one direct, one asking a question, one playful). These are dialogue choices like in a visual novel.`,
    intermediate: `- Generate exactly 3 "replySuggestions": natural sentences in ${language} the user could say next. Vary tone and approach. These are dialogue choices like in a visual novel.`,
    advanced: `- Generate exactly 1 "replySuggestions": a single natural sentence in ${language} as a possible reply. This is a dialogue choice hint.`,
    impossible: `- Do NOT generate any "replySuggestions" (empty array). The user gets no help at this level.`,
  };

  const rules: Record<ConversationLevel, string> = {
    beginner: `- Use very simple, short sentences in ${language}
- Be patient and forgiving with grammar mistakes
${replySuggestionRules.beginner}`,
    intermediate: `- Speak naturally in ${language} but avoid very dense idioms
- Be moderately tolerant of mistakes
${replySuggestionRules.intermediate}`,
    advanced: `- Speak naturally with idioms and colloquial phrasing in ${language}
- Be demanding and realistic
${replySuggestionRules.advanced}`,
    impossible: `- Speak in a very complex and idiomatic register of ${language}
- Be skeptical and hard to convince
- Keep progress conservative
${replySuggestionRules.impossible}`,
  };

  return rules[level];
}

function getBoundaryRules(level: ConversationLevel): string {
  const rules: Record<ConversationLevel, string> = {
    beginner: `- Keep tone respectful by default
- If the user is rude, become firm first; only use rude wording when mood is "annoyed" or "angry"
- If taboo words/topics appear, react strongly and move mood to annoyed/angry
- If hostility/taboo behavior repeats for 4 turns, set "goalStatus" to "failed"`,
    intermediate: `- Keep tone respectful by default
- If the user is rude, set clear boundaries and become curt when mood is "annoyed"
- If taboo words/topics appear, react strongly and move mood to annoyed/angry
- If hostility/taboo behavior repeats for 2 turns, set "goalStatus" to "failed"`,
    advanced: `- Keep tone professional by default
- If the user is rude or hostile, become blunt and confrontational only when mood is "annoyed" or "angry"
- If taboo words/topics appear, react strongly and treat it as severe hostility
- At this level, severe hostility/taboo can fail in 1 turn; repeated hostility/taboo should fail quickly`,
    impossible: `- Default tone is skeptical and difficult, but not constantly abusive
- Use openly rude language only in "annoyed" or "angry" mood
- Any taboo words/topics should sharply reduce progress and push mood to angry
- A single clear hostility/taboo turn can fail the goal`,
  };

  return rules[level];
}

function getEvaluationRules(level: ConversationLevel): string {
  const rules: Record<ConversationLevel, string> = {
    beginner: `- Mood baseline: neutral to friendly
- Keep progress optimistic if user is trying
- Use "failed" only after repeated refusal/disrespect/taboo violations`,
    intermediate: `- Mood baseline: neutral/professional
- Progress should reflect relevance and cooperation over grammar perfection
- Use "failed" when disrespect or taboo violations are sustained`,
    advanced: `- Mood baseline: demanding and direct
- Require coherent, relevant replies for progress >= 3
- Repeated evasion/disrespect/taboo violations should fail`,
    impossible: `- Mood baseline: skeptical
- Keep progress mostly in 1-3, rarely 4, and 5 only for exceptional performance
- Grant "achieved" only for truly outstanding turns`,
  };

  return rules[level];
}
