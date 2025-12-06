"use client";

import { UserVideo } from "./UserVideo";

interface InvestorPanelProps {
  activeInvestor: string | null;
  isVideoOff: boolean;
}

const investors = [
  { id: "skeptic", name: "The Skeptic", color: "bg-red-900", emoji: "🤨" },
  { id: "numberCruncher", name: "Number Cruncher", color: "bg-blue-900", emoji: "🧮" },
  { id: "beenThere", name: "Been-There", color: "bg-green-900", emoji: "👴" },
];

export function InvestorPanel({ activeInvestor, isVideoOff }: InvestorPanelProps) {
  return (
    <div className="space-y-3 h-full flex flex-col">
      {/* Investor Tiles */}
      {investors.map((investor) => (
        <div
          key={investor.id}
          className={`rounded-lg p-4 text-center transition-all ${
            activeInvestor === investor.id
              ? `${investor.color} ring-2 ring-white`
              : "bg-gray-800"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-xl ${
              activeInvestor === investor.id ? "bg-white/20" : "bg-gray-700"
            }`}
          >
            {investor.emoji}
          </div>
          <p className="font-medium text-sm">{investor.name}</p>
          {activeInvestor === investor.id && (
            <div className="flex items-center justify-center gap-1 mt-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse delay-75"></span>
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse delay-150"></span>
            </div>
          )}
        </div>
      ))}

      {/* User Video - Takes remaining space */}
      <div className="flex-1 min-h-0">
        <UserVideo isVideoOff={isVideoOff} />
      </div>
    </div>
  );
}