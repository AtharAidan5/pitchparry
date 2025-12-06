"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function NewSession() {
  const createSession = useMutation(api.pitchSessions.create);
  const router = useRouter();
  const hasCreated = useRef(false);

  useEffect(() => {
    if (hasCreated.current) return;
    hasCreated.current = true;
    
    createSession().then((sessionId) => {
      router.push(`/session/${sessionId}`);
    });
  }, [createSession, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-xl">Creating your pitch session...</p>
      </div>
    </div>
  );
}