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

// Phrases that indicate the pitch is ending
const END_PHRASES = [
  "thank you",
  "thanks for listening",
  "that's all",
  "that concludes",
  "any questions",
  "i'm done",
  "that's it",
  "end of presentation",
  "thanks everyone",
];

export function MeetingRoom({ sessionId, session }: MeetingRoomProps) {
  const [phase, setPhase] = useState<SessionPhase>("waiting");
  const [currentInvestorIndex, setCurrentInvestorIndex] = useState(0);
  const [activeInvestor, setActiveInvestor] = useState<string | null>(null);
  const [waitingForAnswer, setWaitingForAnswer] = useState(false);

  const [allSlideContexts, setAllSlideContexts] = useState<string[]>([]);
  const [slideWeaknesses, setSlideWeaknesses] = useState<string[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Share your screen to start presenting");

  const qaStartedRef = useRef(false);
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

  // Check if text contains end phrases
  const containsEndPhrase = (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return END_PHRASES.some((phrase) => lowerText.includes(phrase));
  };

  // Ask question from a specific investor
  const askQuestion = async (investorIndex: number) => {
    if (investorIndex >= INVESTORS.length) {
      setPhase("ended");
      setStatusMessage("Q&A complete! Click End Session for your feedback.");
      return;
    }

    const investor = INVESTORS[investorIndex];
    setActiveInvestor(investor);
    setCurrentInvestorIndex(investorIndex);
    setStatusMessage(`${getInvestorName(investor)} is preparing a question...`);
    setIsProcessing(true);

    try {
      const res = await fetch("/api/investor-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorType: investor,
          slideContext: allSlideContexts.slice(-3).join("\n") || "General startup pitch",
          slideWeaknesses: slideWeaknesses,
          userTranscript: "The presenter just finished their pitch presentation.",
          conversationHistory: messages?.slice(-6).map((m) => `${m.role}: ${m.content}`).join("\n") || "",
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
      await speak(question, investor);

      setWaitingForAnswer(true);
      setStatusMessage("Your turn! Unmute and answer the question.");

    } catch (err) {
      console.error("Question failed:", err);
      askQuestion(investorIndex + 1);
    } finally {
      setActiveInvestor(null);
      setIsProcessing(false);
    }
  };

  // Start Q&A session
  const startQA = useCallback(() => {
    if (qaStartedRef.current) return;
    qaStartedRef.current = true;

    setPhase("qa");
    setCurrentInvestorIndex(0);
    setWaitingForAnswer(false);
    setStatusMessage("Thank you for your pitch! Q&A is starting...");

    // Add system message
    sendMessage({
      sessionId,
      role: "system",
      content: "The presenter has concluded their pitch. Q&A session is now starting.",
      phase: "qa",
    });

    // Small delay, then first question
    setTimeout(() => {
      askQuestion(0);
    }, 2000);
  }, [sessionId, sendMessage]);

  // Handle transcript during presenting OR Q&A
  const handleTranscript = useCallback(
    async (transcript: string) => {
      if (!transcript.trim()) return;
      if (isProcessing || isSpeaking) return;

      // During PRESENTING phase: check for end phrases
      if (phase === "presenting") {
        // Save what they said
        await sendMessage({
          sessionId,
          role: "user",
          content: transcript,
          phase: "presenting",
        });

        // Check if they're ending the pitch
        if (containsEndPhrase(transcript)) {
          setStatusMessage("Detected end of pitch. Starting Q&A...");
          startQA();
        }
        return;
      }

      // During Q&A phase: handle answers
      if (phase === "qa" && waitingForAnswer) {
        setWaitingForAnswer(false);
        setIsProcessing(true);

        await sendMessage({
          sessionId,
          role: "user",
          content: transcript,
          phase: "qa",
        });

        setIsProcessing(false);

        const nextIndex = currentInvestorIndex + 1;

        if (nextIndex >= INVESTORS.length) {
          setPhase("ended");
          setStatusMessage("Q&A complete! Click End Session for your feedback.");
        } else {
          setStatusMessage("Next investor in 3 seconds...");
          delayTimerRef.current = setTimeout(() => {
            askQuestion(nextIndex);
          }, 3000);
        }
      }
    },
    [isProcessing, isSpeaking, phase, waitingForAnswer, sendMessage, sessionId, currentInvestorIndex, startQA]
  );

  const { isListening, interimTranscript, startListening, stopListening } =
    useVoiceRecording({ onTranscript: handleTranscript });

  const toggleMic = useCallback(() => {
    if (isProcessing || isSpeaking) return;

    if (isMuted) {
      setIsMuted(false);
      startListening();
    } else {
      setIsMuted(true);
      stopListening();
    }
  }, [isMuted, isProcessing, isSpeaking, startListening, stopListening]);

  const handleScreenShareStart = useCallback(() => {
    setPhase("presenting");
    qaStartedRef.current = false;
    setStatusMessage("Presenting... Unmute to speak. Say 'Thank you' when done.");
  }, []);

  const handleScreenShareEnd = useCallback(() => {
    // Screen share ended but pitch not concluded yet
    if (phase === "presenting" && !qaStartedRef.current) {
      setStatusMessage("Screen share stopped. Say 'Thank you' to start Q&A, or share again.");
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

  // Manual trigger for Q&A (backup button)
  const handleStartQA = () => {
    if (phase === "presenting") {
      startQA();
    }
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
          <span className="text-sm text-gray-400 max-w-sm truncate">{statusMessage}</span>
          
          {/* Manual Start Q&A Button (backup) */}
          {phase === "presenting" && (
            <button
              onClick={handleStartQA}
              className="bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded-lg text-sm transition"
            >
              Start Q&A
            </button>
          )}
          
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
              disabled={phase === "ended"}
            />
          </div>

          {/* Hint for user */}
          {phase === "presenting" && (
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 text-center">
              <p className="text-blue-300 text-sm">
                💡 Say <span className="font-semibold">"Thank you"</span> when you finish your pitch to start Q&A
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="h-32 overflow-y-auto space-y-2">
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
                        ? "bg-gray-700 text-sm italic"
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
          disabled={isProcessing || isSpeaking}
          className={`p-4 rounded-full transition ${
            isProcessing || isSpeaking
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