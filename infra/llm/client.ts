import type { LanguageModel } from "ai";
import { LLM_MODEL, LLM_PROVIDER } from "@/core/env";
import { createLogger } from "@/core/logger";

const log = createLogger("infra:llm");

type ProviderFactory = (modelId: string) => LanguageModel;

const providerFactories: Record<string, () => ProviderFactory> = {
  openai: () => {
    const { createOpenAI } =
      require("@ai-sdk/openai") as typeof import("@ai-sdk/openai");
    return (modelId: string) => createOpenAI({})(modelId);
  },
};

let cachedModel: LanguageModel | null = null;

export function getModel(): LanguageModel {
  if (cachedModel) return cachedModel;

  const factory = providerFactories[LLM_PROVIDER];
  if (!factory) {
    throw new Error(
      `Unknown LLM provider "${LLM_PROVIDER}". Supported: ${Object.keys(providerFactories).join(", ")}. ` +
        `Install the provider package (e.g. bun add @ai-sdk/anthropic) and add it to infra/llm/client.ts.`,
    );
  }

  log.info({ provider: LLM_PROVIDER, model: LLM_MODEL }, "initializing LLM");
  cachedModel = factory()(LLM_MODEL);
  return cachedModel;
}
