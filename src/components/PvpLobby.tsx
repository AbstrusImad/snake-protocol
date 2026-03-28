"use client";

import React, { useState, useRef, useEffect } from "react";
import { NetworkService } from "../game/NetworkService";
import RoomsList from "./RoomsList";

interface PvpLobbyProps {
  onGameReady: (network: NetworkService) => void;
  onBack: () => void;
}

export default function PvpLobby({ onGameReady, onBack }: PvpLobbyProps) {
  const [mode, setMode] = useState<"SELECT" | "HOSTING" | "JOINING" | "BROWSING">("SELECT");
  const roomCodeRef = useRef("");
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [status, setStatus] = useState("Waiting...");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const networkRef = useRef<NetworkService | null>(null);
  const gameStartedRef = useRef(false);

  useEffect(() => {
    return () => {
      // Only destroy if game hasn't started (user clicked BACK)
      if (!gameStartedRef.current) {
        networkRef.current?.destroy();
      }
    };
  }, []);

  const handleCreateRoom = async () => {
    setMode("HOSTING");
    setStatus("Initializing P2P node...");
    setError("");

    const net = new NetworkService();
    networkRef.current = net;

    net.onConnected(() => {
      setStatus("PEER_CONNECTED ✓");
      setTimeout(() => {
        gameStartedRef.current = true;
        onGameReady(net);
      }, 800);
    });

    net.onDisconnected(() => {
      setStatus("Connection lost.");
    });

    try {
      const id = await net.createRoom();
      roomCodeRef.current = id;
      setRoomCode(id);
      await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setStatus("Waiting for opponent to connect...");
    } catch (err: unknown) {
      setError(`Failed to create room: ${err}`);
      setMode("SELECT");
    }
  };

  const handleJoinRoom = async (codeOverride?: string) => {
    const code = codeOverride ?? inputCode.trim().toUpperCase();
    if (!code) return;
    setMode("JOINING");
    setStatus("Connecting to host...");
    setError("");

    const net = new NetworkService();
    networkRef.current = net;

    net.onConnected(() => {
      setStatus("PEER_CONNECTED ✓");
    });

    net.onDisconnected(() => {
      setStatus("Connection lost.");
    });

    try {
      await net.joinRoom(code);
      setStatus("Connected! Waiting for host to start...");
      setTimeout(() => {
        gameStartedRef.current = true;
        onGameReady(net);
      }, 800);
    } catch (err: unknown) {
      setError(`Failed to join: ${err}`);
      setMode("SELECT");
    }
  };

  const handleJoinFromList = async (code: string) => {
    await fetch(`/api/rooms/${code}`, { method: "DELETE" });
    handleJoinRoom(code);
  };

  const copyCode = () => {
    // navigator.clipboard only works on HTTPS or localhost
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(roomCode);
    } else {
      // Fallback for HTTP (e.g. LAN access via IP)
      const textArea = document.createElement("textarea");
      textArea.value = roomCode;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050510] overflow-hidden rounded-2xl border-[6px] border-white/5">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[1px] h-full bg-gradient-to-b from-transparent via-[#ff003c] to-transparent animate-pulse"></div>
        <div className="absolute top-0 left-2/3 w-[1px] h-full bg-gradient-to-b from-transparent via-[#ff003c] to-transparent animate-pulse"></div>
      </div>

      {/* Title */}
      <div className="relative mb-10">
        <h1 className="text-5xl font-black text-white tracking-tighter">
          HACK_<span className="text-[#ff003c]">ARENA</span>
        </h1>
        <div className="mt-2 text-center text-[10px] text-white/30 font-mono tracking-[0.5em] uppercase">
          WebRTC P2P • Zero Latency • Encrypted
        </div>
      </div>

      {/* SELECT MODE */}
      {mode === "SELECT" && (
        <div className="flex flex-col gap-5 w-full max-w-sm px-8">
          <button
            onClick={handleCreateRoom}
            className="group relative w-full py-5 bg-[#ff003c]/5 border border-[#ff003c]/30 hover:border-[#ff003c] transition-all hover:scale-105 active:scale-95"
          >
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#ff003c]"></div>
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#ff003c]"></div>
            <span className="text-xl font-black text-white tracking-[0.3em] uppercase group-hover:text-[#ff003c] transition-colors">
              CREATE_ROOM
            </span>
            <div className="text-[9px] text-white/40 font-mono mt-1 tracking-wider">Generate invitation code</div>
          </button>

          <button
            onClick={() => setMode("BROWSING")}
            className="group relative w-full py-5 bg-[#7000ff]/5 border border-[#7000ff]/30 hover:border-[#7000ff] transition-all hover:scale-105 active:scale-95"
          >
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#7000ff]"></div>
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#7000ff]"></div>
            <span className="text-xl font-black text-white tracking-[0.3em] uppercase group-hover:text-[#7000ff] transition-colors">
              JOIN_ROOM
            </span>
            <div className="text-[9px] text-white/40 font-mono mt-1 tracking-wider">Browse open rooms</div>
          </button>

          <button
            onClick={onBack}
            className="mt-4 text-white/30 hover:text-white/70 text-sm font-mono tracking-widest transition-colors"
          >
            ← BACK_TO_MENU
          </button>
        </div>
      )}

      {/* HOSTING: Show room code */}
      {mode === "HOSTING" && (
        <div className="flex flex-col items-center gap-6 w-full max-w-md px-8">
          {roomCode && (
            <div className="w-full">
              <div className="text-[10px] text-white/40 font-mono tracking-widest uppercase mb-2 text-center">
                Share this code with your opponent
              </div>
              <div
                onClick={copyCode}
                className="w-full py-4 bg-white/5 border border-[#ff003c]/40 text-center cursor-pointer hover:bg-white/10 transition-colors group"
              >
                <span className="text-4xl font-black text-[#ff003c] tracking-[0.5em] font-mono group-hover:drop-shadow-[0_0_15px_#ff003c]">
                  {roomCode}
                </span>
                <div className="text-[9px] text-white/30 font-mono mt-2 tracking-wider">
                  {copied ? "✓ COPIED TO CLIPBOARD" : "CLICK TO COPY"}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-[#ff003c] rounded-full animate-pulse"></div>
            <span className="text-sm text-white/60 font-mono tracking-wider">{status}</span>
          </div>

          <button
            onClick={() => {
              if (roomCodeRef.current) fetch(`/api/rooms/${roomCodeRef.current}`, { method: "DELETE" });
              networkRef.current?.destroy();
              setMode("SELECT");
            }}
            className="mt-4 text-white/30 hover:text-white/70 text-sm font-mono tracking-widest transition-colors"
          >
            ✕ CANCEL
          </button>
        </div>
      )}

      {/* BROWSING: Room list */}
      {mode === "BROWSING" && (
        <RoomsList onJoin={handleJoinFromList} onBack={() => setMode("SELECT")} />
      )}

      {/* JOINING: Connecting state */}
      {mode === "JOINING" && networkRef.current && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-[#7000ff] rounded-full animate-pulse"></div>
            <span className="text-sm text-white/60 font-mono tracking-wider">{status}</span>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mt-6 text-[#ff003c] text-sm font-mono tracking-wider animate-pulse">
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
