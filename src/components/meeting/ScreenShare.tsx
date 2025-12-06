"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Monitor, StopCircle } from "lucide-react";

interface ScreenShareProps {
  onFrameCapture: (base64Image: string) => void;
  onShareStart?: () => void;
  onShareEnd?: () => void;
  disabled?: boolean;
  captureIntervalMs?: number;
}

export function ScreenShare({
  onFrameCapture,
  onShareStart,
  onShareEnd,
  disabled = false,
  captureIntervalMs = 8000,
}: ScreenShareProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const startSharing = async () => {
    if (disabled) return;
    
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "window" },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsSharing(true);
      onShareStart?.();

      stream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };
    } catch (err) {
      console.error("Failed to start screen share:", err);
    }
  };

  const stopSharing = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsSharing(false);
    onShareEnd?.();
  };

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !isSharing) return;

    const video = videoRef.current;
    if (video.videoWidth === 0) return;

    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1024 / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;

    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64 = canvas.toDataURL("image/jpeg", 0.7);
    onFrameCapture(base64);
  }, [isSharing, onFrameCapture]);

  useEffect(() => {
    if (!isSharing) return;

    const timeout = setTimeout(captureFrame, 2000);
    const interval = setInterval(captureFrame, captureIntervalMs);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [isSharing, captureFrame, captureIntervalMs]);

  return (
    <div className="w-full h-full bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden relative">
      {isSharing ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
          />
          {/* Stop Sharing Button */}
          <button
            onClick={stopSharing}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <StopCircle className="w-5 h-5" />
            Stop Presenting
          </button>
        </>
      ) : (
        <div className="text-center">
          <Monitor className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          {disabled ? (
            <>
              <p className="text-gray-400 mb-2">Presentation ended</p>
              <p className="text-gray-500 text-sm">Q&A session in progress</p>
            </>
          ) : (
            <>
              <p className="text-gray-500 mb-6">Share your screen to start presenting</p>
              <button
                onClick={startSharing}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg flex items-center gap-2 mx-auto transition"
              >
                <Monitor className="w-5 h-5" />
                Share Screen
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}