"use client";

import { useState, useEffect } from "react";

const PHASES = [
  "Submitting to GenLayer...",
  "AI Validators analyzing match...",
  "Reaching consensus...",
  "Almost there...",
];

export default function ConsensusLoader() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const phase = elapsed < 5 ? 0 : elapsed < 20 ? 1 : elapsed < 50 ? 2 : 3;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      {/* Spinner */}
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-2 border-[#00f0ff]/20 rounded-full" />
        <div className="absolute inset-0 border-2 border-transparent border-t-[#00f0ff] rounded-full animate-spin" />
        <div className="absolute inset-2 border-2 border-transparent border-b-[#7000ff] rounded-full animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-[#00f0ff] rounded-full animate-pulse" />
        </div>
      </div>

      {/* Phase text */}
      <span className="text-xs font-mono text-white/50 tracking-wider animate-pulse">
        {PHASES[phase]}
      </span>

      {/* Timer */}
      <span className="text-[10px] font-mono text-white/30 tabular-nums">
        {mins}:{secs.toString().padStart(2, "0")}
      </span>
    </div>
  );
}
