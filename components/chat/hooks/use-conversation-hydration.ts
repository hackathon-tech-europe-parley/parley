"use client";

import { useEffect, useState } from "react";
import {
  conversationCacheSchema,
  conversationSnapshotSchema,
} from "@/core/types";
import {
  type ConversationState,
  type DebriefState,
  fromCachedConversation,
} from "../chat-types";

export function useConversationHydration(conversationId: string | null) {
  const [state, setState] = useState<ConversationState | null>(null);
  const [endStatus, setEndStatus] = useState<DebriefState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setError("Invalid conversation id");
      return;
    }

    const cached = sessionStorage.getItem(`parley:${conversationId}`);
    if (cached) {
      sessionStorage.removeItem(`parley:${conversationId}`);
      try {
        const parsedRaw = JSON.parse(cached) as unknown;
        const parsed = conversationCacheSchema.safeParse(parsedRaw);
        if (parsed.success) {
          setState(fromCachedConversation(parsed.data));
          return;
        }
      } catch {
        // Fall through to API hydration.
      }
    }

    fetch(`/api/conversation/${conversationId}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Conversation not found");
        }
        return response.json();
      })
      .then((data: unknown) => {
        const parsed = conversationSnapshotSchema.safeParse(data);
        if (!parsed.success) {
          throw new Error("Malformed conversation payload");
        }
        const snapshot = parsed.data;
        setState({
          ...snapshot,
          evaluationHistory: snapshot.evaluationHistory ?? [],
          objectiveHistory: snapshot.objectiveHistory ?? [],
        });
        if (
          snapshot.goalStatus &&
          snapshot.goalStatus !== "ongoing" &&
          snapshot.debrief
        ) {
          setEndStatus({
            debrief: snapshot.debrief,
            sceneImageUrl: snapshot.sceneImageUrl,
            npcName: snapshot.npcName,
            goalStatus: snapshot.goalStatus,
          });
        } else {
          setEndStatus(null);
        }
      })
      .catch((fetchError) => setError(fetchError.message));
  }, [conversationId]);

  return { state, setState, endStatus, setEndStatus, error, setError };
}
