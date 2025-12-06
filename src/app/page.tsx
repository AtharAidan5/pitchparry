// PitchParry - AI Pitch Simulator
// Sponsor Tracks: Cursor, Anthropic, Groq, ElevenLabs, Convex, CodeRabbit
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold mb-4">PitchParry</h1>
      <p className="text-xl text-gray-400 mb-8 text-center max-w-xl">
        Stress-test your startup pitch with AI investors who challenge every assumption.
      </p>

      <Link
        href="/session/new"
        className="bg-white text-black px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-200 transition"
      >
        Start Pitch Session
      </Link>
    </div>
  );
}