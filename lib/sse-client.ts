export interface SSEHandlers<T = unknown> {
  onToken: (text: string) => void;
  onComplete: (data: T) => void;
  onError: (error: string) => void;
}

export async function consumeSSE<T = unknown>(
  response: Response,
  handlers: SSEHandlers<T>,
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
              handlers.onToken(parsed.text);
            } else if (currentEvent === "complete") {
              handlers.onComplete(parsed as T);
            } else if (currentEvent === "error") {
              handlers.onError(parsed.error);
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
