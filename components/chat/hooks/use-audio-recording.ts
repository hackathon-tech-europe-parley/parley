"use client";

import type { MutableRefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { sttResponseSchema } from "@/core/types";
import { AudioRecorder } from "../lib/audio-recorder";
import type { TTSPlayer } from "../lib/tts-player";

export function useAudioRecording(
  languageCode: string | undefined,
  ttsPlayerRef: MutableRefObject<TTSPlayer | null>,
  setTtsPlaying: (v: number | null) => void,
  setError: (v: string | null) => void,
  sendMessage: (text: string) => void,
) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [pendingTranscription, setPendingTranscription] = useState<
    string | null
  >(null);
  const recorderRef = useRef<AudioRecorder | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: sendMessage is stable via useState/useRef
  useEffect(() => {
    if (pendingTranscription) {
      setPendingTranscription(null);
      sendMessage(pendingTranscription);
    }
  }, [pendingTranscription]);

  async function handleMicToggle() {
    if (recording) {
      setRecording(false);
      setTranscribing(true);
      try {
        const recorder = recorderRef.current;
        if (!recorder) return;
        const audioBase64 = await recorder.stop();
        const res = await fetch("/api/stt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio: audioBase64,
            languageCode,
          }),
        });
        if (!res.ok) {
          throw new Error("Transcription failed");
        }
        const data = sttResponseSchema.safeParse(await res.json());
        if (!data.success) {
          throw new Error("Malformed transcription payload");
        }
        if (data.data.text) {
          setPendingTranscription(data.data.text);
        }
      } catch (toggleError) {
        setError(
          toggleError instanceof Error
            ? toggleError.message
            : "Transcription failed",
        );
      } finally {
        setTranscribing(false);
      }
      return;
    }

    // Start recording — stop any NPC audio to avoid overlap
    ttsPlayerRef.current?.stop();
    setTtsPlaying(null);
    try {
      if (!recorderRef.current) {
        recorderRef.current = new AudioRecorder();
      }
      await recorderRef.current.start();
      setRecording(true);
      setError(null);
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Microphone access denied",
      );
    }
  }

  return { recording, transcribing, handleMicToggle };
}
