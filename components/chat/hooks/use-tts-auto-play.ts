"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NpcGender } from "@/core/types";
import type { ConversationState } from "../chat-types";
import { TTSPlayer } from "../lib/tts-player";

export function useTtsAutoPlay(state: ConversationState | null) {
  const ttsPlayerRef = useRef<TTSPlayer | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState<number | null>(null);
  const [npcMuted, setNpcMuted] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const hasAutoPlayed = useRef(false);
  const lastProcessedIndex = useRef(-1);
  const hasSetLevelSpeed = useRef(false);

  // Default TTS speed proportional to difficulty level
  const LEVEL_DEFAULT_SPEED: Record<string, number> = {
    beginner: 1.0,
    intermediate: 1.3,
    advanced: 1.7,
    impossible: 2.0,
  };

  useEffect(() => {
    ttsPlayerRef.current = new TTSPlayer();
    return () => {
      ttsPlayerRef.current?.dispose();
      ttsPlayerRef.current = null;
    };
  }, []);

  // Set TTS speed based on difficulty level when state first loads
  useEffect(() => {
    if (state && !hasSetLevelSpeed.current) {
      hasSetLevelSpeed.current = true;
      const levelSpeed = LEVEL_DEFAULT_SPEED[state.level] ?? 1.0;
      setTtsSpeed(levelSpeed);
    }
  }, [state]);

  const autoPlayTts = useCallback(
    (
      text: string,
      messageIndex: number,
      langCode?: string,
      gender?: NpcGender,
      specialPersonType?: string,
      mood?: string,
    ) => {
      if (!ttsPlayerRef.current || ttsPlayerRef.current.muted) {
        return;
      }
      setTtsPlaying(messageIndex);
      // Determine TTS gender: use opposite of main NPC gender for police officer
      let ttsGender: NpcGender = gender || "feminine";
      if (specialPersonType) {
        const mainNpcGender = gender || "feminine";
        ttsGender = mainNpcGender === "masculine" ? "feminine" : "masculine";
      }
      ttsPlayerRef.current
        .play(text, `msg-${messageIndex}`, langCode, ttsGender, ttsSpeed, mood)
        .then(() => setTtsPlaying(null))
        .catch((playError) => {
          console.error("TTS autoplay failed:", playError);
          setTtsPlaying(null);
        });
    },
    [ttsSpeed],
  );

  // Initialize lastProcessedIndex when state first loads
  useEffect(() => {
    if (state && lastProcessedIndex.current === -1) {
      lastProcessedIndex.current = state.history.length - 1;
    }
  }, [state]);

  // Auto-play first NPC message
  useEffect(() => {
    if (state && state.history.length > 0 && !hasAutoPlayed.current) {
      if (state.history.length !== 1) {
        return;
      }
      hasAutoPlayed.current = true;
      const firstNpc = state.history[0];
      if (firstNpc?.role === "npc") {
        const isSpecialPerson =
          firstNpc.speakerName &&
          (firstNpc.speakerName === state.specialPerson?.name ||
            (firstNpc.speakerName === "Officer" &&
              firstNpc.speakerName !== state.npcName));
        const specialPersonType = isSpecialPerson
          ? state.specialPerson?.type || "policeman"
          : undefined;
        autoPlayTts(
          firstNpc.text,
          0,
          state.languageCode,
          state.npcGender,
          specialPersonType,
          firstNpc.mood ?? state.mood,
        );
        lastProcessedIndex.current = 0;
      }
    }
  }, [state, autoPlayTts]);

  // Auto-play subsequent NPC messages
  useEffect(() => {
    if (!state || !state.history.length) {
      return;
    }

    const currentLastIndex = state.history.length - 1;
    if (currentLastIndex > lastProcessedIndex.current) {
      for (let i = lastProcessedIndex.current + 1; i <= currentLastIndex; i++) {
        const message = state.history[i];
        if (message?.role === "npc") {
          const isSpecialPerson =
            message.speakerName &&
            (message.speakerName === state.specialPerson?.name ||
              (message.speakerName === "Officer" &&
                message.speakerName !== state.npcName));
          const specialPersonType = isSpecialPerson
            ? state.specialPerson?.type || "policeman"
            : undefined;
          autoPlayTts(
            message.text,
            i,
            state.languageCode,
            state.npcGender,
            specialPersonType,
            message.mood ?? state.mood,
          );
        }
      }
      lastProcessedIndex.current = currentLastIndex;
    }
  }, [state, autoPlayTts]);

  function handleReplay(messageIndex: number, text: string) {
    const message = state?.history[messageIndex];
    const isSpecialPerson =
      message?.speakerName &&
      (message.speakerName === state?.specialPerson?.name ||
        (message.speakerName === "Officer" &&
          message.speakerName !== state?.npcName));
    const specialPersonType = isSpecialPerson
      ? state?.specialPerson?.type || "policeman"
      : undefined;
    autoPlayTts(
      text,
      messageIndex,
      state?.languageCode,
      state?.npcGender,
      specialPersonType,
      message?.mood ?? state?.mood,
    );
  }

  function handleSpeedChange(speed: number) {
    setTtsSpeed(speed);
  }

  function handleMuteToggle() {
    const next = !npcMuted;
    setNpcMuted(next);
    if (ttsPlayerRef.current) {
      ttsPlayerRef.current.muted = next;
    }
    if (next) setTtsPlaying(null);
  }

  return {
    ttsPlayerRef,
    ttsPlaying,
    setTtsPlaying,
    ttsSpeed,
    npcMuted,
    lastProcessedIndex,
    handleReplay,
    handleSpeedChange,
    handleMuteToggle,
  };
}
