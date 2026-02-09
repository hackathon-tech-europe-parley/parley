import { describe, expect, test } from "bun:test";
import { consumeSSE } from "./sse-client";

function createSSEResponse(lines: string[]): Response {
  const text = `${lines.join("\n")}\n`;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(stream);
}

describe("consumeSSE", () => {
  test("token events call onToken with correct text", async () => {
    const tokens: string[] = [];
    const response = createSSEResponse([
      "event: token",
      'data: {"text":"Hello"}',
      "",
      "event: token",
      'data: {"text":" world"}',
      "",
    ]);
    await consumeSSE(response, {
      onToken: (t) => tokens.push(t),
      onComplete: () => {},
      onError: () => {},
    });
    expect(tokens).toEqual(["Hello", " world"]);
  });

  test("complete events call onComplete with parsed data", async () => {
    let completed: unknown = null;
    const response = createSSEResponse([
      "event: complete",
      'data: {"npcMessage":"Bonjour","mood":"happy"}',
      "",
    ]);
    await consumeSSE(response, {
      onToken: () => {},
      onComplete: (data) => {
        completed = data;
      },
      onError: () => {},
    });
    expect(completed).toEqual({ npcMessage: "Bonjour", mood: "happy" });
  });

  test("error events call onError", async () => {
    let errorMsg = "";
    const response = createSSEResponse([
      "event: error",
      'data: {"error":"Something went wrong"}',
      "",
    ]);
    await consumeSSE(response, {
      onToken: () => {},
      onComplete: () => {},
      onError: (e) => {
        errorMsg = e;
      },
    });
    expect(errorMsg).toBe("Something went wrong");
  });

  test("malformed JSON lines are silently skipped", async () => {
    const tokens: string[] = [];
    const response = createSSEResponse([
      "event: token",
      "data: not-json",
      "",
      "event: token",
      'data: {"text":"ok"}',
      "",
    ]);
    await consumeSSE(response, {
      onToken: (t) => tokens.push(t),
      onComplete: () => {},
      onError: () => {},
    });
    expect(tokens).toEqual(["ok"]);
  });

  test("no response body calls onError", async () => {
    let errorMsg = "";
    const response = new Response(null);
    await consumeSSE(response, {
      onToken: () => {},
      onComplete: () => {},
      onError: (e) => {
        errorMsg = e;
      },
    });
    expect(errorMsg).toBe("No response body");
  });

  test("mixed token and complete events work together", async () => {
    const tokens: string[] = [];
    let completed: unknown = null;
    const response = createSSEResponse([
      "event: token",
      'data: {"text":"Bon"}',
      "",
      "event: token",
      'data: {"text":"jour"}',
      "",
      "event: complete",
      'data: {"done":true}',
      "",
    ]);
    await consumeSSE(response, {
      onToken: (t) => tokens.push(t),
      onComplete: (data) => {
        completed = data;
      },
      onError: () => {},
    });
    expect(tokens).toEqual(["Bon", "jour"]);
    expect(completed).toEqual({ done: true });
  });
});
