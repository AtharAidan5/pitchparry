"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { MeetingRoom } from "@/components/meeting/MeetingRoom";

export default function SessionPage() {
  const params = useParams();
  const sessionId = params.id as Id<"pitchSessions">;

  const session = useQuery(api.pitchSessions.get, { sessionId });

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl">Loading session...</p>
        </div>
      </div>
    );
  }

  return <MeetingRoom sessionId={sessionId} session={session} />;
}