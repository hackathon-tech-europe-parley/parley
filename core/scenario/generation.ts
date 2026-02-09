import { createLogger } from "@/core/logger";
import { type CustomScenario, customScenarioFromLlmSchema } from "@/core/types";
import { customScenarioApiSchema } from "@/core/types/llm-api";
import { generateStructured } from "@/infra/llm";
import { CUSTOM_SCENARIO_SYSTEM_PROMPT } from "./prompts";

const log = createLogger("ai:scenario");

export async function generateCustomScenario(
  prompt: string,
): Promise<CustomScenario> {
  log.info("generating custom scenario");
  const start = Date.now();

  const { object } = await generateStructured(customScenarioApiSchema, {
    messages: [
      { role: "system", content: CUSTOM_SCENARIO_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const scenario = customScenarioFromLlmSchema.parse(object);
  log.info({ durationMs: Date.now() - start }, "custom scenario generated");
  return scenario;
}
