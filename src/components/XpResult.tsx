"use client";

import { useEffect, useRef, useState } from "react";
import { submitResult, getLeaderboard, getPlayerXp } from "@/lib/genlayer";

interface XpResultProps {
  myAddress: string;
  rivalAddress: string;
  myScore: number;
  rivalScore: number;
  pvpResult: "WIN" | "LOSE";
  duration: number;
  onViewLeaderboard?: () => void;
  onClose: () => void;
}

interface LeaderboardEntry {
  address: string;
  xp: number;
}

type Status = "idle" | "submitting" | "done" | "error" | "already_played" | "rejected";

const PHASES = [
  "Transmitting to GenLayer...",
  "AI Validators analyzing match data...",
  "Cross-referencing player performance...",
  "Reaching consensus across validators...",
  "Finalizing XP allocation...",
];

function WaitingAnimation() {
  const [elapsed, setElapsed] = useState(0);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; delay: number }[]>([]);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const p = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 3,
    }));
    setParticles(p);
  }, []);

  const phase = elapsed < 5 ? 0 : elapsed < 15 ? 1 : elapsed < 30 ? 2 : elapsed < 50 ? 3 : 4;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <div className="flex flex-col items-center gap-6 py-6 relative">
      {/* Floating particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-1 h-1 rounded-full animate-float-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: p.id % 3 === 0 ? "#00f0ff" : p.id % 3 === 1 ? "#7000ff" : "#00ff66",
            animationDelay: `${p.delay}s`,
            opacity: 0.4,
          }}
        />
      ))}

      {/* Main orb */}
      <div className="relative w-24 h-24">
        {/* Outer pulse ring */}
        <div className="absolute inset-0 rounded-full border border-[#00f0ff]/20 animate-ping-slow" />
        <div className="absolute -inset-2 rounded-full border border-[#7000ff]/10 animate-ping-slower" />

        {/* Rotating rings */}
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#00f0ff] border-r-[#00f0ff]/30 animate-spin" style={{ animationDuration: "2s" }} />
        <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-[#7000ff] border-l-[#7000ff]/30 animate-spin" style={{ animationDirection: "reverse", animationDuration: "2.5s" }} />
        <div className="absolute inset-4 rounded-full border border-transparent border-t-[#00ff66]/50 animate-spin" style={{ animationDuration: "1.5s" }} />

        {/* Center core */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <div className="absolute -inset-2 bg-[#00f0ff]/20 rounded-full blur-md animate-pulse" />
            <div className="w-4 h-4 bg-[#00f0ff] rounded-full shadow-[0_0_20px_#00f0ff,0_0_40px_#00f0ff40]" />
          </div>
        </div>

        {/* Orbiting dots */}
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: "3s" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#00f0ff] rounded-full shadow-[0_0_8px_#00f0ff]" />
        </div>
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: "4s", animationDirection: "reverse" }}>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#7000ff] rounded-full shadow-[0_0_8px_#7000ff]" />
        </div>
      </div>

      {/* Phase text */}
      <span className="text-sm font-mono text-[#00f0ff] tracking-wider animate-pulse font-bold">
        {PHASES[phase]}
      </span>

      {/* Scanning line */}
      <div className="absolute inset-x-0 top-0 h-full overflow-hidden pointer-events-none rounded-xl">
        <div className="absolute inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#00f0ff]/30 to-transparent animate-scan-vertical" />
      </div>
    </div>
  );
}

export default function XpResult({
  myAddress,
  rivalAddress,
  myScore,
  rivalScore,
  pvpResult,
  duration,
  onViewLeaderboard,
  onClose,
}: XpResultProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [xpEarned, setXpEarned] = useState<number>(0);
  const [totalXp, setTotalXp] = useState<number>(0);
  const [reason, setReason] = useState<string>("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [animatedXp, setAnimatedXp] = useState(0);
  const submittedRef = useRef(false);

  // ── WINNER: submit tx to GenLayer ──
  useEffect(() => {
    if (pvpResult !== "WIN" || !myAddress) return;
    if (!rivalAddress) {
      console.warn("[XpResult] No rival address — cannot submit");
      setStatus("error");
      return;
    }
    if (duration < 60) return;
    if (submittedRef.current) return;
    submittedRef.current = true;

    setStatus("submitting");

    submitResult(myAddress, myAddress, rivalAddress, myScore, rivalScore, duration)
      .then(async (data) => {
        setXpEarned(data.xp_winner);
        setReason(data.reason);
        const [lb, xp] = await Promise.all([getLeaderboard(), getPlayerXp(myAddress)]);
        setLeaderboard(lb);
        setTotalXp(xp);
        setStatus("done");
      })
      .catch((err: Error) => {
        console.error("[XpResult] submitResult error:", err);
        if (err?.message?.includes("already played")) {
          getPlayerXp(myAddress).then(setTotalXp).catch(() => {});
          setStatus("already_played");
        } else if (err?.message?.includes("rejected")) {
          setStatus("rejected");
        } else {
          setStatus("error");
        }
      });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Animate XP counter when done
  useEffect(() => {
    if (status !== "done" || xpEarned === 0) return;
    let frame = 0;
    const total = xpEarned;
    const steps = 40;
    const id = setInterval(() => {
      frame++;
      setAnimatedXp(Math.min(Math.round((frame / steps) * total), total));
      if (frame >= steps) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [status, xpEarned]);

  if (duration < 60 && status === "idle") return null;

  const medals = ["👑", "⚡", "🔥"];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-modal-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-lg" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a1a] shadow-[0_0_80px_rgba(0,240,255,0.1),0_0_160px_rgba(112,0,255,0.05)] animate-modal-card">

        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#00f0ff]/10 rounded-full blur-[100px]" />
          <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-[#7000ff]/10 rounded-full blur-[100px]" />
          {status === "done" && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#00ff66]/5 rounded-full blur-[120px] animate-pulse" />
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1L13 13M13 1L1 13" />
          </svg>
        </button>

        {/* Header */}
        <div className="relative z-10 px-6 pt-6 pb-4 border-b border-white/5">
          <div className="flex items-center justify-center gap-3">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#00f0ff]/30" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff] animate-pulse" />
              <span className="text-[10px] font-mono tracking-[0.5em] text-white/50 uppercase">
                GenLayer Protocol
              </span>
              <div className="w-2 h-2 rounded-full bg-[#7000ff] shadow-[0_0_8px_#7000ff] animate-pulse" />
            </div>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#7000ff]/30" />
          </div>
          <h2 className="text-center text-lg font-black text-white tracking-[0.2em] uppercase mt-2">
            XP Distribution
          </h2>
        </div>

        {/* Content */}
        <div className="relative z-10 p-6">

          {/* ═══ SUBMITTING ═══ */}
          {status === "submitting" && (
            <WaitingAnimation />
          )}

          {/* ═══ ALREADY PLAYED ═══ */}
          {status === "already_played" && (
            <div className="flex flex-col items-center gap-5 py-4">
              {/* Lock icon */}
              <div className="relative">
                <div className="absolute -inset-4 bg-[#ff9900]/10 rounded-full blur-xl animate-pulse" />
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#ff9900]/20 to-[#ff9900]/5 border-2 border-[#ff9900]/40 flex items-center justify-center shadow-[0_0_30px_rgba(255,153,0,0.15)]">
                  <span className="text-3xl">🔒</span>
                </div>
              </div>

              <div className="text-center space-y-2">
                <div className="text-xl font-black text-[#ff9900] tracking-wider uppercase">
                  You Already Played This Week
                </div>
                <div className="text-sm font-mono text-white/50">
                  Your score is <span className="text-white font-bold">{myScore}</span>
                </div>
                {totalXp > 0 && (
                  <div className="text-sm font-mono text-white/40">
                    Total XP: <span className="text-[#00f0ff] font-bold">{totalXp}</span>
                  </div>
                )}
              </div>

              <div className="w-full px-4 py-3 rounded-xl bg-[#ff9900]/5 border border-[#ff9900]/20 text-center">
                <span className="text-[11px] font-mono text-[#ff9900]/70 tracking-wider">
                  XP locked until next week&apos;s challenge
                </span>
              </div>
            </div>
          )}

          {/* ═══ REJECTED ═══ */}
          {status === "rejected" && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="relative">
                <div className="absolute -inset-4 bg-[#ff9900]/10 rounded-full blur-xl animate-pulse" />
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#ff9900]/20 to-[#ff9900]/5 border-2 border-[#ff9900]/40 flex items-center justify-center shadow-[0_0_30px_rgba(255,153,0,0.15)]">
                  <span className="text-3xl">⚠</span>
                </div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-xl font-black text-[#ff9900] tracking-wider uppercase">
                  Result Rejected
                </div>
                <div className="text-sm font-mono text-white/40">
                  AI validators found this match invalid
                </div>
              </div>
            </div>
          )}

          {/* ═══ ERROR ═══ */}
          {status === "error" && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="relative">
                <div className="absolute -inset-4 bg-[#ff003c]/10 rounded-full blur-xl animate-pulse" />
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#ff003c]/20 to-[#ff003c]/5 border-2 border-[#ff003c]/40 flex items-center justify-center shadow-[0_0_30px_rgba(255,0,60,0.15)]">
                  <span className="text-3xl font-black text-[#ff003c]">✕</span>
                </div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-xl font-black text-[#ff003c] tracking-wider uppercase">
                  Submission Failed
                </div>
                <div className="text-sm font-mono text-white/40">
                  Could not submit to GenLayer — try again later
                </div>
              </div>
            </div>
          )}

          {/* ═══ DONE — XP RECEIVED ═══ */}
          {status === "done" && (
            <div className="flex flex-col items-center gap-5 py-2">
              {/* XP Badge */}
              <div className="relative">
                <div className="absolute -inset-8 bg-[#00ff66]/10 rounded-full blur-[40px] animate-pulse" />
                <div className="relative flex flex-col items-center gap-1 px-8 py-4 rounded-2xl bg-gradient-to-b from-[#00ff66]/10 to-transparent border border-[#00ff66]/20">
                  <span className="text-6xl font-black text-[#00ff66] drop-shadow-[0_0_30px_rgba(0,255,102,0.5)] tabular-nums">
                    +{animatedXp}
                  </span>
                  <span className="text-[10px] font-mono text-[#00ff66]/60 tracking-[0.5em] uppercase">
                    XP Earned
                  </span>
                </div>
              </div>

              {/* Total XP */}
              {totalXp > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-[10px] font-mono text-white/40 tracking-wider uppercase">Total XP:</span>
                  <span className="text-sm font-black text-[#00f0ff]">{totalXp}</span>
                </div>
              )}

              {/* AI Verdict */}
              {reason && (
                <div className="w-full px-4 py-3 rounded-xl bg-[#00f0ff]/5 border border-[#00f0ff]/10">
                  <div className="text-[9px] font-mono text-[#00f0ff]/40 tracking-widest uppercase mb-1 text-center">
                    AI Verdict
                  </div>
                  <div className="text-xs font-mono text-white/50 text-center italic">
                    &quot;{reason}&quot;
                  </div>
                </div>
              )}

              {/* Match score */}
              <div className="w-full flex items-center justify-center gap-4 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-center">
                  <div className="text-[8px] font-mono text-white/30 tracking-widest uppercase">You</div>
                  <div className="text-lg font-black text-white">{myScore}</div>
                </div>
                <div className="text-xs font-mono text-white/20 italic">vs</div>
                <div className="text-center">
                  <div className="text-[8px] font-mono text-white/30 tracking-widest uppercase">Rival</div>
                  <div className="text-lg font-black text-white/50">{rivalScore}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer close button */}
        {status !== "submitting" && (
          <div className="relative z-10 px-6 pb-6">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-sm font-black text-white/60 hover:text-white tracking-[0.2em] uppercase"
            >
              Close
            </button>
            {status === "done" && onViewLeaderboard && (
              <button
                onClick={onViewLeaderboard}
                className="w-full mt-2 py-3 rounded-xl bg-[#00f0ff]/10 border border-[#00f0ff]/20 hover:bg-[#00f0ff]/20 hover:border-[#00f0ff]/40 transition-all text-[10px] font-black text-[#00f0ff] tracking-[0.3em] uppercase flex items-center justify-center gap-2 group"
              >
                <span>🌐</span> VIEW_GLOBAL_LEADERBOARD
                <span className="w-1.5 h-1.5 bg-[#00f0ff] rounded-full animate-pulse group-hover:scale-125 transition-transform" />
              </button>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes modal-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes modal-card {
          0% { opacity: 0; transform: scale(0.9) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
          50% { transform: translateY(-20px) scale(1.5); opacity: 0.8; }
        }
        @keyframes ping-slow {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes ping-slower {
          0% { transform: scale(1); opacity: 0.3; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes scan-vertical {
          0% { top: -10%; }
          100% { top: 110%; }
        }
        .animate-modal-in { animation: modal-in 0.3s ease-out; }
        .animate-modal-card { animation: modal-card 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-float-particle { animation: float-particle 3s ease-in-out infinite; }
        .animate-ping-slow { animation: ping-slow 2s ease-out infinite; }
        .animate-ping-slower { animation: ping-slower 3s ease-out infinite; }
        .animate-scan-vertical { animation: scan-vertical 3s linear infinite; }
      `}</style>
    </div>
  );
}
