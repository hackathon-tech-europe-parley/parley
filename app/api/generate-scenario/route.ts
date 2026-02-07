import { NextResponse } from "next/server";
import { customScenarioSchema, generateScenarioSchema } from "@/lib/types";
import { generateCustomScenario } from "@/lib/openai";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (body === null) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const parsed = generateScenarioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const scenario = await generateCustomScenario(parsed.data.prompt);
    return NextResponse.json(customScenarioSchema.parse(scenario));
  } catch (error) {
    console.error("Failed to generate scenario:", error);
    return NextResponse.json(
      { error: "Failed to generate scenario" },
      { status: 500 },
    );
  }
}
