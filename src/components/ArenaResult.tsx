"use client";

import { useState, useRef, useEffect } from "react";
import { submitArenaResult, getArenaPlayerXp } from "@/lib/genlayer_arena";
import { ArenaGameResult } from "../game/ArenaNetworkService";
import { ARENA_COLORS } from "./ArenaLobby";

interface ArenaResultProps {
  myIndex: number;
  myAddress: string;
  results: ArenaGameResult[];
  onClose: () => void;
}

type Status = "idle" | "submitting" | "done" | "error" | "already_played";

const POSITION_LABELS = ["1ST", "2ND", "3RD", "4TH"];
const POSITION_ICONS  = ["👑", "⚡", "🔥", "💀"];

export default function ArenaResult({ myIndex, myAddress, results, onClose }: ArenaResultProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [xpEarned, setXpEarned] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [reason, setReason] = useState("");
  const [animatedXp, setAnimatedXp] = useState(0);
  const submittedRef = useRef(false);

  const myResult = results.find((r) => r.playerIndex === myIndex);

  // XP counter animation
  useEffect(() => {
    if (status !== "done" || xpEarned === 0) return;
    let frame = 0;
    const steps = 40;
    const id = setInterval(() => {
      frame++;
      setAnimatedXp(Math.min(Math.round((frame / steps) * xpEarned), xpEarned));
      if (frame >= steps) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [status, xpEarned]);

  const handleSubmit = async () => {
    if (!myResult || !myAddress || submittedRef.current) return;
    submittedRef.current = true;
    setStatus("submitting");

    try {
      const data = await submitArenaResult(
        myAddress,
        myResult.position,
        results.find((r) => r.playerIndex === myIndex)?.score ?? 0,
        results.length,
        myResult.playerDuration,
        myResult.matchDuration,
      );
      setXpEarned(data.xp);
      setReason(data.reason);
      const xp = await getArenaPlayerXp(myAddress);
      setTotalXp(xp);
      setStatus("done");
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? "";
      if (msg.includes("already played")) {
        getArenaPlayerXp(myAddress).then(setTotalXp).catch(() => {});
        setStatus("already_played");
      } else {
        setStatus("error");
      }
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-lg" onClick={onClose} />

      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a1a] shadow-[0_0_80px_rgba(255,102,0,0.1)]">
        {/* Glow */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#ff6600]/10 rounded-full blur-[100px]" />
          <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-[#7000ff]/10 rounded-full blur-[100px]" />
        </div>

        {/* Close */}
        <button onClick={onClose}
          className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white transition-all">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1L13 13M13 1L1 13" />
          </svg>
        </button>

        {/* Header */}
        <div className="relative z-10 px-6 pt-6 pb-4 border-b border-white/5">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#ff6600]/30" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#ff6600] shadow-[0_0_8px_#ff6600] animate-pulse" />
              <span className="text-[10px] font-mono tracking-[0.5em] text-white/50 uppercase">Arena Results</span>
              <div className="w-2 h-2 rounded-full bg-[#7000ff] shadow-[0_0_8px_#7000ff] animate-pulse" />
            </div>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#7000ff]/30" />
          </div>
        </div>

        <div className="relative z-10 p-6 flex flex-col gap-4">
          {/* Final rankings */}
          <div className="flex flex-col gap-2">
            {results
              .sort((a, b) => a.position - b.position)
              .map((r) => {
                const isMe = r.playerIndex === myIndex;
                return (
                  <div key={r.playerIndex}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      isMe
                        ? "border-current bg-white/5"
                        : "border-white/5 bg-white/[0.02]"
                    }`}
                    style={{ borderColor: isMe ? ARENA_COLORS[r.playerIndex] : undefined }}>
                    <span className="text-xl w-8 text-center">{POSITION_ICONS[r.position - 1]}</span>
                    <span className="font-black text-xs tracking-widest uppercase"
                      style={{ color: ARENA_COLORS[r.playerIndex] }}>
                      {POSITION_LABELS[r.position - 1]}
                      {isMe && <span className="ml-2 text-white/40 font-normal">(YOU)</span>}
                    </span>
                    <div className="flex-1" />
                    <span className="font-black text-white text-sm">{r.score} pts</span>
                    <span className="text-white/30 text-xs font-mono">{formatTime(r.playerDuration)}</span>
                  </div>
                );
              })}
          </div>

          {/* XP section */}
          <div className="border-t border-white/10 pt-4">
            <div className="text-[9px] font-mono text-white/40 tracking-[0.4em] uppercase mb-3 text-center">
              GenLayer // XP Distribution
            </div>

            {status === "idle" && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs font-mono text-white/40 text-center">
                  Submit your score to earn XP validated by AI
                </p>
                <button onClick={handleSubmit}
                  className="w-full py-3 font-black tracking-[0.3em] text-sm uppercase border border-[#ff6600]/40 bg-[#ff6600]/5 text-[#ff6600] hover:bg-[#ff6600]/10 hover:border-[#ff6600] transition-all rounded-xl">
                  ⚡ Submit Score for XP
                </button>
                <span className="text-[9px] font-mono text-white/20 tracking-wider">Optional — requires wallet signature</span>
              </div>
            )}

            {status === "submitting" && (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#ff6600] animate-spin" style={{ animationDuration: "2s" }} />
                  <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-[#7000ff] animate-spin" style={{ animationDirection: "reverse", animationDuration: "2.5s" }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 bg-[#ff6600] rounded-full shadow-[0_0_12px_#ff6600] animate-pulse" />
                  </div>
                </div>
                <span className="text-sm font-mono text-[#ff6600] tracking-wider animate-pulse">AI Validators analyzing...</span>
              </div>
            )}

            {status === "done" && (
              <div className="flex flex-col items-center gap-4">
                <div className="relative flex flex-col items-center gap-1 px-8 py-4 rounded-2xl bg-gradient-to-b from-[#ff6600]/10 to-transparent border border-[#ff6600]/20">
                  <span className="text-5xl font-black text-[#ff6600] drop-shadow-[0_0_20px_rgba(255,102,0,0.5)] tabular-nums">
                    +{animatedXp}
                  </span>
                  <span className="text-[10px] font-mono text-[#ff6600]/60 tracking-[0.5em] uppercase">XP Earned</span>
                </div>
                {totalXp > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                    <span className="text-[10px] font-mono text-white/40 tracking-wider uppercase">Total XP:</span>
                    <span className="text-sm font-black text-[#00f0ff]">{totalXp}</span>
                  </div>
                )}
                {reason && (
                  <div className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10">
                    <div className="text-[9px] font-mono text-white/30 tracking-widest uppercase mb-1 text-center">AI Verdict</div>
                    <div className="text-xs font-mono text-white/50 text-center italic">&quot;{reason}&quot;</div>
                  </div>
                )}
              </div>
            )}

            {status === "already_played" && (
              <div className="flex flex-col items-center gap-3 py-2">
                <span className="text-2xl">🔒</span>
                <div className="text-sm font-black text-[#ff9900] tracking-wider uppercase">Already Played</div>
                {totalXp > 0 && (
                  <div className="text-xs font-mono text-white/40">
                    Total XP: <span className="text-[#00f0ff] font-bold">{totalXp}</span>
                  </div>
                )}
                <div className="text-[10px] font-mono text-[#ff9900]/60 tracking-wider">XP locked until next week</div>
              </div>
            )}

            {status === "error" && (
              <div className="flex flex-col items-center gap-3 py-2">
                <span className="text-2xl">⚠</span>
                <div className="text-sm font-black text-[#ff003c] tracking-wider uppercase">Submission Failed</div>
                <button onClick={() => { submittedRef.current = false; setStatus("idle"); }}
                  className="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors tracking-wider">
                  Try again
                </button>
              </div>
            )}
          </div>

          {/* Close button */}
          {status !== "submitting" && (
            <button onClick={onClose}
              className="w-full py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm font-black text-white/60 hover:text-white tracking-[0.2em] uppercase">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
