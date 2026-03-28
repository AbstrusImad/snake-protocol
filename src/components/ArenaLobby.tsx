"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArenaNetworkService } from "../game/ArenaNetworkService";

export const ARENA_COLORS = ["#00f0ff", "#ff6600", "#ff00cc", "#00ff66"];
export const ARENA_LABELS = ["P1", "P2", "P3", "P4"];

interface ArenaLobbyProps {
  onGameReady: (net: ArenaNetworkService, totalPlayers: number) => void;
  onBack: () => void;
}

export default function ArenaLobby({ onGameReady, onBack }: ArenaLobbyProps) {
  const [mode, setMode] = useState<"SELECT" | "HOSTING" | "JOINING">("SELECT");
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [connectedPlayers, setConnectedPlayers] = useState(1); // HOST counts as 1
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [joined, setJoined] = useState(false);
  const netRef = useRef<ArenaNetworkService | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    return () => { if (!startedRef.current) netRef.current?.destroy(); };
  }, []);

  const handleCreateRoom = async () => {
    setMode("HOSTING");
    setStatus("Initializing...");
    setError("");

    const net = new ArenaNetworkService();
    netRef.current = net;

    net.onPlayerJoined((idx) => {
      setConnectedPlayers((n) => n + 1);
      setStatus(`Player ${idx + 1} joined!`);
      // Send lobby update to all
      net.broadcast({
        type: "LOBBY_UPDATE",
        connectedCount: net.totalConnected,
        maxPlayers,
      });
    });

    net.onPlayerLeft((idx) => {
      setConnectedPlayers((n) => Math.max(1, n - 1));
      setStatus(`Player ${idx + 1} disconnected`);
    });

    try {
      const id = await net.createRoom(maxPlayers);
      setRoomCode(id);
      setStatus("Waiting for players...");
      // Register room
      await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, mode: "ARENA", maxPlayers }),
      }).catch(() => {});
    } catch (err) {
      setError(`Failed to create room: ${err}`);
      setMode("SELECT");
    }
  };

  const handleStartGame = () => {
    const net = netRef.current;
    if (!net || connectedPlayers < 3) return;
    startedRef.current = true;
    // Delete from room list
    if (roomCode) fetch(`/api/rooms/${roomCode}`, { method: "DELETE" }).catch(() => {});
    onGameReady(net, connectedPlayers);
  };

  const handleJoinRoom = async (codeOverride?: string) => {
    const code = (codeOverride ?? inputCode).trim().toUpperCase();
    if (!code) return;
    setMode("JOINING");
    setStatus("Connecting to host...");
    setError("");

    const net = new ArenaNetworkService();
    netRef.current = net;

    net.onMessage((msg) => {
      if (msg.type === "LOBBY_UPDATE") {
        setConnectedPlayers(msg.connectedCount);
        setStatus(`${msg.connectedCount}/${msg.maxPlayers} players connected`);
      }
      if (msg.type === "GAME_START") {
        startedRef.current = true;
        onGameReady(net, msg.totalPlayers);
      }
    });

    net.onPlayerLeft(() => {
      setStatus("Host disconnected.");
      setError("Host disconnected. Please go back and try again.");
    });

    try {
      await net.joinRoom(code);
      setJoined(true);
      setStatus("Connected! Waiting for host to start...");
    } catch (err) {
      setError(`Failed to join: ${err}`);
      setMode("SELECT");
    }
  };

  const copyCode = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(roomCode);
    } else {
      const ta = document.createElement("textarea");
      ta.value = roomCode;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050510] overflow-hidden rounded-2xl border-[6px] border-white/5">
      {/* Background lines */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        {[1, 2, 3].map((i) => (
          <div key={i} className="absolute top-0 w-[1px] h-full bg-gradient-to-b from-transparent via-[#ff6600] to-transparent animate-pulse"
            style={{ left: `${i * 25}%` }} />
        ))}
      </div>

      {/* Title */}
      <div className="relative mb-8 flex flex-col items-center">
        <h1 className="text-5xl font-black text-white tracking-tighter">
          HACK_<span className="text-[#ff6600]">ARENA</span>
        </h1>
        <div className="mt-2 text-center text-[10px] text-white/30 font-mono tracking-[0.5em] uppercase">
          3-4 Players • WebRTC P2P • AI Validated XP
        </div>
      </div>

      {/* SELECT */}
      {mode === "SELECT" && (
        <div className="flex flex-col gap-5 w-full max-w-sm px-8">
          {/* Max players selector */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-mono text-white/40 tracking-widest uppercase text-center">Max Players</span>
            <div className="flex gap-2">
              {[3, 4].map((n) => (
                <button key={n} onClick={() => setMaxPlayers(n)}
                  className={`flex-1 py-2 font-black text-lg border transition-all ${maxPlayers === n ? "border-[#ff6600] bg-[#ff6600]/10 text-[#ff6600]" : "border-white/10 text-white/40 hover:border-white/30"}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleCreateRoom}
            className="group relative w-full py-5 bg-[#ff6600]/5 border border-[#ff6600]/30 hover:border-[#ff6600] transition-all hover:scale-105 active:scale-95">
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#ff6600]" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#ff6600]" />
            <span className="text-xl font-black text-white tracking-[0.3em] uppercase group-hover:text-[#ff6600] transition-colors">CREATE_ROOM</span>
            <div className="text-[9px] text-white/40 font-mono mt-1 tracking-wider">Host an Arena match</div>
          </button>

          <div className="flex gap-2">
            <input
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
              placeholder="ROOM CODE"
              className="flex-1 py-3 px-4 bg-white/5 border border-white/10 focus:border-[#ff6600]/50 outline-none font-mono text-sm text-white tracking-widest uppercase placeholder:text-white/20"
            />
            <button onClick={() => handleJoinRoom()}
              disabled={!inputCode}
              className="px-5 py-3 bg-[#7000ff]/5 border border-[#7000ff]/30 hover:border-[#7000ff] text-white font-black tracking-[0.2em] text-sm uppercase transition-all disabled:opacity-30">
              JOIN
            </button>
          </div>

          <button onClick={onBack} className="mt-2 text-white/30 hover:text-white/70 text-sm font-mono tracking-widest transition-colors">
            ← BACK_TO_MENU
          </button>
        </div>
      )}

      {/* HOSTING */}
      {mode === "HOSTING" && (
        <div className="flex flex-col items-center gap-5 w-full max-w-sm px-8">
          {roomCode && (
            <div className="w-full">
              <div className="text-[10px] text-white/40 font-mono tracking-widest uppercase mb-2 text-center">
                Share this code with friends
              </div>
              <div onClick={copyCode}
                className="w-full py-4 bg-white/5 border border-[#ff6600]/40 text-center cursor-pointer hover:bg-white/10 transition-colors group">
                <span className="text-3xl font-black text-[#ff6600] tracking-[0.5em] font-mono group-hover:drop-shadow-[0_0_15px_#ff6600]">
                  {roomCode}
                </span>
                <div className="text-[9px] text-white/30 font-mono mt-2 tracking-wider">
                  {copied ? "✓ COPIED" : "CLICK TO COPY"}
                </div>
              </div>
            </div>
          )}

          {/* Player slots */}
          <div className="w-full flex flex-col gap-2">
            <div className="text-[10px] font-mono text-white/40 tracking-widest uppercase text-center">
              {connectedPlayers}/{maxPlayers} Players
            </div>
            <div className="flex gap-2 justify-center">
              {Array.from({ length: maxPlayers }, (_, i) => (
                <div key={i}
                  className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center font-black text-sm transition-all ${
                    i < connectedPlayers
                      ? "border-current shadow-[0_0_12px_currentColor]"
                      : "border-white/10 text-white/20"
                  }`}
                  style={{ color: i < connectedPlayers ? ARENA_COLORS[i] : undefined }}>
                  {i < connectedPlayers ? ARENA_LABELS[i] : "·"}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-[#ff6600] rounded-full animate-pulse" />
            <span className="text-sm text-white/60 font-mono tracking-wider">{status}</span>
          </div>

          <button
            onClick={handleStartGame}
            disabled={connectedPlayers < 3}
            className="w-full py-4 font-black tracking-[0.3em] text-sm uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-[#00ff66]/40 bg-[#00ff66]/5 text-[#00ff66] hover:bg-[#00ff66]/10 hover:border-[#00ff66] disabled:border-white/10 disabled:text-white/30">
            {connectedPlayers < 3 ? `Waiting (min 3 players)` : "▶ START ARENA"}
          </button>

          <button
            onClick={() => {
              if (roomCode) fetch(`/api/rooms/${roomCode}`, { method: "DELETE" }).catch(() => {});
              netRef.current?.destroy();
              setConnectedPlayers(1);
              setMode("SELECT");
            }}
            className="text-white/30 hover:text-white/70 text-sm font-mono tracking-widest transition-colors">
            ✕ CANCEL
          </button>
        </div>
      )}

      {/* JOINING */}
      {mode === "JOINING" && (
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-[#7000ff] rounded-full animate-pulse" />
            <span className="text-sm text-white/60 font-mono tracking-wider">{status}</span>
          </div>
          {joined && (
            <div className="flex flex-col items-center gap-2">
              <div className="text-[10px] font-mono text-white/30 tracking-widest uppercase">Connected Players</div>
              <div className="flex gap-2">
                {Array.from({ length: connectedPlayers }, (_, i) => (
                  <div key={i} className="w-10 h-10 rounded-lg border-2 flex items-center justify-center font-black text-xs"
                    style={{ borderColor: ARENA_COLORS[i], color: ARENA_COLORS[i], boxShadow: `0 0 8px ${ARENA_COLORS[i]}` }}>
                    {ARENA_LABELS[i]}
                  </div>
                ))}
              </div>
              <div className="text-[9px] font-mono text-white/30 tracking-wider animate-pulse mt-2">
                Waiting for host to start...
              </div>
            </div>
          )}
          {error && <div className="text-[#ff003c] text-sm font-mono tracking-wider">{error}</div>}
          <button onClick={() => { netRef.current?.destroy(); setMode("SELECT"); setJoined(false); }}
            className="text-white/30 hover:text-white/70 text-sm font-mono tracking-widest transition-colors">
            ✕ CANCEL
          </button>
        </div>
      )}

      {error && mode !== "JOINING" && (
        <div className="mt-4 text-[#ff003c] text-sm font-mono tracking-wider animate-pulse">⚠ {error}</div>
      )}
    </div>
  );
}
