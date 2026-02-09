import { z } from "zod";
import { createLogger } from "./logger";

const log = createLogger("env");

const optionalEnvString = z.string().trim().min(1).optional();

const envSchema = z.object({
  OPENAI_MODEL: optionalEnvString,
  FAL_IMAGE_MODEL: optionalEnvString,

  GRADIUM_API_KEY: optionalEnvString,
  GRADIUM_TTS_PADDING_BONUS: optionalEnvString,
  DATABASE_URL: optionalEnvString,
});

const env = envSchema.parse(process.env);

if (!env.GRADIUM_API_KEY) {
  log.warn("GRADIUM_API_KEY not set — TTS/STT will fail");
}
if (!env.DATABASE_URL) {
  log.info("DATABASE_URL not set — using in-memory storage");
}

export const OPENAI_MODEL = env.OPENAI_MODEL ?? "gpt-4o-2024-08-06";
export const FAL_IMAGE_MODEL = env.FAL_IMAGE_MODEL ?? "fal-ai/flux/schnell";

export const DATABASE_URL = env.DATABASE_URL;

export function getGradiumTtsPaddingBonus(): number {
  const raw = env.GRADIUM_TTS_PADDING_BONUS;
  if (!raw) {
    // Faster by default for snappier NPC playback.
    return -1.2;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return -1.2;
  }

  return Math.min(4, Math.max(-4, parsed));
}

export function getGradiumApiKey(): string {
  if (!env.GRADIUM_API_KEY) {
    throw new Error("Missing required environment variable: GRADIUM_API_KEY");
  }
  return env.GRADIUM_API_KEY;
}
