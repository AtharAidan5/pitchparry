"use client";

import { useRef, useState, useEffect } from "react";
import { VideoOff } from "lucide-react";

interface UserVideoProps {
  isVideoOff: boolean;
}

export function UserVideo({ isVideoOff }: UserVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isVideoOff) {
      // Stop camera when video is turned off
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      return;
    }

    // Start camera when video is turned on
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: false, // We handle audio separately
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasPermission(true);
        setError(null);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error("Camera access error:", errorMessage);
        setHasPermission(false);
        setError(errorMessage);
      }
    }

    startCamera();

    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isVideoOff]);

  if (isVideoOff) {
    return (
      <div className="bg-gray-800 rounded-lg aspect-video flex flex-col items-center justify-center">
        <VideoOff className="w-8 h-8 text-gray-500 mb-2" />
        <p className="text-gray-500 text-sm">Camera off</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg aspect-video flex flex-col items-center justify-center p-4">
        <VideoOff className="w-8 h-8 text-red-500 mb-2" />
        <p className="text-red-400 text-sm text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full aspect-video object-cover mirror"
      />
      <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs">
        You
      </div>
    </div>
  );
}