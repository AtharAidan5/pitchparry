"use client";

import { useState, useCallback } from "react";

// ElevenLabs voice IDs - these are real public voices
const VOICE_IDS: Record<string, string> = {
  skeptic: "21m00Tcm4TlvDq8ikWAM", // Rachel - professional female
  numberCruncher: "VR6AewLTigWG4xSOukaG", // Arnold - deep male
  beenThere: "pNInz6obpgDQGcFmaJgB", // Adam - mature male
};

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const speak = useCallback(async (text: string, investorType: string): Promise<void> => {
    const voiceId = VOICE_IDS[investorType] || VOICE_IDS.skeptic;

    try {
      setIsSpeaking(true);
      setError(null);

      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `TTS failed with status ${response.status}`);
      }

      const audioBlob = await response.blob();
      
      if (audioBlob.size === 0) {
        throw new Error("Empty audio response");
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      return new Promise((resolve, reject) => {
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          resolve();
        };

        audio.onerror = (e) => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          reject(new Error("Audio playback failed"));
        };

        audio.play().catch((e) => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          reject(e);
        });
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("TTS error:", errorMessage);
      setError(errorMessage);
      setIsSpeaking(false);
    }
  }, []);

  return { speak, isSpeaking, error };
}