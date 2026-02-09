import { NextResponse } from "next/server";
import WebSocket from "ws";
import { getGradiumApiKey } from "@/lib/env";
import { sttRequestSchema, sttServerMessageSchema } from "@/lib/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:stt");

const CHUNK_SAMPLES = 1920;
const BYTES_PER_SAMPLE = 2;
const TIMEOUT_MS = 30_000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = sttRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const pcmBuffer = Buffer.from(parsed.data.audio, "base64");
  const languageCode = parsed.data.languageCode;

  try {
    log.info({ languageCode, audioBytes: pcmBuffer.length }, "STT request");
    const start = Date.now();
    const text = await transcribeViaWebSocket(pcmBuffer, languageCode);
    log.info({ durationMs: Date.now() - start, transcriptLength: text.length }, "STT complete");
    return NextResponse.json({ text });
  } catch (err) {
    log.error({ err }, "STT transcription failed");
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 502 },
    );
  }
}

function transcribeViaWebSocket(pcm: Buffer, languageCode?: string): Promise<string> {
  const apiKey = getGradiumApiKey();
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("wss://eu.api.gradium.ai/api/speech/asr", {
      headers: { "x-api-key": apiKey },
    });

    let transcript = "";
    let settled = false;
    let sawEndOfStream = false;
    const timer = setTimeout(() => {
      ws.close();
      if (!settled) {
        settled = true;
        reject(new Error("STT timeout"));
      }
    }, TIMEOUT_MS);

    const finalize = (result: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result.trim());
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };

    const sendAudio = () => {
      // Send audio in chunks of 1920 samples (3840 bytes at 16-bit)
      const chunkBytes = CHUNK_SAMPLES * BYTES_PER_SAMPLE;
      let chunkCount = 0;
      for (let offset = 0; offset < pcm.length; offset += chunkBytes) {
        const chunk = pcm.subarray(offset, offset + chunkBytes);
        ws.send(JSON.stringify({ type: "audio", audio: chunk.toString("base64") }));
        chunkCount++;
      }
      log.debug({ chunkCount, audioBytes: pcm.length }, "sent audio chunks");

      // Signal end of audio stream
      ws.send(JSON.stringify({ type: "end_of_stream" }));
      log.debug("sent end_of_stream");
    };

    ws.on("open", () => {
      log.debug("WebSocket connected");

      // Setup message must be the first frame.
      const setup: Record<string, unknown> = {
        type: "setup",
        model_name: "default",
        input_format: "pcm",
      };
      if (languageCode) {
        setup.json_config = { language: languageCode };
      }
      log.debug({ setup }, "sending STT setup");
      ws.send(JSON.stringify(setup));
    });

    ws.on("message", (data) => {
      const raw = data.toString();
      log.debug({ message: raw.substring(0, 200) }, "STT recv");
      try {
        const msg = sttServerMessageSchema.parse(JSON.parse(raw));
        // "text" messages contain transcription results
        if (msg.type === "text" && msg.text) {
          transcript += (transcript ? " " : "") + msg.text;
        }
        if (msg.type === "ready") {
          sendAudio();
        }
        if (msg.type === "error") {
          fail(new Error(msg.message ?? "STT server error"));
          ws.close();
          return;
        }
        // Server echoes end_of_stream when done.
        if (msg.type === "end_of_stream") {
          sawEndOfStream = true;
          ws.close();
          finalize(transcript);
        }
      } catch {
        // Binary or non-JSON frame
      }
    });

    ws.on("close", (code, reason) => {
      log.debug({ code, reason: reason?.toString() }, "STT WebSocket closed");
      if (sawEndOfStream || transcript.trim()) {
        finalize(transcript);
        return;
      }
      fail(new Error(`STT socket closed before transcription (code ${code})`));
    });

    ws.on("error", (err) => {
      log.error({ err }, "STT WebSocket error");
      fail(err);
    });
  });
}
