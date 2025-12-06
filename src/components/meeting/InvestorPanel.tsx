"use client";

import { UserVideo } from "./UserVideo";

interface InvestorPanelProps {
  activeInvestor: string | null;
  isVideoOff: boolean;
}

const investors = [
  { id: "skeptic", name: "The Skeptic", emoji: "🤨" },
  { id: "numberCruncher", name: "Number Cruncher", emoji: "🧮" },
  { id: "beenThere", name: "Been-There", emoji: "👴" },
];

export function InvestorPanel({ activeInvestor, isVideoOff }: InvestorPanelProps) {
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Investors */}
      {investors.map((investor) => (
        <div
          key={investor.id}
          className={`rounded-lg p-4 text-center transition ${
            activeInvestor === investor.id
              ? "bg-purple-900 ring-2 ring-purple-500"
              : "bg-gray-800"
          }`}
        >
          <div className="text-3xl mb-2">{investor.emoji}</div>
          <p className="font-medium text-sm">{investor.name}</p>
          {activeInvestor === investor.id && (
            <div className="flex justify-center gap-1 mt-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse delay-75"></span>
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse delay-150"></span>
            </div>
          )}
        </div>
      ))}

      {/* User Video */}
      <div className="flex-1 min-h-0">
        <div className="rounded-lg overflow-hidden h-full">
          <UserVideo isVideoOff={isVideoOff} />
        </div>
      </div>
    </div>
  );
}