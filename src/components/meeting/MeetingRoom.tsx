"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ScreenShare } from "./ScreenShare";
import { InvestorPanel } from "./InvestorPanel";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

interface MeetingRoomProps {
  sessionId: Id<"pitchSessions">;
  session: {
    phase: string;
    weaknesses?: string[];
  };
}

type SessionPhase = "waiting" | "presenting" | "qa" | "ended";

const INVESTORS = ["skeptic", "numberCruncher", "beenThere"] as const;

export function MeetingRoom({ sessionId, session }: MeetingRoomProps) {
  const [phase, setPhase] = useState<SessionPhase>("waiting");
  const [currentInvestorIndex, setCurrentInvestorIndex] = useState(0);
  const [activeInvestor, setActiveInvestor] = useState<string | null>(null);
  const [waitingForAnswer, setWaitingForAnswer] = useState(false);
  const [hasAskedQuestion, setHasAskedQuestion] = useState(false);

  const [currentSlideContext, setCurrentSlideContext] = useState<string>("");
  const [slideWeaknesses, setSlideWeaknesses] = useState<string[]>([]);
  const [allSlideContexts, setAllSlideContexts] = useState<string[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Share your screen to start presenting");

  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const messages = useQuery(api.messages.list, { sessionId });
  const sendMessage = useMutation(api.messages.send);
  const updatePhase = useMutation(api.pitchSessions.updatePhase);
  const saveSlideAnalysis = useMutation(api.pitchSessions.saveSlideAnalysis);

  const { speak, isSpeaking } = useTextToSpeech();

  const getInvestorName = (id: string) => {
    switch (id) {
      case "skeptic": return "The Skeptic";
      case "numberCruncher": return "Number Cruncher";
      case "beenThere": return "Been-There";
      default: return id;
    }
  };

  // Ask ONE question from current investor
  const askInvestorQuestion = useCallback(async () => {
    if (currentInvestorIndex >= INVESTORS.length) {
      setPhase("ended");
      setStatusMessage("Q&A complete! Click End Session for your feedback.");
      return;
    }

    const investor = INVESTORS[currentInvestorIndex];
    setActiveInvestor(investor);
    setHasAskedQuestion(false);
    setStatusMessage(`${getInvestorName(investor)} is preparing a question...`);
    setIsProcessing(true);

    try {
      const res = await fetch("/api/investor-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorType: investor,
          slideContext: allSlideContexts.slice(-3).join("\n"),
          slideWeaknesses: slideWeaknesses,
          userTranscript: "The presenter just finished their pitch presentation.",
          conversationHistory: messages?.slice(-6).map((m) => `${m.role}: ${m.content}`).join("\n") || "",
        }),
      });

      if (!res.ok) throw new Error("Failed");

      const { question } = await res.json();

      await sendMessage({
        sessionId,
        role: investor,
        content: question,
        phase: "qa",
      });

      setStatusMessage(`${getInvestorName(investor)} is speaking...`);
      await speak(question, investor);

      setHasAskedQuestion(true);
      setWaitingForAnswer(true);
      setStatusMessage("Your turn! Click the mic to answer.");

    } catch (err) {
      console.error("Question failed:", err);
      moveToNextInvestor();
    } finally {
      setActiveInvestor(null);
      setIsProcessing(false);
    }
  }, [currentInvestorIndex, allSlideContexts, slideWeaknesses, messages, sendMessage, sessionId, speak]);

  // Move to next investor
  const moveToNextInvestor = useCallback(() => {
    const nextIndex = currentInvestorIndex + 1;
    if (nextIndex >= INVESTORS.length) {
      setPhase("ended");
      setStatusMessage("Q&A complete! Click End Session for your feedback.");
    } else {
      setCurrentInvestorIndex(nextIndex);
      setWaitingForAnswer(false);
      setHasAskedQuestion(false);
    }
  }, [currentInvestorIndex]);

  // Handle user's answer
  const handleTranscript = useCallback(
    async (transcript: string) => {
      if (!transcript.trim() || isProcessing || isSpeaking) return;
      if (phase !== "qa" || !waitingForAnswer) return;

      setIsProcessing(true);
      setWaitingForAnswer(false);

      await sendMessage({
        sessionId,
        role: "user",
        content: transcript,
        phase: "qa",
      });

      setIsProcessing(false);
      setStatusMessage("Moving to next investor in 3 seconds...");

      // 3 second delay, then next investor
      delayTimerRef.current = setTimeout(() => {
        moveToNextInvestor();
      }, 3000);
    },
    [isProcessing, isSpeaking, phase, waitingForAnswer, sendMessage, sessionId, moveToNextInvestor]
  );

  // Trigger question when investor changes
  useEffect(() => {
    if (phase === "qa" && !waitingForAnswer && !isProcessing && !isSpeaking && !hasAskedQuestion) {
      askInvestorQuestion();
    }
  }, [phase, currentInvestorIndex, waitingForAnswer, isProcessing, isSpeaking, hasAskedQuestion, askInvestorQuestion]);

  const { isListening, interimTranscript, startListening, stopListening } =
    useVoiceRecording({ onTranscript: handleTranscript });

  const toggleMic = useCallback(() => {
    if (isProcessing || isSpeaking) return;
    if (phase === "qa" && !waitingForAnswer) return;

    if (isMuted) {
      setIsMuted(false);
      startListening();
    } else {
      setIsMuted(true);
      stopListening();
    }
  }, [isMuted, isProcessing, isSpeaking, phase, waitingForAnswer, startListening, stopListening]);

  const handleScreenShareStart = useCallback(() => {
    setPhase("presenting");
    setStatusMessage("Presenting... Investors are watching silently.");
  }, []);

  const handleScreenShareEnd = useCallback(() => {
    if (phase === "presenting") {
      setPhase("qa");
      setCurrentInvestorIndex(0);
      setWaitingForAnswer(false);
      setHasAskedQuestion(false);
      setStatusMessage("Presentation ended. Starting Q&A...");
    }
  }, [phase]);

  const handleFrameCapture = useCallback(
    async (base64Image: string) => {
      if (phase !== "presenting") return;

      try {
        const res = await fetch("/api/analyze-slide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Image }),
        });

        if (!res.ok) return;

        const data = await res.json();
        setCurrentSlideContext(data.slideAnalysis || "");
        setSlideWeaknesses((prev) => [...new Set([...prev, ...(data.weaknesses || [])])]);
        setAllSlideContexts((prev) => [...prev, data.slideAnalysis || ""]);

        await saveSlideAnalysis({
          sessionId,
          currentSlideAnalysis: data.slideAnalysis || "",
          weaknesses: data.weaknesses || [],
          keyClaims: data.keyClaims || [],
        });
      } catch (err) {
        console.error("Slide analysis failed:", err);
      }
    },
    [phase, sessionId, saveSlideAnalysis]
  );

  const handleEndSession = async () => {
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    stopListening();
    await updatePhase({ sessionId, phase: "debrief" });
    window.location.href = `/debrief/${sessionId}`;
  };

  useEffect(() => {
    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    };
  }, []);

  return (
    <div className="h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">PitchParry</h1>
          <span className={`text-sm px-2 py-1 rounded ${
            phase === "presenting" ? "bg-red-900 text-red-300" :
            phase === "qa" ? "bg-purple-900 text-purple-300" :
            phase === "ended" ? "bg-green-900 text-green-300" :
            "bg-gray-800 text-gray-300"
          }`}>
            {phase === "waiting" && "Ready"}
            {phase === "presenting" && "🔴 Presenting"}
            {phase === "qa" && `💬 Q&A (${currentInvestorIndex + 1}/3)`}
            {phase === "ended" && "✅ Complete"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 max-w-md truncate">{statusMessage}</span>
          <button
            onClick={handleEndSession}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <PhoneOff className="w-4 h-4" />
            End Session
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Screen Share + Messages */}
        <div className="flex-1 flex flex-col p-4 gap-4">
          <div className="flex-1 min-h-0">
            <ScreenShare
              onFrameCapture={handleFrameCapture}
              onShareStart={handleScreenShareStart}
              onShareEnd={handleScreenShareEnd}
              disabled={phase === "qa" || phase === "ended"}
            />
          </div>

          {/* Messages */}
          <div className="h-36 overflow-y-auto space-y-2">
            {interimTranscript && (
              <div className="bg-blue-900/50 border border-blue-700 rounded-lg p-3">
                <p className="text-sm text-blue-300">You:</p>
                <p className="text-white">{interimTranscript}</p>
              </div>
            )}

            {messages && messages.length > 0 && !interimTranscript && (
              <div className="space-y-2">
                {messages.slice(-3).map((msg, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-3 ${
                      msg.role === "user"
                        ? "bg-gray-800"
                        : msg.role === "system"
                        ? "bg-gray-700 text-sm"
                        : "bg-purple-900/50 border border-purple-700"
                    }`}
                  >
                    <p className="text-sm text-gray-400 mb-1">
                      {msg.role === "user" ? "You" :
                       msg.role === "skeptic" ? "🤨 The Skeptic" :
                       msg.role === "numberCruncher" ? "🧮 Number Cruncher" :
                       msg.role === "beenThere" ? "👴 Been-There" : "System"}
                    </p>
                    <p className="text-white">{msg.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Investor Panel */}
        <div className="w-72 border-l border-gray-800 p-4">
          <InvestorPanel
            activeInvestor={activeInvestor}
            isVideoOff={isVideoOff}
            currentPhase={phase}
            currentInvestorIndex={currentInvestorIndex}
          />
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="flex justify-center items-center gap-4 py-4 border-t border-gray-800 bg-gray-900">
        <button
          onClick={toggleMic}
          disabled={isProcessing || isSpeaking || (phase === "qa" && !waitingForAnswer)}
          className={`p-4 rounded-full transition ${
            isProcessing || isSpeaking || (phase === "qa" && !waitingForAnswer)
              ? "bg-gray-600 cursor-not-allowed"
              : isMuted
              ? "bg-red-600 hover:bg-red-700"
              : "bg-green-600 hover:bg-green-700 ring-2 ring-green-400"
          }`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <button
          onClick={() => setIsVideoOff(!isVideoOff)}
          className={`p-4 rounded-full transition ${
            isVideoOff ? "bg-red-600 hover:bg-red-700" : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
          {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </button>

        <button
          onClick={handleEndSession}
          className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}