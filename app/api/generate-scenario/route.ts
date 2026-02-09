import { NextResponse } from "next/server";
import { createLogger } from "@/core/logger";
import { generateCustomScenario } from "@/core/scenario";
import { customScenarioSchema, generateScenarioSchema } from "@/core/types";

const log = createLogger("api:generate-scenario");

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (body === null) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = generateScenarioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    log.info("generating custom scenario");
    const scenario = await generateCustomScenario(parsed.data.prompt);
    log.info("custom scenario generated");
    return NextResponse.json(customScenarioSchema.parse(scenario));
  } catch (error) {
    log.error({ err: error }, "failed to generate scenario");
    return NextResponse.json(
      { error: "Failed to generate scenario" },
      { status: 500 },
    );
  }
}
