import type { ZodType, ZodTypeDef } from "zod";
import {
  messageStreamErrorPayloadSchema,
  messageStreamTokenPayloadSchema,
} from "@/core/types";

export interface SSEHandlers<T = unknown> {
  onToken: (text: string) => void;
  onComplete: (data: T) => void;
  onError: (error: string) => void;
}

export async function consumeSSE<T = unknown>(
  response: Response,
  handlers: SSEHandlers<T>,
  completeSchema?: ZodType<T, ZodTypeDef, unknown>,
): Promise<void> {
  const body = response.body;
  if (!body) {
    handlers.onError("No response body");
    return;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      let currentEvent = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (currentEvent === "token") {
              const tokenPayload =
                messageStreamTokenPayloadSchema.safeParse(parsed);
              if (tokenPayload.success) {
                handlers.onToken(tokenPayload.data.text);
              }
            } else if (currentEvent === "complete") {
              if (completeSchema) {
                const parsedComplete = completeSchema.safeParse(parsed);
                if (parsedComplete.success) {
                  handlers.onComplete(parsedComplete.data);
                } else {
                  handlers.onError("Malformed completion payload");
                }
              } else {
                handlers.onComplete(parsed as T);
              }
            } else if (currentEvent === "error") {
              const errorPayload =
                messageStreamErrorPayloadSchema.safeParse(parsed);
              if (errorPayload.success) {
                handlers.onError(errorPayload.data.error);
              } else {
                handlers.onError("Unknown stream error");
              }
            }
          } catch {
            // Ignore malformed JSON
          }
          currentEvent = "";
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
