"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Monitor, MonitorOff } from "lucide-react";

interface ScreenShareProps {
  onFrameCapture: (base64Image: string) => void;
  captureIntervalMs?: number;
}

export function ScreenShare({
  onFrameCapture,
  captureIntervalMs = 8000,
}: ScreenShareProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const startSharing = async () => {
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

      // Handle user stopping share via browser UI
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
  };

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !isSharing) return;

    const video = videoRef.current;
    if (video.videoWidth === 0) return;

    const canvas = document.createElement("canvas");

    // Resize to save API tokens (max 1024px width)
    const scale = Math.min(1, 1024 / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;

    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64 = canvas.toDataURL("image/jpeg", 0.7);
    onFrameCapture(base64);
  }, [isSharing, onFrameCapture]);

  // Capture frames at interval
  useEffect(() => {
    if (!isSharing) return;

    // Capture after a short delay to ensure video is ready
    const timeout = setTimeout(captureFrame, 2000);

    // Then capture at regular intervals
    const interval = setInterval(captureFrame, captureIntervalMs);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [isSharing, captureFrame, captureIntervalMs]);

  return (
    <div className="relative w-full">
      {/* Video Display */}
      <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center overflow-hidden">
        {isSharing ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-center">
            <Monitor className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500">Click "Share Screen" to present your pitch</p>
          </div>
        )}
      </div>

      {/* Share Button */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <button
          onClick={isSharing ? stopSharing : startSharing}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition ${
            isSharing
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {isSharing ? (
            <>
              <MonitorOff className="w-5 h-5" />
              Stop Sharing
            </>
          ) : (
            <>
              <Monitor className="w-5 h-5" />
              Share Screen
            </>
          )}
        </button>
      </div>
    </div>
  );
}