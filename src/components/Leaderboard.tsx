"use client";

import { useState, useEffect } from "react";
import { getLeaderboard } from "@/lib/genlayer";

interface LeaderboardProps {
  myAddress?: string;
  onBack: () => void;
}

interface Entry {
  address: string;
  xp: number;
}

export default function Leaderboard({ myAddress, onBack }: LeaderboardProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard()
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  const medals = ["👑", "⚡", "🔥"];

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050510] overflow-hidden rounded-2xl border-[6px] border-white/5">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[1px] h-full bg-gradient-to-b from-transparent via-[#00f0ff] to-transparent" />
        <div className="absolute top-0 left-2/3 w-[1px] h-full bg-gradient-to-b from-transparent via-[#7000ff] to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-md px-6 py-4">
        {/* Title */}
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-black text-white tracking-[0.2em] uppercase drop-shadow-[0_0_20px_rgba(0,240,255,0.3)]">
            LEADER<span className="text-[#00f0ff]">BOARD</span>
          </h2>
          <div className="text-[9px] font-mono text-white/30 tracking-[0.5em] uppercase mt-1">
            GenLayer // Global Ranking
          </div>
        </div>

        {/* List */}
        <div className="w-full flex flex-col gap-1.5 mb-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar transition-all duration-300">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 border-2 border-[#00f0ff]/20 rounded-full animate-ping" />
                <div className="absolute inset-2 border-2 border-t-[#00f0ff] border-transparent rounded-full animate-spin" />
              </div>
              <span className="text-[10px] font-mono text-[#00f0ff]/40 tracking-[0.5em] animate-pulse">SYNCHRONIZING_RANKS...</span>
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
              <span className="text-4xl mb-4">🕳️</span>
              <span className="text-[10px] font-mono tracking-[0.3em] uppercase">No_Ranked_Data_Found</span>
            </div>
          )}

          {!loading && entries.map((entry, i) => {
            const isMe = myAddress && entry.address.toLowerCase() === myAddress.toLowerCase();
            const rank = i + 1;
            const isTop3 = rank <= 3;

            return (
              <div
                key={entry.address}
                className={`group flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-300 relative overflow-hidden ${
                  isMe
                    ? "bg-[#00f0ff]/10 border-[#00f0ff]/40 shadow-[0_0_25px_rgba(0,240,255,0.05)] scale-[1.02] z-10"
                    : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/20"
                }`}
              >
                {/* Me indicator glow */}
                {isMe && (
                   <div className="absolute inset-0 bg-gradient-to-r from-[#00f0ff]/5 to-transparent animate-pulse pointer-events-none" />
                )}

                {/* Rank & Medals */}
                <div className="flex items-center gap-3 min-w-[60px] relative z-10">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${
                    rank === 1 ? 'bg-gradient-to-br from-yellow-300 to-yellow-600 text-black shadow-[0_0_15px_rgba(253,224,71,0.3)]' :
                    rank === 2 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-black' :
                    rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-700 text-black' :
                    isMe ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'bg-white/5 text-white/20'
                  }`}>
                    {isTop3 ? medals[rank - 1] : `#${rank}`}
                  </div>
                </div>

                {/* Player Identity */}
                <div className="flex flex-col flex-1 ml-4 relative z-10">
                  <span className={`text-xs font-mono tracking-widest ${isMe ? "text-[#00f0ff] font-black" : "text-white/70"}`}>
                    {entry.address.slice(0, 8)}...{entry.address.slice(-6)}
                  </span>
                  {isMe && (
                    <span className="text-[8px] font-black text-[#00f0ff]/60 tracking-[0.3em] uppercase mt-0.5">AUTHENTICATED_USER</span>
                  )}
                </div>

                {/* Score / XP */}
                <div className="flex flex-col items-end relative z-10">
                  <span className={`text-sm font-black tabular-nums tracking-tighter ${
                    isTop3 ? "text-[#00ff66] drop-shadow-[0_0_10px_#00ff6650]" : "text-white/80"
                  }`}>
                    {entry.xp.toLocaleString()}
                  </span>
                  <span className="text-[7px] font-mono text-white/20 tracking-[0.2em] uppercase">EXP_UNITS</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <button
          onClick={onBack}
          className="group relative w-full overflow-hidden rounded-xl bg-white/5 transition-all active:scale-95"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#00f0ff]/0 via-[#00f0ff]/10 to-[#00f0ff]/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          <div className="relative px-8 py-4 border border-white/10 group-hover:border-[#00f0ff]/40 flex items-center justify-center gap-3 transition-colors">
            <span className="text-sm font-black text-white/40 tracking-[0.4em] uppercase group-hover:text-white transition-colors">
              TERMINATE_VIEW
            </span>
            <div className="w-1.5 h-1.5 bg-white/20 rounded-full group-hover:bg-[#00f0ff] animate-pulse" />
          </div>
        </button>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 240, 255, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 240, 255, 0.5);
        }
      `}</style>
    </div>
  );
}
