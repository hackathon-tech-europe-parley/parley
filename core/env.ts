import { z } from "zod";

const requiredString = z.string().trim().min(1);
const optionalString = z.string().trim().min(1).optional();

const envSchema = z.object({
  // LLM
  LLM_PROVIDER: requiredString,
  LLM_MODEL: requiredString,

  // Image generation
  FAL_IMAGE_MODEL: requiredString,

  // TTS / STT
  GRADIUM_API_KEY: requiredString,
  GRADIUM_TTS_PADDING_BONUS: optionalString,

  // Storage (optional — falls back to in-memory)
  DATABASE_URL: optionalString,

  // Logging (optional)
  LOG_LEVEL: optionalString,
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Missing or invalid environment variables:\n${missing}\n\nCheck your .env.local against .env.example`,
    );
  }
  return result.data;
}

const env = validateEnv();

export const LLM_PROVIDER = env.LLM_PROVIDER;
export const LLM_MODEL = env.LLM_MODEL;
export const FAL_IMAGE_MODEL = env.FAL_IMAGE_MODEL;
export const GRADIUM_API_KEY = env.GRADIUM_API_KEY;
export const DATABASE_URL = env.DATABASE_URL;

export function getGradiumTtsPaddingBonus(): number {
  const raw = env.GRADIUM_TTS_PADDING_BONUS;
  if (!raw) {
    return -1.2;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return -1.2;
  }

  return Math.min(4, Math.max(-4, parsed));
}
