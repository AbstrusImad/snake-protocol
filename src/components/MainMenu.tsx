"use client";

import React from "react";
import { SoundManager } from "../game/SoundManager";

interface MainMenuProps {
  onStartSolo: () => void;
  onStartBot: () => void;
  onStartPvp: () => void;
  onLeaderboard: () => void;
}

export default function MainMenu({ onStartSolo, onStartBot, onStartPvp, onLeaderboard }: MainMenuProps) {
  const [dissolving, setDissolving] = React.useState<string | null>(null);
  const [showPvpInfo, setShowPvpInfo] = React.useState(false);

  const handleAction = (type: 'SOLO' | 'BOT' | 'PVP' | 'LEADERBOARD', action: () => void, sound?: () => void) => {
    sound?.();
    setDissolving(type);
    setTimeout(action, 400); // Wait for animation
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050510] overflow-hidden rounded-2xl border-[6px] border-white/5">
      {/* Fondo Decorativo: Bits cayendo sutilmente */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[1px] h-full bg-gradient-to-b from-transparent via-[#00f0ff] to-transparent animate-drop-slow"></div>
        <div className="absolute top-0 left-1/2 w-[1px] h-full bg-gradient-to-b from-transparent via-[#7000ff] to-transparent animate-drop-fast"></div>
        <div className="absolute top-0 left-3/4 w-[1px] h-full bg-gradient-to-b from-transparent via-[#ff003c] to-transparent animate-drop-mid"></div>
      </div>

      {/* Content wrapper - shrinks to fit */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full py-4 px-4 my-auto">
        {/* Título Principal con Glitch */}
        <div className="relative mb-6 flex flex-col items-center">
          <div className="absolute -inset-4 bg-[#00f0ff]/10 blur-3xl rounded-full animate-pulse"></div>
          <h1 className="font-black text-white tracking-tighter leading-none relative z-10 drop-shadow-[0_0_30px_rgba(0,240,255,0.4)] animate-glitch-title text-center">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00f0ff] via-[#7000ff] to-[#ff003c] animate-gradient-x" style={{ fontSize: 'clamp(1.5rem, 5vw, 4.5rem)' }}>
              SNAKE_PROTOCOL
            </span>
          </h1>
          <div className="mt-3 px-4 py-1 bg-white/5 border border-white/10 rounded-sm backdrop-blur-sm">
            <span className="text-[9px] sm:text-[11px] text-[#00f0ff] font-mono tracking-[0.5em] sm:tracking-[0.8em] uppercase animate-pulse">Status: Firewall_Breached</span>
          </div>
        </div>

        {/* Botones de Selección de Modo */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-3xl px-4">
          {/* MODO SOLO */}
          <button
            disabled={!!dissolving}
            onClick={() => handleAction('SOLO', onStartSolo, SoundManager.clickSolo)}
            className={`group relative w-full py-8 bg-[#00f0ff]/5 backdrop-blur-md overflow-hidden transition-all hover:scale-105 active:scale-95 border border-[#00f0ff]/30 hover:border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.1)] ${dissolving === 'SOLO' ? 'animate-pixel-dissolve pointer-events-none' : ''}`}
          >
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#00f0ff]"></div>
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#00f0ff]"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00f0ff]/5 to-transparent -translate-x-full group-hover:animate-shine"></div>
            <span className="relative z-10 text-lg sm:text-2xl font-black text-white tracking-[0.3em] uppercase group-hover:text-[#00f0ff] transition-colors">SOLO</span>
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-[#00f0ff]/50 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
          </button>

          {/* MODO BOT */}
          <button
            disabled={!!dissolving}
            onClick={() => handleAction('BOT', onStartBot, SoundManager.clickBot)}
            className={`group relative w-full py-8 bg-[#7000ff]/5 backdrop-blur-md overflow-hidden transition-all hover:scale-105 active:scale-95 border border-[#7000ff]/30 hover:border-[#7000ff] shadow-[0_0_15px_rgba(112,0,255,0.1)] ${dissolving === 'BOT' ? 'animate-pixel-dissolve pointer-events-none' : ''}`}
          >
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#7000ff]"></div>
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#7000ff]"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#7000ff]/5 to-transparent -translate-x-full group-hover:animate-shine"></div>
            <span className="relative z-10 text-lg sm:text-2xl font-black text-white tracking-[0.3em] uppercase group-hover:text-[#7000ff] transition-colors">PVB</span>
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-[#7000ff]/50 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
          </button>

          {/* MODO PVP */}
          <button
            disabled={!!dissolving}
            onClick={() => { SoundManager.clickPvp(); setDissolving('PVP'); setTimeout(() => setShowPvpInfo(true), 400); }}
            className={`group relative w-full py-8 bg-[#ff003c]/5 backdrop-blur-md overflow-hidden transition-all hover:scale-105 active:scale-95 border border-[#ff003c]/30 hover:border-[#ff003c] shadow-[0_0_15px_rgba(255,0,60,0.1)] ${dissolving === 'PVP' ? 'animate-pixel-dissolve pointer-events-none' : ''}`}
          >
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#ff003c]"></div>
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#ff003c]"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#ff003c]/5 to-transparent -translate-x-full group-hover:animate-shine"></div>
            <div className="relative z-10 flex flex-col items-center gap-1">
              <span className="text-lg sm:text-2xl font-black text-white tracking-[0.3em] uppercase group-hover:text-[#ff003c] transition-colors">Weekly PVP</span>
              <span className="text-[9px] font-mono text-[#ff9900] tracking-[0.3em] uppercase group-hover:text-[#ffb833] transition-colors">Challenge</span>
            </div>
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-[#ff003c]/50 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
            <div className="absolute -top-1 -right-1 px-2 py-0.5 bg-[#ff003c] text-white text-[8px] font-black uppercase rotate-12 group-hover:rotate-0 transition-transform">Alpha</div>
          </button>

          {/* LEADERBOARD */}
          <button
            disabled={!!dissolving}
            onClick={() => handleAction('LEADERBOARD', onLeaderboard, SoundManager.clickLeaderboard)}
            className={`group relative w-full py-8 bg-[#00ff66]/5 backdrop-blur-md overflow-hidden transition-all hover:scale-105 active:scale-95 border border-[#00ff66]/30 hover:border-[#00ff66] shadow-[0_0_15px_rgba(0,255,102,0.1)] ${dissolving === 'LEADERBOARD' ? 'animate-pixel-dissolve pointer-events-none' : dissolving ? 'pointer-events-none' : ''}`}
          >
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#00ff66]"></div>
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#00ff66]"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00ff66]/5 to-transparent -translate-x-full group-hover:animate-shine"></div>
            <span className="relative z-10 text-lg sm:text-2xl font-black text-white tracking-[0.3em] uppercase group-hover:text-[#00ff66] transition-colors">LEADER BOARD</span>
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-[#00ff66]/50 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
          </button>
        </div>
      </div>

      {/* WEEKLY PVP INFO MODAL — full game-area screen, same as other phases */}
      {showPvpInfo && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-[#050510] overflow-hidden rounded-2xl border-[6px] border-white/5 animate-modal-fade">
          {/* Background lines */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-[1px] h-full bg-gradient-to-b from-transparent via-[#ff003c] to-transparent animate-drop-slow" />
            <div className="absolute top-0 left-1/2 w-[1px] h-full bg-gradient-to-b from-transparent via-[#7000ff] to-transparent animate-drop-fast" />
            <div className="absolute top-0 left-3/4 w-[1px] h-full bg-gradient-to-b from-transparent via-[#ff003c] to-transparent animate-drop-mid" />
          </div>
          {/* Horizontal scan line */}
          <div className="absolute inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#ff003c]/30 to-transparent animate-modal-scan pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center justify-between w-full h-full py-6 px-4">

            {/* Title */}
            <div className="relative flex flex-col items-center">
              <div className="absolute -inset-4 bg-[#ff003c]/10 blur-3xl rounded-full animate-pulse" />
              <div className="text-[9px] font-mono text-[#ff003c]/60 tracking-[0.8em] uppercase mb-1 animate-pulse relative z-10">// PROTOCOL_INFO</div>
              <h1 className="font-black text-white tracking-tighter leading-none relative z-10 drop-shadow-[0_0_30px_rgba(255,0,60,0.4)]" style={{ fontSize: 'clamp(1.4rem, 4vw, 2.8rem)' }}>
                WEEKLY_<span className="text-[#ff003c]">PVP</span>
              </h1>
              <div className="mt-2 px-4 py-1 bg-white/5 border border-[#ff9900]/30">
                <span className="text-[9px] font-mono text-[#ff9900] tracking-[0.5em] uppercase animate-pulse">Challenge Mode Active</span>
              </div>
            </div>

            {/* Rules */}
            <div className="w-full max-w-md flex flex-col gap-1.5">
              {[
                { tag: "REQ_01", col: "#00ff66", label: "Win a 1v1 real-time match", sub: "P2P WebRTC — no server in the middle" },
                { tag: "REQ_02", col: "#ff9900", label: "Match must last 60+ seconds", sub: "Short matches do not count toward XP" },
                { tag: "RULE_01", col: "#ff003c", label: "Once per wallet per week", sub: "Enforced by the smart contract, not a server" },
                { tag: "RULE_02", col: "#7000ff", label: "AI validators decide the XP", sub: "GenLayer Optimistic Democracy — 5 AI nodes" },
                { tag: "INFO_01", col: "#00f0ff", label: "Global leaderboard", sub: "Top 100 ranked by XP stored in contract state" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                  <span className="text-[8px] font-mono shrink-0 w-14 text-right" style={{ color: item.col }}>{item.tag}</span>
                  <div className="w-[1px] h-5 bg-white/10 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-black text-white uppercase tracking-wider" style={{ fontSize: 'clamp(9px, 1.1vw, 11px)' }}>{item.label}</span>
                    <span className="font-mono text-white/30 tracking-wide" style={{ fontSize: 'clamp(8px, 0.9vw, 9px)' }}>{item.sub}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div className="w-full max-w-md flex flex-col gap-2">
              <button
                onClick={() => { setShowPvpInfo(false); onStartPvp(); }}
                className="group relative w-full py-6 bg-[#ff003c]/5 backdrop-blur-md overflow-hidden transition-all hover:scale-105 active:scale-95 border border-[#ff003c]/30 hover:border-[#ff003c] shadow-[0_0_15px_rgba(255,0,60,0.1)]"
              >
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#ff003c]" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#ff003c]" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#ff003c]/5 to-transparent -translate-x-full group-hover:animate-shine" />
                <span className="relative z-10 font-black text-white tracking-[0.3em] uppercase group-hover:text-[#ff003c] transition-colors" style={{ fontSize: 'clamp(0.9rem, 2vw, 1.4rem)' }}>
                  ENTER_ARENA
                </span>
                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-[#ff003c]/50 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              </button>
              <button
                onClick={() => { SoundManager.clickBack(); setShowPvpInfo(false); }}
                className="text-white/30 hover:text-white/70 text-sm font-mono tracking-widest transition-colors py-2"
              >
                ← BACK_TO_MENU
              </button>
            </div>

          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes modal-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-slide { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modal-scan { 0% { top: -10%; } 100% { top: 110%; } }
        .animate-modal-fade { animation: modal-fade 0.25s ease-out; }
        .animate-modal-slide { animation: modal-slide 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-modal-scan { animation: modal-scan 2.5s linear infinite; }
        @keyframes drop-slow { 0% { transform: translateY(-100%); opacity: 0; } 50% { opacity: 0.5; } 100% { transform: translateY(100vh); opacity: 0; } }
        @keyframes drop-fast { 0% { transform: translateY(-100%); opacity: 0; } 50% { opacity: 0.5; } 100% { transform: translateY(100vh); opacity: 0; } }
        @keyframes drop-mid { 0% { transform: translateY(-100%); opacity: 0; } 50% { opacity: 0.5; } 100% { transform: translateY(100vh); opacity: 0; } }
        @keyframes shine { 100% { transform: translateX(100%); } }
        @keyframes gradient-x { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes glitch-title { 0% { transform: skew(0deg); } 20% { transform: skew(10deg); filter: hue-rotate(90deg); } 25% { transform: skew(0deg); } 100% { transform: skew(0deg); } }
        
        @keyframes pixel-dissolve {
          0% { clip-path: inset(0 0 0 0); opacity: 1; filter: contrast(1) brightness(1); }
          20% { clip-path: polygon(0% 0%, 20% 0%, 20% 20%, 0% 20%, 40% 0%, 60% 0%, 60% 20%, 40% 20%, 80% 0%, 100% 0%, 100% 20%, 80% 20%); filter: contrast(1.5) brightness(1.2); }
          50% { clip-path: polygon(10% 20%, 30% 20%, 30% 40%, 10% 40%, 50% 20%, 70% 20%, 70% 40%, 50% 40%, 90% 20%, 10% 20%, 0% 100%, 100% 100%, 100% 0%, 0% 0%); opacity: 0.5; }
          100% { clip-path: polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%); opacity: 0; filter: contrast(3) brightness(2); }
        }

        .animate-pixel-dissolve { 
          animation: pixel-dissolve 0.4s cubic-bezier(0.4, 0, 1, 1) forwards;
          box-shadow: 0 0 50px white !important;
        }

        .animate-drop-slow { animation: drop-slow 10s linear infinite; }
        .animate-drop-mid { animation: drop-mid 7s linear infinite; }
        .animate-drop-fast { animation: drop-fast 4s linear infinite; }
        .animate-shine { animation: shine 1.2s ease-in-out infinite; }
        .animate-gradient-x { background-size: 200% 200%; animation: gradient-x 5s ease infinite; }
        .animate-glitch-title { animation: glitch-title 5s infinite step-end; }
      `}</style>
    </div>
  );
}
