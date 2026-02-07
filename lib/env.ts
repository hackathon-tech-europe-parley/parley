import { z } from "zod";

const optionalEnvString = z.string().trim().min(1).optional();

const envSchema = z
  .object({
    OPENAI_MODEL: optionalEnvString,
    FAL_IMAGE_MODEL: optionalEnvString,

    GRADIUM_API_KEY: optionalEnvString,
    DATABASE_URL: optionalEnvString,
  });

const env = envSchema.parse(process.env);

export const OPENAI_MODEL = env.OPENAI_MODEL ?? "gpt-4o-mini";
export const FAL_IMAGE_MODEL = env.FAL_IMAGE_MODEL ?? "fal-ai/flux/schnell";

export const DATABASE_URL = env.DATABASE_URL;

export function getGradiumApiKey(): string {
  if (!env.GRADIUM_API_KEY) {
    throw new Error("Missing required environment variable: GRADIUM_API_KEY");
  }
  return env.GRADIUM_API_KEY;
}
