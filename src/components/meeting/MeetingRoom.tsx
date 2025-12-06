"use client";

import { useState, useCallback, useEffect } from "react";
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

export function MeetingRoom({ sessionId, session }: MeetingRoomProps) {
  const [activeInvestor, setActiveInvestor] = useState<string | null>(null);
  const [currentSlideContext, setCurrentSlideContext] = useState<string>("");
  const [slideWeaknesses, setSlideWeaknesses] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Click the mic to start presenting");

  const messages = useQuery(api.messages.list, { sessionId });
  const sendMessage = useMutation(api.messages.send);
  const updatePhase = useMutation(api.pitchSessions.updatePhase);
  const saveSlideAnalysis = useMutation(api.pitchSessions.saveSlideAnalysis);

  const { speak, isSpeaking } = useTextToSpeech();

  // Handle user speech - get AI investor response
  const handleTranscript = useCallback(
    async (transcript: string) => {
      if (!transcript.trim() || isProcessing || isSpeaking) return;

      setIsProcessing(true);
      setStatusMessage("Processing your pitch...");

      // Save user message
      await sendMessage({
        sessionId,
        role: "user",
        content: transcript,
        phase: session.phase,
      });

      // Pick investor to respond (rotate through them)
      const investors = ["skeptic", "numberCruncher", "beenThere"];
      const investorIndex = (messages?.length || 0) % investors.length;
      const investor = investors[investorIndex];
      setActiveInvestor(investor);
      setStatusMessage(`${investor === "skeptic" ? "The Skeptic" : investor === "numberCruncher" ? "Number Cruncher" : "Been-There"} is thinking...`);

      try {
        // Get investor response from Claude
        const res = await fetch("/api/investor-response", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            investorType: investor,
            slideContext: currentSlideContext,
            slideWeaknesses: slideWeaknesses,
            userTranscript: transcript,
            conversationHistory:
              messages?.map((m) => `${m.role}: ${m.content}`).join("\n") || "",
          }),
        });

        if (!res.ok) throw new Error("Failed to get response");

        const data = await res.json();
        const { question, latency } = data;

        // Log for demo purposes
        if (latency) {
          console.log(`⚡ Investor responded in ${latency}ms (powered by Groq)`);
        }

        // Save investor message
        await sendMessage({
          sessionId,
          role: investor,
          content: question,
          phase: session.phase,
        });

        setStatusMessage(`${investor === "skeptic" ? "The Skeptic" : investor === "numberCruncher" ? "Number Cruncher" : "Been-There"} is speaking...`);

        // Speak the response with ElevenLabs
        await speak(question, investor);

      } catch (err) {
        console.error("Investor response failed:", err);
        setStatusMessage("Error getting response. Try again.");
      } finally {
        setActiveInvestor(null);
        setIsProcessing(false);
        setStatusMessage("Click the mic to continue");
      }
    },
    [
      isProcessing,
      isSpeaking,
      sendMessage,
      sessionId,
      session.phase,
      messages,
      currentSlideContext,
      slideWeaknesses,
      speak,
    ]
  );

  // Voice recording hook
  const { isListening, interimTranscript, startListening, stopListening } =
    useVoiceRecording({
      onTranscript: handleTranscript,
    });

  // Toggle microphone
  const toggleMic = useCallback(() => {
    if (isProcessing || isSpeaking) return;

    if (isMuted) {
      // Unmute and start listening
      setIsMuted(false);
      startListening();
      setStatusMessage("Listening... Speak now");
    } else {
      // Mute and stop listening
      setIsMuted(true);
      stopListening();
      setStatusMessage("Microphone muted");
    }
  }, [isMuted, isProcessing, isSpeaking, startListening, stopListening]);

  // Update status when listening state changes
  useEffect(() => {
    if (isListening && !isMuted) {
      setStatusMessage("Listening... Speak now");
    }
  }, [isListening, isMuted]);

  // Handle screen capture frame
  const handleFrameCapture = useCallback(
    async (base64Image: string) => {
      try {
        const res = await fetch("/api/analyze-slide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Image }),
        });

        if (!res.ok) throw new Error("Analysis failed");

        const data = await res.json();
        setCurrentSlideContext(data.slideAnalysis || "");
        setSlideWeaknesses(data.weaknesses || []);

        // Save to Convex
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
    [sessionId, saveSlideAnalysis]
  );

  // End session
  const handleEndSession = async () => {
    stopListening();
    await updatePhase({ sessionId, phase: "debrief" });
    window.location.href = `/debrief/${sessionId}`;
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold">PitchParry</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{statusMessage}</span>
          <button
            onClick={handleEndSession}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition flex items-center gap-2"
          >
            <PhoneOff className="w-4 h-4" />
            End Session
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="grid grid-cols-4 gap-4 h-full">
          {/* Screen Share Area - 3 columns */}
          <div className="col-span-3 flex flex-col gap-4 overflow-hidden">
            <div className="flex-1 min-h-0">
              <ScreenShare onFrameCapture={handleFrameCapture} />
            </div>

            {/* Interim transcript - what user is saying */}
            {interimTranscript && (
              <div className="p-4 bg-blue-900/30 rounded-lg border border-blue-700">
                <p className="text-sm text-blue-400 mb-1">You are saying:</p>
                <p className="text-lg">{interimTranscript}</p>
              </div>
            )}

            {/* Latest message display */}
            {messages && messages.length > 0 && !interimTranscript && (
              <div
                className={`p-4 rounded-lg ${messages[messages.length - 1].role === "user"
                    ? "bg-gray-800"
                    : "bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-700/50"
                  }`}
              >
                <p className="text-sm text-gray-400 mb-1 capitalize">
                  {messages[messages.length - 1].role === "user"
                    ? "You"
                    : messages[messages.length - 1].role === "skeptic"
                      ? "🤨 The Skeptic"
                      : messages[messages.length - 1].role === "numberCruncher"
                        ? "🧮 Number Cruncher"
                        : "👴 Been-There"}
                </p>
                <p className="text-lg">{messages[messages.length - 1].content}</p>
              </div>
            )}

            {/* Slide context - what AI sees */}
            {currentSlideContext && (
              <div className="p-3 bg-gray-800/50 rounded-lg">
                <p className="text-sm text-gray-400">
                  🤖 AI sees: {currentSlideContext}
                </p>
                {slideWeaknesses.length > 0 && (
                  <p className="text-sm text-yellow-500 mt-1">
                    ⚠️ Potential weaknesses: {slideWeaknesses.join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Investor Panel - 1 column */}
          <div className="col-span-1 overflow-hidden">
            <InvestorPanel activeInvestor={activeInvestor} isVideoOff={isVideoOff} />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 bg-gray-900 border-t border-gray-800">
        <div className="flex justify-center items-center gap-6">
          {/* Mic Button - Now the main interaction */}
          <button
            onClick={toggleMic}
            disabled={isProcessing || isSpeaking}
            className={`p-5 rounded-full transition-all ${isProcessing || isSpeaking
                ? "bg-gray-600 cursor-not-allowed"
                : isMuted
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700 ring-4 ring-green-500/50 animate-pulse"
              }`}
          >
            {isMuted ? (
              <MicOff className="w-7 h-7" />
            ) : (
              <Mic className="w-7 h-7" />
            )}
          </button>

          {/* Video Button */}
          <button
            onClick={() => setIsVideoOff(!isVideoOff)}
            className={`p-4 rounded-full transition ${isVideoOff ? "bg-red-600 hover:bg-red-700" : "bg-gray-700 hover:bg-gray-600"
              }`}
          >
            {isVideoOff ? (
              <VideoOff className="w-6 h-6" />
            ) : (
              <Video className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Status indicator */}
        <div className="text-center mt-3">
          {isSpeaking && (
            <p className="text-purple-400 animate-pulse">🔊 Investor is speaking...</p>
          )}
          {isListening && !isMuted && (
            <p className="text-green-400">🎙️ Listening to your pitch...</p>
          )}
        </div>
      </div>
    </div>
  );
}