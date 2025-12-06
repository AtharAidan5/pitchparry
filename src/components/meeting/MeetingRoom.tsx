"use client";

import { useState, useCallback } from "react";
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
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const messages = useQuery(api.messages.list, { sessionId });
  const sendMessage = useMutation(api.messages.send);
  const updatePhase = useMutation(api.pitchSessions.updatePhase);
  const saveSlideAnalysis = useMutation(api.pitchSessions.saveSlideAnalysis);

  const { speak, isSpeaking } = useTextToSpeech();

  // Handle user speech
  const handleTranscript = useCallback(
    async (transcript: string) => {
      if (!transcript.trim() || isProcessing || isSpeaking) return;

      setIsProcessing(true);

      await sendMessage({
        sessionId,
        role: "user",
        content: transcript,
        phase: session.phase,
      });

      const investorTypes = ["skeptic", "numberCruncher", "beenThere"];
      const investorIndex = (messages?.length || 0) % investorTypes.length;
      const investor = investorTypes[investorIndex];
      setActiveInvestor(investor);

      try {
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

        const { question } = await res.json();

        await sendMessage({
          sessionId,
          role: investor,
          content: question,
          phase: session.phase,
        });

        await speak(question, investor);
      } catch (err) {
        console.error("Investor response failed:", err);
      } finally {
        setActiveInvestor(null);
        setIsProcessing(false);
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

  const { isListening, interimTranscript, startListening, stopListening } =
    useVoiceRecording({
      onTranscript: handleTranscript,
    });

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

  const handleEndSession = async () => {
    stopListening();
    await updatePhase({ sessionId, phase: "debrief" });
    window.location.href = `/debrief/${sessionId}`;
  };

  return (
    <div className="h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800">
        <h1 className="text-xl font-semibold">PitchParry</h1>
        <div className="flex items-center gap-4">
          {isSpeaking && (
            <span className="text-purple-400 text-sm animate-pulse">
              🔊 AI Speaking...
            </span>
          )}
          {isListening && !isMuted && (
            <span className="text-green-400 text-sm">
              🎙️ Listening...
            </span>
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
          {/* Screen Share */}
          <div className="flex-1 min-h-0">
            <ScreenShare onFrameCapture={handleFrameCapture} />
          </div>

          {/* Messages Area */}
          <div className="h-32 overflow-y-auto">
            {/* Interim transcript */}
            {interimTranscript && (
              <div className="bg-blue-900/50 border border-blue-700 rounded-lg p-3 mb-2">
                <p className="text-sm text-blue-300">You are saying:</p>
                <p className="text-white">{interimTranscript}</p>
              </div>
            )}

            {/* Latest message */}
            {messages && messages.length > 0 && !interimTranscript && (
              <div
                className={`rounded-lg p-3 ${
                  messages[messages.length - 1].role === "user"
                    ? "bg-gray-800"
                    : "bg-purple-900/50 border border-purple-700"
                }`}
              >
                <p className="text-sm text-gray-400 mb-1">
                  {messages[messages.length - 1].role === "user"
                    ? "You"
                    : messages[messages.length - 1].role === "skeptic"
                    ? "🤨 The Skeptic"
                    : messages[messages.length - 1].role === "numberCruncher"
                    ? "🧮 Number Cruncher"
                    : "👴 Been-There"}
                </p>
                <p className="text-white">{messages[messages.length - 1].content}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Investor Panel */}
        <div className="w-72 border-l border-gray-800 p-4">
          <InvestorPanel activeInvestor={activeInvestor} isVideoOff={isVideoOff} />
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="flex justify-center items-center gap-4 py-4 border-t border-gray-800 bg-gray-900">
        {/* Mic Button */}
        <button
          onClick={toggleMic}
          disabled={isProcessing || isSpeaking}
          className={`p-4 rounded-full transition ${
            isProcessing || isSpeaking
              ? "bg-gray-600 cursor-not-allowed"
              : isMuted
              ? "bg-red-600 hover:bg-red-700"
              : "bg-gray-700 hover:bg-gray-600"
          }`}
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