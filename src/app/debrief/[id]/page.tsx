"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function DebriefPage() {
  const params = useParams();
  const sessionId = params.id as Id<"pitchSessions">;

  const session = useQuery(api.pitchSessions.get, { sessionId });
  const messages = useQuery(api.messages.list, { sessionId });
  const saveFeedback = useMutation(api.pitchSessions.saveFeedback);

  const [feedback, setFeedback] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate feedback when page loads
  useEffect(() => {
    if (session && messages && messages.length > 0 && !feedback && !isGenerating) {
      generateFeedback();
    }
  }, [session, messages]);

  const generateFeedback = async () => {
    if (!messages || messages.length === 0) return;

    setIsGenerating(true);

    try {
      const res = await fetch("/api/generate-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: messages.map((m) => `${m.role}: ${m.content}`).join("\n"),
          sessionId,
        }),
      });

      const data = await res.json();
      setFeedback(data);

      // Save to database
      await saveFeedback({
        sessionId,
        overallScore: data.overallScore,
        topImprovements: data.topImprovements,
        deliveryFeedback: data.deliveryFeedback,
        contentFeedback: data.contentFeedback,
        presentationFeedback: data.presentationFeedback,
      });
    } catch (err) {
      console.error("Failed to generate feedback:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Pitch Debrief</h1>
          <p className="text-gray-400">Here's how you did</p>
        </div>

        {isGenerating ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-xl">Analyzing your pitch...</p>
            <p className="text-gray-400 mt-2">Our AI investors are deliberating</p>
          </div>
        ) : feedback ? (
          <>
            {/* Overall Score */}
            <div className="bg-gray-800 rounded-2xl p-8 mb-6 text-center">
              <p className="text-gray-400 mb-2">Overall Score</p>
              <p className="text-7xl font-bold text-blue-400">{feedback.overallScore}</p>
              <p className="text-gray-400 mt-2">out of 100</p>
            </div>

            {/* Top Improvements */}
            <div className="bg-gray-800 rounded-xl p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">🎯 Top 3 Things to Improve</h2>
              <ol className="space-y-3">
                {feedback.topImprovements?.map((item: string, i: number) => (
                  <li key={i} className="flex gap-3">
                    <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Delivery Feedback */}
            <div className="bg-gray-800 rounded-xl p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">🎤 Delivery</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Voice Tone</p>
                  <p>{feedback.deliveryFeedback?.voiceTone}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Pacing</p>
                  <p>{feedback.deliveryFeedback?.pacing}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Confidence</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {feedback.deliveryFeedback?.confidence}/10
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Filler Words Detected</p>
                  <p>
                    {feedback.deliveryFeedback?.fillerWords?.length > 0
                      ? feedback.deliveryFeedback.fillerWords.join(", ")
                      : "None detected ✨"}
                  </p>
                </div>
              </div>
            </div>

            {/* Content Feedback */}
            <div className="bg-gray-800 rounded-xl p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">📝 Content</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-sm">Clarity Score</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {feedback.contentFeedback?.clarity}/10
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Market Sizing</p>
                  <p>{feedback.contentFeedback?.marketSizing}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Competitive Analysis</p>
                  <p>{feedback.contentFeedback?.competitiveAnalysis}</p>
                </div>
              </div>
            </div>

            {/* Presentation Feedback */}
            <div className="bg-gray-800 rounded-xl p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">📊 Presentation</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-sm">Structure</p>
                  <p>{feedback.presentationFeedback?.structure}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Storytelling</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {feedback.presentationFeedback?.storytelling}/10
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Slide Usage</p>
                  <p>{feedback.presentationFeedback?.slideUsage}</p>
                </div>
              </div>
            </div>

            {/* Conversation History */}
            <div className="bg-gray-800 rounded-xl p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">💬 Session Transcript</h2>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {messages?.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg ${
                      msg.role === "user" ? "bg-blue-900/30 ml-8" : "bg-gray-700 mr-8"
                    }`}
                  >
                    <p className="text-xs text-gray-400 mb-1 capitalize">{msg.role}</p>
                    <p>{msg.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-400">No conversation data found.</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-4 mt-8">
          <Link
            href="/session/new"
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition"
          >
            Try Another Pitch
          </Link>
          <Link
            href="/"
            className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-medium transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}