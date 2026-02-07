import { NextResponse } from "next/server";
import { z } from "zod";
import { generateCustomScenario } from "@/lib/openai";

const generateScenarioSchema = z.object({
  prompt: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = generateScenarioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const scenario = await generateCustomScenario(parsed.data.prompt);
    return NextResponse.json(scenario);
  } catch (error) {
    console.error("Failed to generate scenario:", error);
    return NextResponse.json(
      { error: "Failed to generate scenario" },
      { status: 500 },
    );
  }
}
