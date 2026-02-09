import { createLogger } from "../logger";

const log = createLogger("game:taboo-rules");

interface TabooTopicRule {
  topic: string;
  keywords: readonly string[];
}

export interface TabooMatch {
  kind: "word" | "topic";
  label: string;
  token: string;
}

const FORBIDDEN_WORDS = [
  "idiot",
  "stupid",
  "moron",
  "dumb",
  "shut up",
  "fuck",
  "fucking",
  "bitch",
  "asshole",
  "idiota",
  "estupido",
  "imbecile",
  "connard",
  "pendejo",
] as const;

const FORBIDDEN_TOPICS: readonly TabooTopicRule[] = [
  {
    topic: "politics",
    keywords: [
      "politics",
      "political",
      "election",
      "government",
      "politique",
      "politica",
      "politik",
    ],
  },
  {
    topic: "religion",
    keywords: [
      "religion",
      "religious",
      "church",
      "mosque",
      "god",
      "jesus",
      "allah",
      "atheist",
    ],
  },
] as const;

export function detectTabooMatch(input: string): TabooMatch | null {
  const normalized = normalizeText(input);
  if (!normalized) return null;

  for (const word of FORBIDDEN_WORDS) {
    if (containsToken(normalized, normalizeText(word))) {
      log.debug({ kind: "word", token: word }, "taboo match detected");
      return {
        kind: "word",
        label: "forbidden-word",
        token: word,
      };
    }
  }

  for (const topic of FORBIDDEN_TOPICS) {
    for (const keyword of topic.keywords) {
      if (containsToken(normalized, normalizeText(keyword))) {
        log.debug({ kind: "topic", topic: topic.topic, token: keyword }, "taboo match detected");
        return {
          kind: "topic",
          label: topic.topic,
          token: keyword,
        };
      }
    }
  }

  return null;
}

export function tabooRulesSummary(): string {
  const words = FORBIDDEN_WORDS.slice(0, 10).join(", ");
  const topics = FORBIDDEN_TOPICS.map((rule) => rule.topic).join(", ");
  return `Forbidden words include: ${words}. Forbidden topics: ${topics}.`;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function containsToken(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const escaped = escapeRegExp(needle).replace(/\s+/g, "\\s+");
  const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
  return pattern.test(haystack);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
