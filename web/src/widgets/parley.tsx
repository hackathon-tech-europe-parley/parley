import "@/index.css";
import { mountWidget, useWidgetState } from "skybridge/web";
import { useToolInfo, useCallTool } from "../helpers";
import { useState, useEffect, useRef } from "react";

interface Message {
  role: "user" | "npc";
  text: string;
}

function Parley() {
  const { output, isPending } = useToolInfo<"parley">();

  const [{ phase, messages, currentImage, npcName, hints, mood }, setWidgetState] = useWidgetState({
    phase: "loading" as string,
    messages: [] as Message[],
    currentImage: "" as string,
    npcName: "" as string,
    hints: [] as string[],
    mood: "neutral" as string,
  });

  const {
    callTool: sendNpcMessage,
    data: messageResult,
    isPending: isSending,
  } = useCallTool("parley-message");

  const {
    callTool: quitConversation,
    data: quitResult,
    isPending: isQuitting,
  } = useCallTool("parley-quit");

  const [userInput, setUserInput] = useState("");
  const [showHints, setShowHints] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize from widget output
  useEffect(() => {
    if (output && phase === "loading") {
      setWidgetState((prev) => ({
        ...prev,
        phase: "setup",
        currentImage: output.sceneImageUrl,
        npcName: output.npcName,
        hints: output.npcOpeningHints,
        mood: output.npcOpeningMood,
      }));
    }
  }, [output, phase]);

  // Handle NPC message responses
  useEffect(() => {
    if (!messageResult) return;
    const sc = messageResult.structuredContent;
    if ("error" in sc) return;

    if (sc.phase === "conversation") {
      setWidgetState((prev) => ({
        ...prev,
        phase: "conversation",
        messages: sc.conversationHistory as Message[],
        currentImage: sc.sceneImageUrl,
        hints: sc.hints,
        mood: sc.mood,
      }));
    } else if (sc.phase === "debrief") {
      setWidgetState((prev) => ({
        ...prev,
        phase: "debrief",
        messages: sc.conversationHistory as Message[],
        currentImage: sc.sceneImageUrl,
      }));
    }
  }, [messageResult]);

  // Handle quit responses
  useEffect(() => {
    if (!quitResult) return;
    const sc = quitResult.structuredContent;
    if ("error" in sc) return;

    if (sc.phase === "debrief") {
      setWidgetState((prev) => ({
        ...prev,
        phase: "debrief",
        messages: sc.conversationHistory as Message[],
        currentImage: sc.sceneImageUrl,
      }));
    }
  }, [quitResult]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isPending || phase === "loading") {
    return (
      <div className="parley-loading">
        <div className="parley-spinner" />
        <p>Setting the scene...</p>
      </div>
    );
  }

  if (!output) return null;

  const conversationId = output.conversationId;

  function handleSend() {
    const trimmed = userInput.trim();
    if (!trimmed || isSending) return;

    setWidgetState((prev) => ({
      ...prev,
      phase: "conversation",
      messages: [...prev.messages, { role: "user" as const, text: trimmed }],
    }));
    setUserInput("");
    setShowHints(false);

    sendNpcMessage({ conversationId, message: trimmed });
  }

  function handleStart() {
    // Transition to conversation phase with NPC's opening message
    setWidgetState((prev) => ({
      ...prev,
      phase: "conversation",
      messages: [{ role: "npc" as const, text: output!.npcOpeningMessage }],
    }));
  }

  function handleQuit() {
    quitConversation({ conversationId });
  }

  // SETUP PHASE
  if (phase === "setup") {
    return (
      <div className="parley-container" data-llm={`Setup: ${output.scenario}, goal: ${output.goal}`}>
        <div className="parley-scene">
          <img src={currentImage} alt="Scene" className="parley-scene-img" />
          <div className="parley-scene-overlay">
            <span className="parley-level-badge">{output.level}</span>
            <span className="parley-language-badge">{output.language}</span>
          </div>
        </div>
        <div className="parley-setup-info">
          <p className="parley-scenario">{output.scenario}</p>
          <div className="parley-goal">
            <strong>Your goal:</strong> {output.goal}
          </div>
          <div className="parley-npc-intro">
            You'll be talking to <strong>{output.npcName}</strong>
            {output.npcPersonality && <span className="parley-npc-desc"> - {output.npcPersonality}</span>}
          </div>
          <button className="parley-btn parley-btn-primary" onClick={handleStart}>
            Start Conversation
          </button>
        </div>
      </div>
    );
  }

  // DEBRIEF PHASE
  if (phase === "debrief") {
    const debriefData = messageResult?.structuredContent && "debrief" in messageResult.structuredContent
      ? messageResult.structuredContent.debrief
      : quitResult?.structuredContent && "debrief" in quitResult.structuredContent
        ? quitResult.structuredContent.debrief
        : null;

    const goalStatus = messageResult?.structuredContent && "goalStatus" in messageResult.structuredContent
      ? messageResult.structuredContent.goalStatus
      : "quit";

    return (
      <div className="parley-container" data-llm={`Debrief: goal ${goalStatus}`}>
        <div className="parley-scene">
          <img src={currentImage} alt="Final scene" className="parley-scene-img" />
          <div className="parley-scene-overlay">
            <span className={`parley-outcome-badge ${goalStatus === "achieved" ? "success" : "failure"}`}>
              {goalStatus === "achieved" ? "Goal Achieved!" : goalStatus === "failed" ? "Goal Failed" : "Left Early"}
            </span>
          </div>
        </div>
        {debriefData && (
          <div className="parley-debrief">
            <p className="parley-narrative">{debriefData.narrative}</p>
            {debriefData.keyPhrases && debriefData.keyPhrases.length > 0 && (
              <div className="parley-phrases">
                <h4>Key Phrases to Remember</h4>
                <ul>
                  {debriefData.keyPhrases.map((kp: { phrase: string; translation: string }, i: number) => (
                    <li key={i} className="parley-phrase-item">
                      <span className="parley-phrase">{kp.phrase}</span>
                      <span className="parley-translation">{kp.translation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // CONVERSATION PHASE
  return (
    <div className="parley-container" data-llm={`Conversation with ${npcName}, mood: ${mood}, ${messages.length} messages`}>
      <div className="parley-scene parley-scene-small">
        <img src={currentImage} alt="Scene" className="parley-scene-img" />
        <div className="parley-scene-overlay">
          <span className="parley-mood-badge">{mood}</span>
        </div>
      </div>

      <div className="parley-chat">
        {messages.map((msg, i) => (
          <div key={i} className={`parley-message ${msg.role === "user" ? "parley-message-user" : "parley-message-npc"}`}>
            {msg.role === "npc" && <span className="parley-message-sender">{npcName}</span>}
            <p>{msg.text}</p>
          </div>
        ))}
        {isSending && (
          <div className="parley-message parley-message-npc">
            <span className="parley-message-sender">{npcName}</span>
            <p className="parley-typing">...</p>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {showHints && hints.length > 0 && (
        <div className="parley-hints">
          {hints.map((hint, i) => (
            <button key={i} className="parley-hint-chip" onClick={() => { setUserInput(hint); setShowHints(false); }}>
              {hint}
            </button>
          ))}
        </div>
      )}

      <div className="parley-input-bar">
        <button className="parley-btn-hint" onClick={() => setShowHints(!showHints)} title="Show hints">
          ?
        </button>
        <input
          type="text"
          className="parley-input"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={`Type in ${output.language}...`}
          disabled={isSending}
        />
        <button className="parley-btn parley-btn-send" onClick={handleSend} disabled={isSending || !userInput.trim()}>
          Send
        </button>
        <button className="parley-btn parley-btn-quit" onClick={handleQuit} disabled={isQuitting}>
          Quit
        </button>
      </div>
    </div>
  );
}

export default Parley;

mountWidget(<Parley />);
