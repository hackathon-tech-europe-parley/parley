import {
  type GenerateObjectResult,
  generateObject,
  type ModelMessage,
  streamObject,
} from "ai";
import type { z } from "zod";
import { getModel } from "./client";

export interface StructuredOptions {
  messages: ModelMessage[];
  temperature?: number;
}

export async function generateStructured<T extends z.ZodType>(
  schema: T,
  options: StructuredOptions,
): Promise<GenerateObjectResult<z.infer<T>>> {
  return generateObject({
    model: getModel(),
    schema,
    messages: options.messages,
    temperature: options.temperature,
  });
}

export function streamStructured<T extends z.ZodType>(
  schema: T,
  options: StructuredOptions,
) {
  return streamObject({
    model: getModel(),
    schema,
    messages: options.messages,
    temperature: options.temperature,
  });
}

export { getModel } from "./client";
