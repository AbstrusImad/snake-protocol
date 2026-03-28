"use client";

import dynamic from "next/dynamic";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";

// Desactivamos SSR porque React Three Fiber usa WebGL
const GameWrapper = dynamic(() => import("../components/GameWrapper"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050510] gap-4">
      <div className="w-16 h-16 border-4 border-[#00f0ff] border-t-transparent rounded-full animate-spin shadow-[0_0_30px_#00f0ff]"></div>
      <p className="text-[#00f0ff] font-mono text-sm tracking-[0.3em] uppercase animate-pulse">
        Inicializando Motor GenLayer...
      </p>
    </div>
  ),
});

function LandingPage() {
  const { openConnectModal } = useConnectModal();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 80);
    return () => clearInterval(id);
  }, []);

  const glitchChars = "!@#$%^&*<>?/\\|{}[]";
  const glitch = (text: string) =>
    tick % 20 < 2
      ? text.split("").map((c, i) =>
          i === tick % text.length ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : c
        ).join("")
      : text;

  return (
    <div className="w-full h-screen bg-[#050510] text-[#e0e0ff] overflow-hidden font-sans select-none flex flex-col items-center justify-center relative">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#0a0a2a]/60 via-[#050510]/80 to-[#050510]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.02]" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 2px, #fff 4px)" }} />
      {/* Ambient glows */}
      <div className="pointer-events-none fixed top-1/4 left-1/4 w-[500px] h-[500px] bg-[#7000ff]/10 rounded-full blur-[150px]" />
      <div className="pointer-events-none fixed bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#00f0ff]/8 rounded-full blur-[150px]" />

      {/* Corner decorations */}
      <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-[#00f0ff]/50" />
      <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-[#00f0ff]/50" />
      <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-[#7000ff]/50" />
      <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-[#7000ff]/50" />

      {/* Top status bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#00f0ff]/10 border border-[#00f0ff]/20 px-3 py-1 rounded-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66] animate-pulse shadow-[0_0_6px_#00ff66]" />
        <span className="font-mono text-[9px] text-[#00f0ff] tracking-[0.4em] uppercase">AI Node: Online • Ping: 14ms</span>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-5xl sm:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] via-white to-[#7000ff] drop-shadow-[0_0_30px_rgba(0,240,255,0.3)]">
            {glitch("GENLAYER")}<span className="text-white/60 font-light">//SNAKE</span>
          </h1>
          <div className="flex items-center gap-2">
            <div className="h-[1px] w-16 bg-gradient-to-r from-transparent to-[#00f0ff]/50" />
            <span className="font-mono text-[10px] text-[#00f0ff]/60 tracking-[0.6em] uppercase">Snake_Protocol</span>
            <div className="h-[1px] w-16 bg-gradient-to-l from-transparent to-[#7000ff]/50" />
          </div>
        </div>

        {/* Description */}
        <div className="max-w-md flex flex-col gap-3">
          <p className="font-mono text-sm text-white/50 leading-relaxed tracking-wide">
            Compete in real-time PvP matches. Earn XP validated by<br />
            <span className="text-[#00f0ff]">GenLayer AI Validators</span> via Optimistic Democracy.
          </p>
          <div className="flex items-center justify-center gap-6 text-[10px] font-mono text-white/30 tracking-widest uppercase">
            <span className="flex items-center gap-1"><span className="text-[#00ff66]">▸</span> Multiplayer</span>
            <span className="flex items-center gap-1"><span className="text-[#7000ff]">▸</span> AI Validated</span>
            <span className="flex items-center gap-1"><span className="text-[#00f0ff]">▸</span> On-Chain XP</span>
          </div>
        </div>

        {/* Connect button */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={openConnectModal}
            className="group relative px-10 py-4 font-black tracking-[0.3em] text-sm uppercase overflow-hidden rounded-xl border border-[#00f0ff]/40 bg-[#00f0ff]/5 text-[#00f0ff] hover:bg-[#00f0ff]/10 hover:border-[#00f0ff]/80 hover:shadow-[0_0_40px_rgba(0,240,255,0.2)] transition-all duration-300"
          >
            <span className="relative z-10 flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/>
                <path d="M16 12h.01"/>
                <path d="M2 10h20"/>
              </svg>
              Connect Wallet
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-[#00f0ff]/0 via-[#00f0ff]/5 to-[#00f0ff]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          </button>
          <span className="text-[9px] font-mono text-white/20 tracking-wider uppercase">Wallet required to play</span>
        </div>
      </div>

      {/* Bottom footer */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <div className="flex items-center gap-4 text-[10px] font-mono tracking-[0.2em]">
          <a href="https://x.com/iAbstrus" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors uppercase">
            <span className="text-white/30">Made by</span><span className="text-[#00f0ff]/80 font-bold">iAbstrus</span>
          </a>
          <span className="text-white/20">•</span>
          <a href="https://x.com/GenLayer" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors uppercase">
            <span className="text-white/30">Powered by</span><span className="text-[#7000ff]/90 font-bold">GenLayer</span>
          </a>
        </div>
        <span className="text-[8px] font-mono text-white/20 tracking-[0.3em] uppercase">Beta v0.9.1</span>
      </div>

      <style jsx>{`
        @keyframes scan { 0% { top: -10%; } 100% { top: 110%; } }
      `}</style>
    </div>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { isConnected } = useAccount();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (!isConnected) return <LandingPage />;

  return (
    <main className="w-full h-screen bg-[#050510] text-[#e0e0ff] overflow-hidden font-sans select-none flex flex-col p-4 sm:p-6 relative">
      
      {/* EFECTOS DE PANTALLA TIPO TERMINAL */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-[#050510]/40 to-[#050510]/90"></div>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.02]" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 2px, #fff 4px)" }}></div>

      {/* HEADER: Navegación y Billetera */}
      <header className="flex justify-between items-start w-full relative z-10 shrink-0 mb-4 sm:mb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] to-[#7000ff] drop-shadow-[0_0_15px_rgba(0,240,255,0.4)]">
            GENLAYER<span className="text-white font-light">//SNAKE</span>
          </h1>
          <div className="flex items-center gap-3 bg-[#00f0ff]/10 border border-[#00f0ff]/30 px-2 sm:px-3 py-1 rounded-sm w-fit">
            <span className="w-2 h-2 rounded-full bg-[#00ff66] animate-pulse shadow-[0_0_8px_#00ff66]"></span>
            <span className="font-mono text-[8px] sm:text-[10px] text-[#00f0ff] tracking-widest uppercase shadow-sm">
              AI Node: Online • Ping: 14ms
            </span>
          </div>
        </div>

        <div className="scale-75 sm:scale-90 origin-top-right">
          <ConnectButton 
            chainStatus="icon" 
            showBalance={false} 
            accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
          />
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL: HUD LATERALES Y TABLERO CENTRAL */}
      <div className="flex-1 flex w-full relative z-10 gap-4 sm:gap-6 min-h-0">
        
        {/* HUD Izquierdo */}
        <aside className="w-[240px] hidden xl:flex flex-col justify-end gap-2 text-left pb-4">
          <div className="border-l-2 border-[#7000ff] pl-3 flex flex-col gap-1 opacity-70">
            <span className="font-mono text-[9px] text-[#7000ff] uppercase tracking-widest">
              System Registry //
            </span>
            <p className="font-mono text-xs text-[#a0a0ff]">
              &gt; Initializing matrix geometry... <br/>
              &gt; Routing Smart Contract... <br/>
              &gt; <span className="text-[#00ff66]">Connection established.</span>
            </p>
          </div>
        </aside>

        {/* CONTENEDOR CENTRAL DEL JUEGO (Flexible y Responsive) */}
        <div className="flex-1 flex items-center justify-center w-full px-2 sm:px-4 lg:px-8 py-2 sm:py-4 min-h-0">
          <div className="w-full max-w-[1000px] aspect-[5/3] mx-auto bg-black border border-[#00f0ff]/20 shadow-[0_0_50px_rgba(112,0,255,0.15)] rounded-xl sm:rounded-2xl relative group">
            {/* Adornos del marco del juego */}
            <div className="absolute top-0 left-0 w-6 h-6 sm:w-8 sm:h-8 border-t-2 border-l-2 border-[#00f0ff] opacity-50 z-20 pointer-events-none rounded-tl-xl sm:rounded-tl-2xl"></div>
            <div className="absolute top-0 right-0 w-6 h-6 sm:w-8 sm:h-8 border-t-2 border-r-2 border-[#00f0ff] opacity-50 z-20 pointer-events-none rounded-tr-xl sm:rounded-tr-2xl"></div>
            <div className="absolute bottom-0 left-0 w-6 h-6 sm:w-8 sm:h-8 border-b-2 border-l-2 border-[#7000ff] opacity-50 z-20 pointer-events-none rounded-bl-xl sm:rounded-bl-2xl"></div>
            <div className="absolute bottom-0 right-0 w-6 h-6 sm:w-8 sm:h-8 border-b-2 border-r-2 border-[#7000ff] opacity-50 z-20 pointer-events-none rounded-br-xl sm:rounded-br-2xl"></div>
            
            {/* El propio juego encapsulado aquí */}
            <GameWrapper />
          </div>
        </div>

        {/* HUD Derecho */}
        <aside className="w-[240px] hidden xl:flex flex-col justify-end items-end gap-2 text-right pb-4">
          <div className="border-r-2 border-[#00f0ff] pr-3 flex flex-col gap-1 opacity-70 text-right">
            <span className="font-mono text-[9px] text-[#00f0ff] uppercase tracking-widest">
              Entity Status //
            </span>
            <p className="font-mono text-xs text-[#a0a0ff]">
              Sector: Alpha-9 <br/>
              Integrity: 100% <br/>
              Threat Level: <span className="text-[#ff003c] animate-pulse">ELEVATED</span>
            </p>
          </div>
        </aside>

      </div>

      {/* FOOTER: Controles e Instrucciones */}
      <footer className="flex justify-between items-center w-full pt-4 sm:pt-6 relative z-10 shrink-0">
        <div className="bg-[#050510]/80 backdrop-blur-md border border-[#ffffff]/10 px-3 sm:px-4 py-2 rounded-lg flex gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <kbd className="bg-white/10 border-b-2 border-white/20 px-2 py-1 rounded text-[10px] sm:text-xs font-mono font-bold text-white shadow-sm">W A S D</kbd>
            <span className="text-[10px] sm:text-xs font-mono text-white/50 uppercase tracking-wider">Navigate</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono tracking-[0.2em]">
          <a href="https://x.com/iAbstrus" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:opacity-100 opacity-70 transition-opacity uppercase">
            <span className="text-white/40">Made by</span><span className="text-[#00f0ff]/90 font-bold">iAbstrus</span>
          </a>
          <span className="text-white/20">•</span>
          <a href="https://x.com/GenLayer" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:opacity-100 opacity-70 transition-opacity uppercase">
            <span className="text-white/40">Powered by</span><span className="text-[#7000ff]/90 font-bold">GenLayer</span>
          </a>
        </div>

        <div className="flex items-center gap-4 text-[10px] sm:text-xs font-mono text-white/30 uppercase tracking-[0.2em] opacity-80">
          <span>Beta v0.9.1</span>
        </div>
      </footer>

    </main>
  );
}
