import { NextResponse } from "next/server";
import WebSocket from "ws";

const GRADIUM_API_KEY = process.env.GRADIUM_API_KEY!;
const CHUNK_SAMPLES = 1920;
const BYTES_PER_SAMPLE = 2;
const TIMEOUT_MS = 30_000;

export async function POST(request: Request) {
  const body = await request.json();
  const audioBase64 = body?.audio;

  if (!audioBase64 || typeof audioBase64 !== "string") {
    return NextResponse.json({ error: "Missing audio" }, { status: 400 });
  }

  const pcmBuffer = Buffer.from(audioBase64, "base64");
  const languageCode = body?.languageCode;

  try {
    const text = await transcribeViaWebSocket(pcmBuffer, languageCode);
    return NextResponse.json({ text });
  } catch (err) {
    console.error("STT error:", err);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 502 },
    );
  }
}

function transcribeViaWebSocket(pcm: Buffer, languageCode?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("wss://eu.api.gradium.ai/api/speech/asr", {
      headers: { "x-api-key": GRADIUM_API_KEY },
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
      console.log(`[STT] Sent ${chunkCount} chunks (${pcm.length} bytes)`);

      // Signal end of audio stream
      ws.send(JSON.stringify({ type: "end_of_stream" }));
      console.log("[STT] Sent end_of_stream");
    };

    ws.on("open", () => {
      console.log("[STT] WebSocket connected");

      // Setup message must be the first frame.
      const setup: Record<string, unknown> = {
        type: "setup",
        model_name: "default",
        input_format: "pcm",
      };
      if (languageCode) {
        setup.json_config = { language: languageCode };
      }
      console.log("[STT] Setup:", JSON.stringify(setup));
      ws.send(JSON.stringify(setup));
    });

    ws.on("message", (data) => {
      const raw = data.toString();
      console.log("[STT] Recv:", raw.substring(0, 300));
      try {
        const msg = JSON.parse(raw);
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
      console.log(`[STT] Closed: code=${code} reason=${reason?.toString()}`);
      if (sawEndOfStream || transcript.trim()) {
        finalize(transcript);
        return;
      }
      fail(new Error(`STT socket closed before transcription (code ${code})`));
    });

    ws.on("error", (err) => {
      console.log("[STT] Error:", err.message);
      fail(err);
    });
  });
}
