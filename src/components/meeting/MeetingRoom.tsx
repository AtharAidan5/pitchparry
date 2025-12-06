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
type InvestorType = (typeof INVESTORS)[number];

export function MeetingRoom({ sessionId, session }: MeetingRoomProps) {
  // Phase management
  const [phase, setPhase] = useState<SessionPhase>("waiting");
  const [currentInvestorIndex, setCurrentInvestorIndex] = useState(0);
  const [activeInvestor, setActiveInvestor] = useState<string | null>(null);
  const [waitingForAnswer, setWaitingForAnswer] = useState(false);
  const [investorAskedCount, setInvestorAskedCount] = useState<Record<string, number>>({});
  
  // Slide context
  const [currentSlideContext, setCurrentSlideContext] = useState<string>("");
  const [slideWeaknesses, setSlideWeaknesses] = useState<string[]>([]);
  const [allSlideContexts, setAllSlideContexts] = useState<string[]>([]);
  
  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Share your screen to start presenting");

  // Timer ref for 5-second delay
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const messages = useQuery(api.messages.list, { sessionId });
  const sendMessage = useMutation(api.messages.send);
  const updatePhase = useMutation(api.pitchSessions.updatePhase);
  const saveSlideAnalysis = useMutation(api.pitchSessions.saveSlideAnalysis);

  const { speak, isSpeaking } = useTextToSpeech();

  // Get investor display name
  const getInvestorName = (id: string) => {
    switch (id) {
      case "skeptic": return "The Skeptic";
      case "numberCruncher": return "Number Cruncher";
      case "beenThere": return "Been-There";
      default: return id;
    }
  };

  // Ask question from current investor
  const askInvestorQuestion = useCallback(async () => {
    if (currentInvestorIndex >= INVESTORS.length) {
      // All investors have asked, end Q&A
      setStatusMessage("All investors have asked their questions. Click End Session for feedback.");
      setPhase("ended");
      return;
    }

    const investor = INVESTORS[currentInvestorIndex];
    setActiveInvestor(investor);
    setStatusMessage(`${getInvestorName(investor)} is thinking...`);
    setIsProcessing(true);

    try {
      const res = await fetch("/api/investor-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorType: investor,
          slideContext: allSlideContexts.join("\n"),
          slideWeaknesses: slideWeaknesses,
          userTranscript: "The presenter just finished their pitch.",
          conversationHistory:
            messages?.map((m) => `${m.role}: ${m.content}`).join("\n") || "",
        }),
      });

      if (!res.ok) throw new Error("Failed to get response");

      const { question } = await res.json();

      await sendMessage({
        sessionId,
        role: investor,
        content: question,
        phase: "qa",
      });

      setStatusMessage(`${getInvestorName(investor)} is speaking...`);

      // Speak the question
      await speak(question, investor);

      // Now waiting for user's answer
      setWaitingForAnswer(true);
      setStatusMessage("Your turn to answer. Click the mic to respond.");
      
    } catch (err) {
      console.error("Investor question failed:", err);
      setStatusMessage("Error getting question. Moving to next investor...");
      // Move to next investor on error
      setCurrentInvestorIndex((prev) => prev + 1);
    } finally {
      setActiveInvestor(null);
      setIsProcessing(false);
    }
  }, [currentInvestorIndex, allSlideContexts, slideWeaknesses, messages, sendMessage, sessionId, speak]);

  // Handle user's answer
  const handleTranscript = useCallback(
    async (transcript: string) => {
      if (!transcript.trim() || isProcessing || isSpeaking) return;
      if (phase !== "qa" || !waitingForAnswer) return;

      setIsProcessing(true);
      setWaitingForAnswer(false);

      // Save user's answer
      await sendMessage({
        sessionId,
        role: "user",
        content: transcript,
        phase: "qa",
      });

      setIsProcessing(false);

      // Move to next investor after 5 second delay
      setStatusMessage("Next investor will ask in 5 seconds...");
      
      delayTimerRef.current = setTimeout(() => {
        setCurrentInvestorIndex((prev) => prev + 1);
      }, 5000);
    },
    [isProcessing, isSpeaking, phase, waitingForAnswer, sendMessage, sessionId]
  );

  // Trigger next investor question when index changes
  useEffect(() => {
    if (phase === "qa" && currentInvestorIndex < INVESTORS.length && !waitingForAnswer && !isProcessing && !isSpeaking) {
      askInvestorQuestion();
    }
  }, [currentInvestorIndex, phase, waitingForAnswer, isProcessing, isSpeaking, askInvestorQuestion]);

  const { isListening, interimTranscript, startListening, stopListening } =
    useVoiceRecording({
      onTranscript: handleTranscript,
    });

  const toggleMic = useCallback(() => {
    if (isProcessing || isSpeaking) return;
    if (phase === "qa" && !waitingForAnswer) return; // Can only talk when it's their turn

    if (isMuted) {
      setIsMuted(false);
      startListening();
    } else {
      setIsMuted(true);
      stopListening();
    }
  }, [isMuted, isProcessing, isSpeaking, phase, waitingForAnswer, startListening, stopListening]);

  // Handle screen share start
  const handleScreenShareStart = useCallback(() => {
    setPhase("presenting");
    setStatusMessage("You are presenting. The investors are watching silently.");
  }, []);

  // Handle screen share end - triggers Q&A
  const handleScreenShareEnd = useCallback(() => {
    if (phase === "presenting") {
      setPhase("qa");
      setCurrentInvestorIndex(0);
      setStatusMessage("Presentation ended. Q&A session starting...");
      
      // Add a system message
      sendMessage({
        sessionId,
        role: "system",
        content: "Presentation ended. Q&A session is starting.",
        phase: "qa",
      });
    }
  }, [phase, sendMessage, sessionId]);

  // Handle frame capture during presentation
  const handleFrameCapture = useCallback(
    async (base64Image: string) => {
      if (phase !== "presenting") return;

      try {
        const res = await fetch("/api/analyze-slide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Image }),
        });

        if (!res.ok) throw new Error("Analysis failed");

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

  // End session
  const handleEndSession = async () => {
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
    }
    stopListening();
    await updatePhase({ sessionId, phase: "debrief" });
    window.location.href = `/debrief/${sessionId}`;
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">PitchParry</h1>
          <span className="text-sm px-2 py-1 rounded bg-gray-800 text-gray-300">
            {phase === "waiting" && "Ready"}
            {phase === "presenting" && "🔴 Presenting"}
            {phase === "qa" && "💬 Q&A"}
            {phase === "ended" && "✅ Complete"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{statusMessage}</span>
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
          {/* Screen Share */}
          <div className="flex-1 min-h-0">
            <ScreenShare
              onFrameCapture={handleFrameCapture}
              onShareStart={handleScreenShareStart}
              onShareEnd={handleScreenShareEnd}
              disabled={phase === "qa" || phase === "ended"}
            />
          </div>

          {/* Messages Area */}
          <div className="h-36 overflow-y-auto space-y-2">
            {/* Interim transcript */}
            {interimTranscript && (
              <div className="bg-blue-900/50 border border-blue-700 rounded-lg p-3">
                <p className="text-sm text-blue-300">You are saying:</p>
                <p className="text-white">{interimTranscript}</p>
              </div>
            )}

            {/* Show last 3 messages */}
            {messages && messages.length > 0 && !interimTranscript && (
              <div className="space-y-2">
                {messages.slice(-3).map((msg, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-3 ${
                      msg.role === "user"
                        ? "bg-gray-800"
                        : msg.role === "system"
                        ? "bg-gray-700 text-gray-300 text-sm"
                        : "bg-purple-900/50 border border-purple-700"
                    }`}
                  >
                    {msg.role !== "system" && (
                      <p className="text-sm text-gray-400 mb-1">
                        {msg.role === "user"
                          ? "You"
                          : msg.role === "skeptic"
                          ? "🤨 The Skeptic"
                          : msg.role === "numberCruncher"
                          ? "🧮 Number Cruncher"
                          : "👴 Been-There"}
                      </p>
                    )}
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
        {/* Mic Button */}
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
          title={phase === "qa" && !waitingForAnswer ? "Wait for your turn" : isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {/* Video Button */}
        <button
          onClick={() => setIsVideoOff(!isVideoOff)}
          className={`p-4 rounded-full transition ${
            isVideoOff ? "bg-red-600 hover:bg-red-700" : "bg-gray-700 hover:bg-gray-600"
          }`}
        >
          {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </button>

        {/* End Call */}
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