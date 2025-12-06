"use client";

import { UserVideo } from "./UserVideo";
import { Check } from "lucide-react";

interface InvestorPanelProps {
  activeInvestor: string | null;
  isVideoOff: boolean;
  currentPhase: string;
  currentInvestorIndex: number;
}

const investors = [
  { id: "skeptic", name: "The Skeptic", emoji: "🤨" },
  { id: "numberCruncher", name: "Number Cruncher", emoji: "🧮" },
  { id: "beenThere", name: "Been-There", emoji: "👴" },
];

export function InvestorPanel({
  activeInvestor,
  isVideoOff,
  currentPhase,
  currentInvestorIndex,
}: InvestorPanelProps) {
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Investors */}
      {investors.map((investor, index) => {
        const hasAsked = currentPhase === "qa" && index < currentInvestorIndex;
        const isCurrentlyAsking = activeInvestor === investor.id;
        const isUpNext = currentPhase === "qa" && index === currentInvestorIndex && !isCurrentlyAsking;

        return (
          <div
            key={investor.id}
            className={`rounded-lg p-4 text-center transition relative ${
              isCurrentlyAsking
                ? "bg-purple-900 ring-2 ring-purple-500"
                : hasAsked
                ? "bg-green-900/30 ring-1 ring-green-700"
                : isUpNext
                ? "bg-yellow-900/30 ring-1 ring-yellow-700"
                : "bg-gray-800"
            }`}
          >
            {/* Checkmark for completed */}
            {hasAsked && (
              <div className="absolute top-2 right-2">
                <Check className="w-4 h-4 text-green-500" />
              </div>
            )}

            <div className="text-3xl mb-2">{investor.emoji}</div>
            <p className="font-medium text-sm">{investor.name}</p>

            {/* Status indicators */}
            {isCurrentlyAsking && (
              <div className="flex justify-center gap-1 mt-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse delay-75"></span>
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse delay-150"></span>
              </div>
            )}
            {hasAsked && (
              <p className="text-xs text-green-400 mt-1">Asked</p>
            )}
            {isUpNext && (
              <p className="text-xs text-yellow-400 mt-1">Up next...</p>
            )}
            {currentPhase === "presenting" && (
              <p className="text-xs text-gray-500 mt-1">Watching</p>
            )}
          </div>
        );
      })}

      {/* User Video */}
      <div className="flex-1 min-h-0">
        <div className="rounded-lg overflow-hidden h-full">
          <UserVideo isVideoOff={isVideoOff} />
        </div>
      </div>
    </div>
  );
}