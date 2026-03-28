"use client";

import { useRef, useEffect, useState } from "react";
import { ArenaNetworkService, ArenaPlayer, ArenaGameResult, ArenaMessage, ArenaBoardPowerUp } from "../game/ArenaNetworkService";
import { Position, Direction } from "../game/types";
import { generateFood, generatePowerUpPos } from "../game/utils";
import { POWERUP_DURATION_ERASER, POWERUP_DURATION_MAGNET, POWERUP_DURATION_GHOST, POWERUP_SPAWN_TIMER } from "../game/constants";
import ArenaResult from "./ArenaResult";
import { ARENA_COLORS } from "./ArenaLobby";

const COLS = 50;
const ROWS = 30;
const TICK_MS = 150;
const FOOD_COUNT = 3;

interface ArenaGameProps {
  net: ArenaNetworkService;
  myIndex: number;
  totalPlayers: number;
  myWallet: string;
  onExit: () => void;
  onMatchStart?: (t: number) => void;
  onMatchOver?: () => void;
}

function getInitialPlayers(total: number): ArenaPlayer[] {
  const configs: { snake: Position[]; direction: Direction }[] = [
    { snake: [[5, 4], [4, 4], [3, 4]], direction: "RIGHT" },
    { snake: [[44, 4], [45, 4], [46, 4]], direction: "LEFT" },
    { snake: [[5, 25], [4, 25], [3, 25]], direction: "RIGHT" },
    { snake: [[44, 25], [45, 25], [46, 25]], direction: "LEFT" },
  ];
  const three: { snake: Position[]; direction: Direction }[] = [
    { snake: [[5, 4], [4, 4], [3, 4]], direction: "RIGHT" },
    { snake: [[44, 4], [45, 4], [46, 4]], direction: "LEFT" },
    { snake: [[25, 25], [25, 26], [25, 27]], direction: "UP" },
  ];
  const base = total === 3 ? three : configs.slice(0, total);
  return base.map((c, i) => ({ index: i, snake: c.snake, score: 0, alive: true, direction: c.direction, powerUpType: null, powerUpTimer: 0 }));
}

function generateInitialFoods(players: ArenaPlayer[]): Position[] {
  const occupied = players.flatMap((p) => p.snake);
  const foods: Position[] = [];
  for (let i = 0; i < FOOD_COUNT; i++) {
    foods.push(generateFood(COLS, ROWS, [], [...occupied, ...foods]));
  }
  return foods;
}

export default function ArenaGame({ net, myIndex, totalPlayers, myWallet, onExit, onMatchStart, onMatchOver }: ArenaGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isHost = net.role === "HOST";

  // Particle type for death explosions
  type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };

  const stateRef = useRef<{
    players: ArenaPlayer[];
    foods: Position[];
    nextDirections: Direction[];
    deathTimes: number[];
    matchStartTime: number;
    tick: number;
    over: boolean;
    initialized: boolean;
    particles: Particle[];
    shockwaves: { x: number; y: number; radius: number; maxRadius: number; color: string }[];
    shake: number;
    glitch: number;
    boardPowerUp: ArenaBoardPowerUp | null;
    foodCount: number;
  }>({
    players: [],
    foods: [],
    nextDirections: [],
    deathTimes: [],
    matchStartTime: 0,
    tick: 0,
    over: false,
    initialized: false,
    particles: [],
    shockwaves: [],
    shake: 0,
    glitch: 0,
    boardPowerUp: null,
    foodCount: 0,
  });

  const [gamePhase, setGamePhase] = useState<"COUNTDOWN" | "PLAYING" | "OVER">("COUNTDOWN");
  const [countdown, setCountdown] = useState(3);
  const [scores, setScores] = useState<number[]>(Array(totalPlayers).fill(0));
  const [aliveMask, setAliveMask] = useState<boolean[]>(Array(totalPlayers).fill(true));
  const [results, setResults] = useState<ArenaGameResult[]>([]);
  const [showResult, setShowResult] = useState(false);
  const startTimeRef = useRef(Date.now());
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const gamePhaseRef = useRef<"COUNTDOWN" | "PLAYING" | "OVER">("COUNTDOWN");
  const winnerDeclaredRef = useRef(false);
  const [deathSequence, setDeathSequence] = useState(false);
  const [myPowerUpInfo, setMyPowerUpInfo] = useState<{ active: boolean; timer: number; type: string | null }>({ active: false, timer: 0, type: null });

  // ── INIT STATE ──────────────────────────────────────────────────────
  useEffect(() => {
    const initialPlayers = getInitialPlayers(totalPlayers);
    const foods = generateInitialFoods(initialPlayers);
    stateRef.current = {
      players: initialPlayers,
      foods,
      nextDirections: initialPlayers.map((p) => p.direction),
      deathTimes: Array(totalPlayers).fill(0),
      matchStartTime: Date.now(),
      tick: 0,
      over: false,
      initialized: true,
      particles: [],
      shockwaves: [],
      shake: 0,
      glitch: 0,
      boardPowerUp: null,
      foodCount: 0,
    };
    setAliveMask(Array(totalPlayers).fill(true));
    setScores(Array(totalPlayers).fill(0));

    if (isHost) {
      for (let i = 1; i < totalPlayers; i++) {
        net.sendToPlayer(i, {
          type: "GAME_START",
          myIndex: i,
          totalPlayers,
          walls: [],
          initialPlayers,
        });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── KEYBOARD INPUT ───────────────────────────────────────────────────
  useEffect(() => {
    const MAP: Record<string, Direction> = {
      ArrowUp: "UP", w: "UP", W: "UP",
      ArrowDown: "DOWN", s: "DOWN", S: "DOWN",
      ArrowLeft: "LEFT", a: "LEFT", A: "LEFT",
      ArrowRight: "RIGHT", d: "RIGHT", D: "RIGHT",
    };
    const OPPOSITE: Record<Direction, Direction> = { UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT" };

    const onKey = (e: KeyboardEvent) => {
      if (gamePhaseRef.current !== "PLAYING") return;
      const dir = MAP[e.key];
      if (!dir) return;
      e.preventDefault();

      const s = stateRef.current;
      const me = s.players[myIndex];
      if (!me || !me.alive) return;
      if (dir === OPPOSITE[me.direction]) return;

      if (isHost) {
        s.nextDirections[myIndex] = dir;
      } else {
        net.send({ type: "INPUT", direction: dir });
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isHost, myIndex, net]);

  // ── NETWORK MESSAGES ─────────────────────────────────────────────────
  useEffect(() => {
    if (isHost) {
      net.onMessage((msg: ArenaMessage, fromIndex?: number) => {
        if (msg.type === "INPUT" && fromIndex !== undefined) {
          const s = stateRef.current;
          const p = s.players[fromIndex];
          if (!p || !p.alive) return;
          const OPPOSITE: Record<Direction, Direction> = { UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT" };
          if (msg.direction !== OPPOSITE[p.direction]) {
            s.nextDirections[fromIndex] = msg.direction;
          }
        }
      });
    } else {
      net.onMessage((msg: ArenaMessage) => {
        if (msg.type === "FULL_STATE") {
          const s = stateRef.current;
          s.players = msg.players;
          s.foods = msg.foods;
          s.tick = msg.tick;
          s.boardPowerUp = msg.boardPowerUp;
          setScores(msg.players.map((p) => p.score));
          setAliveMask(msg.players.map((p) => p.alive));
          const myP = msg.players[myIndex];
          if (myP) setMyPowerUpInfo({ active: !!myP.powerUpType && myP.powerUpTimer > 0, timer: Math.ceil(Math.max(0, myP.powerUpTimer)), type: myP.powerUpType });
        }
        if (msg.type === "SHOCKWAVE_HIT" && msg.targetIndex === myIndex) {
          const s = stateRef.current;
          s.shake = 20; s.glitch = 25;
        }
        if (msg.type === "GAME_OVER") {
          stateRef.current.over = true;
          setResults(msg.results);
          gamePhaseRef.current = "OVER";
          setGamePhase("OVER");
          if (onMatchOver) onMatchOver();
          setTimeout(() => setShowResult(true), 1500);
        }
      });
    }
  }, [isHost, net, onMatchOver]);

  // ── COUNTDOWN ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== "COUNTDOWN") return;

    if (countdown <= 0) {
      const goTimer = setTimeout(() => {
        const now = Date.now();
        stateRef.current.matchStartTime = now;
        startTimeRef.current = now;
        gamePhaseRef.current = "PLAYING";
        setGamePhase("PLAYING");
        if (onMatchStart) onMatchStart(now);
      }, 600);
      return () => clearTimeout(goTimer);
    }

    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown, gamePhase, onMatchStart]);

  // ── HOST GAME LOOP ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isHost || gamePhase !== "PLAYING") return;

    const tick = setInterval(() => {
      const s = stateRef.current;
      if (s.over || !s.initialized) return;

      const now = Date.now();
      s.tick++;

      // Apply next directions
      s.players.forEach((p, i) => {
        if (p.alive) p.direction = s.nextDirections[i];
      });

      // Compute new heads
      const newHeads: Position[] = [];
      s.players.forEach((p) => {
        if (!p.alive) { newHeads.push([-1, -1]); return; }
        const head = p.snake[0];
        const nh: Position = [
          p.direction === "LEFT" ? head[0] - 1 : p.direction === "RIGHT" ? head[0] + 1 : head[0],
          p.direction === "UP"   ? head[1] - 1 : p.direction === "DOWN"  ? head[1] + 1 : head[1],
        ];
        newHeads.push(nh);
      });

      // Collision detection
      const dying = new Set<number>();
      s.players.forEach((p, i) => {
        if (!p.alive) return;
        const nh = newHeads[i];
        if (nh[0] < 0 || nh[0] >= COLS || nh[1] < 0 || nh[1] >= ROWS) { dying.add(i); return; }
        if (p.snake.slice(0, -1).some((seg) => seg[0] === nh[0] && seg[1] === nh[1])) { dying.add(i); return; }
        s.players.forEach((other, j) => {
          if (i === j || !other.alive) return;
          const bodyToCheck = other.snake.slice(1, -1);
          if (bodyToCheck.some((seg) => seg[0] === nh[0] && seg[1] === nh[1])) dying.add(i);
        });
        s.players.forEach((_, j) => {
          if (j <= i || !s.players[j].alive) return;
          if (newHeads[j][0] === nh[0] && newHeads[j][1] === nh[1]) { dying.add(i); dying.add(j); }
        });
        s.players.forEach((other, j) => {
          if (i === j || !other.alive) return;
          if (other.snake[0][0] === nh[0] && other.snake[0][1] === nh[1]) dying.add(i);
        });
      });

      // Apply deaths
      dying.forEach((i) => {
        const p = s.players[i];
        const color = ARENA_COLORS[i] || "#ffffff";
        if (p.snake.length > 0) {
          const head = p.snake[0];
          s.shockwaves.push({ x: head[0], y: head[1], radius: 0, maxRadius: 12, color });
          p.snake.slice(0, 8).forEach((seg) => {
            for (let k = 0; k < 6; k++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = 0.3 + Math.random() * 0.8;
              s.particles.push({
                x: seg[0] + 0.5, y: seg[1] + 0.5,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                life: 0.8 + Math.random() * 0.4,
                color, size: 0.15 + Math.random() * 0.2,
              });
            }
          });
        }
        // Shake + glitch on death (matching PVP)
        s.shake = 20;
        s.glitch = 25;
        p.alive = false;
        p.snake = [];
        s.deathTimes[i] = now;

        // Trigger death sequence for my own death
        if (i === myIndex) {
          setDeathSequence(true);
          setTimeout(() => setDeathSequence(false), 1500);
        }
      });

      // Move alive snakes
      s.players.forEach((p, i) => {
        if (!p.alive || dying.has(i)) return;
        const nh = newHeads[i];
        p.snake.unshift(nh);

        const fi = s.foods.findIndex((f) => f[0] === nh[0] && f[1] === nh[1]);
        if (fi !== -1) {
          p.score += 10;
          const allSnakes = s.players.flatMap((q) => q.snake);
          s.foods[fi] = generateFood(COLS, ROWS, [], [...allSnakes, ...s.foods]);
        } else {
          p.snake.pop();
        }
      });

      const aliveCount = s.players.filter((p) => p.alive).length;

      net.broadcast({ type: "FULL_STATE", players: s.players, foods: s.foods, tick: s.tick, boardPowerUp: null });
      setScores(s.players.map((p) => p.score));
      setAliveMask(s.players.map((p) => p.alive));

      if (aliveCount === 1 && !winnerDeclaredRef.current) {
        winnerDeclaredRef.current = true;
        const wi = s.players.findIndex((p) => p.alive);
        setWinnerIndex(wi);
        net.broadcast({ type: "FULL_STATE", players: s.players, foods: s.foods, tick: s.tick, boardPowerUp: null });
      }

      if (aliveCount === 0) {
        s.over = true;
        const matchDuration = Math.floor((now - s.matchStartTime) / 1000);

        const ranked = [...s.players].sort((a, b) => {
          const tA = s.deathTimes[a.index] || 0;
          const tB = s.deathTimes[b.index] || 0;
          if (tA !== tB) return tB - tA;
          return b.score - a.score;
        });

        const gameResults: ArenaGameResult[] = ranked.map((p, pos) => ({
          playerIndex: p.index,
          position: pos + 1,
          score: p.score,
          playerDuration: Math.max(1, Math.floor((s.deathTimes[p.index] - s.matchStartTime) / 1000)),
          matchDuration,
        }));

        net.broadcast({ type: "GAME_OVER", results: gameResults });
        setResults(gameResults);
        gamePhaseRef.current = "OVER";
        setGamePhase("OVER");
        if (onMatchOver) onMatchOver();
        setTimeout(() => setShowResult(true), 1500);
      }
    }, TICK_MS);

    return () => clearInterval(tick);
  }, [isHost, gamePhase, net, myIndex, onMatchOver]);

  // ── CANVAS RENDER (PVP-IDENTICAL STYLE) ──────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    let animId: number;

    const draw = () => {
      const parent = canvas.parentElement;
      if (!parent) { animId = requestAnimationFrame(draw); return; }
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;
      if (w <= 0 || h <= 0) { animId = requestAnimationFrame(draw); return; }

      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cellSize = Math.floor(w / COLS);
      const s = stateRef.current;
      const time = performance.now();

      // ── SCREEN SHAKE & GLITCH (PVP-identical) ──
      if (s.shake > 0) {
        s.shake *= 0.92;
        ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
      }
      if (s.glitch > 0) s.glitch *= 0.95;

      // Chromatic Aberration offset (PVP-identical)
      const gX = s.glitch > 0 ? (Math.random() - 0.5) * (s.glitch / 2) : 0;
      const gY = s.glitch > 0 ? (Math.random() - 0.5) * (s.glitch / 2) : 0;

      // Background — clean flat (PVP style, no grid dots)
      ctx.fillStyle = "#050510";
      ctx.fillRect(0, 0, w, h);

      // Food — PVP-identical animated pulse
      const bS = (cellSize * 0.7) * (Math.sin(time / 150) * 0.15 + 1);
      ctx.fillStyle = "#00ff66";
      ctx.shadowBlur = 25;
      ctx.shadowColor = "#00ff66";
      s.foods.forEach((f) => {
        ctx.beginPath();
        ctx.roundRect(f[0] * cellSize + (cellSize - bS) / 2 + gX, f[1] * cellSize + (cellSize - bS) / 2 + gY, bS, bS, bS * 0.2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // Snakes — PVP-identical body gradient + head glow + white center dot
      s.players.forEach((p) => {
        if (!p.snake || p.snake.length === 0) return;
        const baseColor = ARENA_COLORS[p.index] || "#ffffff";

        // Parse base color for gradient interpolation
        const isMe = p.index === myIndex;

        p.snake.forEach((seg, si) => {
          const isHead = si === 0;
          // PVP-style: head is full color, body fades with gradient
          const ratio = si / Math.max(p.snake.length, 1);
          let color: string;
          if (isHead) {
            color = baseColor;
          } else {
            // Darken towards tail (PVP-identical approach)
            const alpha = Math.max(0.3, 1 - ratio * 0.8);
            color = baseColor;
            ctx.globalAlpha = alpha;
          }

          ctx.shadowBlur = isHead ? 30 : 10;
          ctx.shadowColor = baseColor;
          ctx.fillStyle = color;
          const m = cellSize * 0.1;
          ctx.beginPath();
          ctx.roundRect(seg[0] * cellSize + m + gX, seg[1] * cellSize + m + gY, cellSize - m * 2, cellSize - m * 2, isHead ? cellSize * 0.2 : cellSize * 0.1);
          ctx.fill();

          // White center dot on head (PVP-identical: 0.2 radius for self, 0.15 for others)
          if (isHead) {
            ctx.fillStyle = "#fff";
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(seg[0] * cellSize + cellSize / 2 + gX, seg[1] * cellSize + cellSize / 2 + gY, cellSize * (isMe ? 0.2 : 0.15), 0, Math.PI * 2);
            ctx.fill();
          }

          if (!isHead) ctx.globalAlpha = 1;
        });
      });
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Shockwaves (PVP-identical: white stroke + colored shadow)
      s.shockwaves = s.shockwaves.filter((sw) => sw.radius < sw.maxRadius);
      s.shockwaves.forEach((sw) => {
        sw.radius += 0.4;
        const cx = sw.x * cellSize + cellSize / 2 + gX;
        const cy = sw.y * cellSize + cellSize / 2 + gY;
        const op = Math.max(0, 1 - sw.radius / sw.maxRadius);
        ctx.strokeStyle = `rgba(255,255,255,${op * 0.8})`;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 30;
        ctx.shadowColor = sw.color;
        ctx.beginPath();
        ctx.arc(cx, cy, sw.radius * cellSize, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      // Particles (PVP-identical: decay rate 0.05, pixel-based drawing)
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.x += p.vx; p.y += p.vy; p.life -= 0.05;
        if (p.life <= 0) { s.particles.splice(i, 1); continue; }
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x * cellSize + gX, p.y * cellSize + gY, p.size * cellSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [myIndex]);

  const myResult = results.find((r) => r.playerIndex === myIndex);
  const myPosition = myResult?.position ?? 0;

  return (
    <div className="relative w-full h-full">
      {/* ── SCORE — PVP-identical floating above board ── */}
      {gamePhase === "PLAYING" && (
        <div className="absolute -top-[100px] left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center animate-bounce-subtle">
          <span className="text-[14px] text-[#00f0ff] uppercase tracking-[0.6em] font-black mb-1 opacity-90 drop-shadow-[0_0_8px_#00f0ff]">Arena Score</span>
          <div className="flex items-baseline gap-3">
            {Array.from({ length: totalPlayers }, (_, i) => (
              <span
                key={i}
                className={`font-black drop-shadow-[0_0_15px_currentColor] transition-all ${!aliveMask[i] ? 'opacity-20 line-through' : ''}`}
                style={{
                  color: ARENA_COLORS[i],
                  fontSize: i === myIndex ? 'clamp(36px, 5vw, 56px)' : 'clamp(24px, 3vw, 36px)',
                }}
              >
                {scores[i]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── GAME BOARD — PVP-identical frame ── */}
      <div className="absolute inset-0 w-full h-full bg-[#050510] overflow-hidden rounded-2xl group border-[6px] border-white/5 flex flex-col">
        {/* PVP-identical scanning border lines */}
        <div className="absolute inset-0 z-10 pointer-events-none rounded-xl border-[3px] border-white/10 shadow-[inset_0_0_40px_rgba(112,0,255,0.2)]"></div>
        <div className="absolute inset-0 z-10 pointer-events-none rounded-xl border-[3px] border-[#00f0ff]/30 animate-pulse"></div>
        <div className="absolute inset-0 z-10 pointer-events-none rounded-xl overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent animate-border-scan-top opacity-70"></div>
          <div className="absolute bottom-0 left-0 w-full h-[4px] bg-gradient-to-r from-transparent via-[#7000ff] to-transparent animate-border-scan-bottom opacity-70"></div>
          <div className="absolute top-0 right-0 w-[4px] h-full bg-gradient-to-b from-transparent via-[#ff003c] to-transparent animate-border-scan-right opacity-70"></div>
          <div className="absolute top-0 left-0 w-[4px] h-full bg-gradient-to-b from-transparent via-[#00f0ff] to-transparent animate-border-scan-left opacity-70"></div>
        </div>

        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* ── PVP-identical Countdown Overlay ── */}
        {gamePhase === "COUNTDOWN" && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden bg-black/10">
            <div className="relative flex flex-col items-center">
              <div className="absolute inset-0 scale-[3] blur-[100px] bg-white/5 rounded-full animate-pulse-slow"></div>
              <div key={countdown} className="relative z-10 flex flex-col items-center animate-countdown-bounce">
                <span className={`text-[180px] font-black italic tracking-tighter drop-shadow-[0_0_50px_currentColor] ${
                  countdown === 3 ? 'text-[#ff003c]' :
                  countdown === 2 ? 'text-[#00f0ff]' :
                  countdown === 1 ? 'text-[#00ff66]' : 'text-white'
                }`}>
                  {countdown === 0 ? "GO!" : countdown}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── PVP-identical death sequence overlay ── */}
        {deathSequence && gamePhase === "PLAYING" && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-red-600/20 backdrop-invert-[0.1] animate-death-flash pointer-events-none">
            <div className="flex flex-col items-center">
              <div className="text-[64px] font-black text-white drop-shadow-[0_0_20px_#ff0000] animate-glitch-text italic">
                CORE_BREACHED
              </div>
              <div className="text-[14px] font-mono text-red-100/60 tracking-[1em] animate-pulse">
                FATAL_ERROR: CONNECTION_TERM
              </div>
              <div className="absolute top-0 left-0 w-full h-[2px] bg-red-400/50 shadow-[0_0_15px_red] animate-scanline"></div>
            </div>
          </div>
        )}

        {/* Winner banner — last player alive */}
        {gamePhase === "PLAYING" && winnerIndex !== null && winnerIndex === myIndex && (
          <div className="absolute z-30 pointer-events-none right-2" style={{ top: 'clamp(-60px, -7vw, -90px)', width: 'clamp(180px, 22vw, 280px)' }}>
            <div className="flex items-center justify-center rounded-lg backdrop-blur-sm bg-[#00ff66]/10 border border-[#00ff66]/40" style={{ padding: 'clamp(4px, 0.6vw, 12px) clamp(8px, 1vw, 16px)' }}>
              <span className="font-black text-[#00ff66] uppercase whitespace-nowrap" style={{ fontSize: 'clamp(8px, 1vw, 11px)', letterSpacing: 'clamp(0.1em, 0.2vw, 0.2em)' }}>👑 LAST_SURVIVOR ✓</span>
            </div>
          </div>
        )}

        {/* Elimination notice — PVP-identical spectating panel */}
        {gamePhase === "PLAYING" && !aliveMask[myIndex] && !deathSequence && (
          <div className="absolute z-30 left-2" style={{ top: 'clamp(-60px, -7vw, -90px)', width: 'clamp(180px, 22vw, 280px)' }}>
            <div className="flex flex-col items-center gap-1 rounded-lg backdrop-blur-sm bg-[#ff003c]/10 border border-[#ff003c]/40" style={{ padding: 'clamp(4px, 0.6vw, 8px) clamp(6px, 0.8vw, 12px)' }}>
              <span className="font-black text-[#ff003c] uppercase animate-pulse whitespace-nowrap pointer-events-none" style={{ fontSize: 'clamp(7px, 0.9vw, 10px)', letterSpacing: 'clamp(0.1em, 0.15vw, 0.2em)' }}>ELIMINATED — SPECTATING</span>
              <button
                onClick={onExit}
                className="w-full py-1 rounded text-center font-mono uppercase tracking-wider transition-all hover:bg-[#ff003c]/30 border border-[#ff003c]/20 hover:border-[#ff003c]/60 text-[#ff003c]/70 hover:text-[#ff003c] cursor-pointer"
                style={{ fontSize: 'clamp(6px, 0.7vw, 9px)' }}
              >
                ✕ LEAVE MATCH
              </button>
            </div>
          </div>
        )}

        {/* ── PVP-identical GAME OVER OVERLAY ── */}
        {gamePhase === "OVER" && !showResult && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden p-2">
            <div className="absolute inset-0 bg-[#050510]/80 backdrop-blur-xl"></div>
            <div className="relative w-[90%] max-w-md bg-black/40 border border-white/10 p-4 sm:p-6 rounded-2xl backdrop-blur-2xl shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden animate-slide-in">
              <div className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-[100px] opacity-20 ${myPosition === 1 ? 'bg-[#00ff66]' : 'bg-[#ff003c]'}`}></div>
              <div className={`absolute -bottom-24 -right-24 w-48 h-48 rounded-full blur-[100px] opacity-20 ${myPosition === 1 ? 'bg-[#00f0ff]' : 'bg-[#ff003c]'}`}></div>
              <div className="relative z-10 text-center">
                <div className="text-[8px] sm:text-[10px] font-mono text-white/40 tracking-[0.5em] uppercase mb-1">Match_Analysis_Report</div>
                <h2 className={`text-4xl sm:text-5xl font-black italic tracking-tighter uppercase mb-1 drop-shadow-2xl ${
                  myPosition === 1 ? 'text-[#00ff66]' : myPosition === 2 ? 'text-[#00f0ff]' : 'text-[#ff003c]'
                }`}>
                  {myPosition === 1 ? 'VICTORY' : `#${myPosition} PLACE`}
                </h2>
                <div className={`h-[2px] w-14 mx-auto rounded-full ${myPosition === 1 ? 'bg-[#00ff66]/50' : 'bg-[#ff003c]/50'}`}></div>
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes scanTop    { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
          @keyframes scanBottom { 0% { transform: translateX(100%);  } 100% { transform: translateX(-100%); } }
          @keyframes scanRight  { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
          @keyframes scanLeft   { 0% { transform: translateY(100%);  } 100% { transform: translateY(-100%); } }
          @keyframes bounceSubtle { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-12px) scale(1.05); } }
          @keyframes pulseFast { 0%, 100% { opacity: 1; filter: brightness(1); } 50% { opacity: 0.7; filter: brightness(1.5); } }

          .animate-border-scan-top { animation: scanTop 3s linear infinite; }
          .animate-border-scan-bottom { animation: scanBottom 3s linear infinite; }
          .animate-border-scan-right { animation: scanRight 4s linear infinite; }
          .animate-border-scan-left { animation: scanLeft 4s linear infinite; }
          .animate-bounce-subtle { animation: bounceSubtle 3s ease-in-out infinite; }
          .animate-pulse-fast { animation: pulseFast 0.4s ease-in-out infinite; }
          .animate-slide-in { animation: slideIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1); }
          @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

          @keyframes countdownBounce {
            0% { transform: scale(3); opacity: 0; filter: blur(20px); }
            10% { transform: scale(1); opacity: 1; filter: blur(0px); }
            80% { transform: scale(1); opacity: 1; }
            100% { transform: scale(1.5); opacity: 0; filter: blur(10px); }
          }
          .animate-countdown-bounce { animation: countdownBounce 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

          @keyframes pulse-slow {
            0%, 100% { opacity: 0.1; transform: scale(3); }
            50% { opacity: 0.2; transform: scale(3.5); }
          }
          .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }

          @keyframes deathFlash {
            0%, 20%, 40%, 60%, 80%, 100% { background: rgba(255, 0, 0, 0.4); opacity: 0.8; }
            10%, 30%, 50%, 70%, 90% { background: black; opacity: 1; }
          }
          .animate-death-flash { animation: deathFlash 0.15s linear infinite; }

          @keyframes glitchText {
            0% { transform: translate(0); color: white; text-shadow: 2px 0 red, -2px 0 blue; }
            20% { transform: translate(-5px, 2px); }
            40% { transform: translate(5px, -2px); }
            60% { transform: translate(-2px, -3px); color: #ff003c; }
            100% { transform: translate(0); }
          }
          .animate-glitch-text { animation: glitchText 0.1s linear infinite; }

          @keyframes scanline {
            0% { top: 0% }
            100% { top: 100% }
          }
          .animate-scanline { animation: scanline 1.5s linear forwards; }
        `}</style>
      </div>

      {/* Result modal */}
      {showResult && myResult && (
        <ArenaResult
          myIndex={myIndex}
          myAddress={myWallet}
          results={results}
          onClose={onExit}
        />
      )}
    </div>
  );
}
