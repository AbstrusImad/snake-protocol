"use client";

import React, { useState, useEffect, useRef } from "react";
import { Position, Direction, PowerUp, PowerUpType, Particle, Shockwave, GameEngineState } from "../game/types";
import { GRID_COLS, GRID_ROWS, INITIAL_SPEED, POWERUP_DURATION_ERASER, POWERUP_DURATION_MAGNET, POWERUP_SPAWN_TIMER, POWERUP_DURATION_GHOST } from "../game/constants";
import { generateWalls, generateFood, generatePowerUpPos } from "../game/utils";
import { botNextDirection } from "../game/BotEngine";
import { NetworkService, NetMessage } from "../game/NetworkService";
import MainMenu from "./MainMenu";
import PvpLobby from "./PvpLobby";
import XpResult from "./XpResult";
import GameTimer from "./GameTimer";
import Leaderboard from "./Leaderboard";
import { useAccount } from "wagmi";

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { address } = useAccount();
  const [rivalWallet, setRivalWallet] = useState<string>("");
  const gameStartTimeRef = useRef<number>(0);

  // Re-send wallet address if it resolves after the WebRTC connection was established
  useEffect(() => {
    if (address && networkRef.current) {
      console.log("[SnakeGame] sending WALLET_INFO (address resolved):", address);
      networkRef.current.send({ type: "WALLET_INFO", wallet: address });
    }
  }, [address]);

  // UI State
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gamePhase, setGamePhase] = useState<'MENU' | 'LOBBY' | 'PLAYING' | 'WAITING_START' | 'LEADERBOARD'>('MENU');
  const [powerUpInfo, setPowerUpInfo] = useState<{active: boolean, timer: number, type: PowerUpType | null}>({
    active: false,
    timer: 0,
    type: null
  });
  const [rivalPowerUpInfo, setRivalPowerUpInfo] = useState<{active: boolean, timer: number, type: PowerUpType | null}>({
    active: false,
    timer: 0,
    type: null
  });
  const [myRole, setMyRole] = useState<'HOST' | 'GUEST' | null>(null);
  const [hitNotification, setHitNotification] = useState<{ active: boolean, key: number }>({ active: false, key: 0 });
  const [rivalDisconnected, setRivalDisconnected] = useState(false);
  const [currentMode, setCurrentMode] = useState<"SOLO" | "PVP" | "BOT">("SOLO");
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const [deathSequence, setDeathSequence] = useState(false);
  // PVP spectator state
  const [isSpectating, setIsSpectating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const [rivalDead, setRivalDead] = useState(false);
  const [rivalScore, setRivalScore] = useState(0);
  const [pvpResult, setPvpResult] = useState<'WIN' | 'LOSE' | null>(null);
  // Rematch state
  const [rematchSent, setRematchSent] = useState(false);
  const [rematchReceived, setRematchReceived] = useState(false);
  const rematchSentRef = useRef(false);
  const [showXpModal, setShowXpModal] = useState(false);
  const xpModalShownRef = useRef(false);

  // Auto-open XP modal when PVP WINNER's game ends with enough duration
  useEffect(() => {
    if (isGameOver && currentMode === "PVP" && pvpResult === "WIN" && !xpModalShownRef.current && gameStartTimeRef.current > 0) {
      const dur = Math.floor((Date.now() - gameStartTimeRef.current) / 1000);
      if (dur >= 60) {
        xpModalShownRef.current = true;
        setShowXpModal(true);
      }
    }
  }, [isGameOver, currentMode, pvpResult]);

  const networkRef = useRef<NetworkService | null>(null);

  const engineRef = useRef<GameEngineState & {
    shake: number,
    glitch: number,
    rivalDead: boolean,
    rivalScore: number,
    pvpResult: 'WIN' | 'LOSE' | null,
    rivalPowerUpType: PowerUpType | null,
    rivalPowerUpTimer: number,
    rivalShockwaveHit: boolean,
    botDirection: Direction,
    botShockwave: Shockwave | null,
    botShockwaveHit: boolean,
  }>({
    snake: [[25, 15], [25, 16], [25, 17]] as Position[],
    rivalSnake: [] as Position[],
    gameMode: "SOLO",
    walls: generateWalls(GRID_COLS, GRID_ROWS),
    pendingWalls: [] as Position[],
    powerUp: null as PowerUp | null,
    foodCount: 0,
    shockwave: null,
    foods: [[20, 10]] as Position[],
    direction: "UP" as Direction,
    nextDirection: "UP" as Direction,
    score: 0,
    gameOver: false,
    lastTick: 0,
    particles: [] as Particle[],
    shake: 0,
    glitch: 0,
    rivalDead: false,
    rivalScore: 0,
    pvpResult: null,
    rivalPowerUpType: null,
    rivalPowerUpTimer: 0,
    rivalShockwaveHit: false,
    botDirection: "UP" as Direction,
    botShockwave: null,
    botShockwaveHit: false,
  });

  const resetGame = (mode: "SOLO" | "PVP" | "BOT" = "SOLO", walls?: Position[], foods?: Position[]) => {
    gameStartTimeRef.current = Date.now();
    xpModalShownRef.current = false;
    setShowXpModal(false);
    isPausedRef.current = false;
    setIsPaused(false);
    const isHost = networkRef.current?.role === "HOST";
    let mySnake: Position[];
    let rivalSnake: Position[];

    if (mode === "SOLO") {
      mySnake = [[25, 15], [25, 16], [25, 17]];
      rivalSnake = [];
    } else if (mode === "BOT") {
      // Player bottom-left (going UP), Bot top-right (going DOWN)
      mySnake = [[10, 25], [10, 26], [10, 27]];
      rivalSnake = [[40, 7], [40, 6], [40, 5]];
    } else {
      if (isHost) {
        // Host bottom-left (going UP), Guest top-right (going DOWN)
        mySnake = [[10, 20], [10, 21], [10, 22]];
        rivalSnake = [[40, 12], [40, 11], [40, 10]];
      } else {
        // Guest top-right (going DOWN), Host bottom-left (going UP)
        mySnake = [[40, 12], [40, 11], [40, 10]];
        rivalSnake = [[10, 20], [10, 21], [10, 22]];
      }
    }

    const newWalls = walls || (mode === "PVP" || mode === "BOT" ? [] : generateWalls(GRID_COLS, GRID_ROWS));
    let newFoods: Position[];
    if (foods) {
      newFoods = foods;
    } else {
      const count = mode === "PVP" ? 3 : mode === "BOT" ? 2 : 1;
      newFoods = [];
      for (let i = 0; i < count; i++) {
        newFoods.push(generateFood(GRID_COLS, GRID_ROWS, newWalls, [...mySnake, ...rivalSnake, ...newFoods]));
      }
    }

    Object.assign(engineRef.current, {
      snake: mySnake,
      rivalSnake: rivalSnake,
      gameMode: mode,
      walls: newWalls,
      pendingWalls: [],
      powerUp: null,
      foodCount: 0,
      shockwave: null,
      foods: newFoods,
      direction: (mode === "SOLO" ? "UP" : (mode === "BOT" ? "UP" : (isHost ? "UP" : "DOWN"))) as Direction,
      nextDirection: (mode === "SOLO" ? "UP" : (mode === "BOT" ? "UP" : (isHost ? "UP" : "DOWN"))) as Direction,
      score: 0,
      gameOver: false,
      lastTick: performance.now(),
      particles: [],
      shake: 0,
      glitch: 0,
      rivalPowerUpType: null,
      rivalPowerUpTimer: 0,
      rivalShockwaveHit: false,
      botDirection: "DOWN" as Direction,
      botShockwave: null,
      botShockwaveHit: false,
    });
    setRivalPowerUpInfo({ active: false, timer: 0, type: null });
    setScore(0);
    setIsGameOver(false);
    setDeathSequence(false);
    setIsSpectating(false);
    setRivalDead(false);
    setRivalScore(0);
    setPvpResult(null);
    engineRef.current.rivalDead = false;
    engineRef.current.rivalScore = 0;
    engineRef.current.pvpResult = null;
    setRematchSent(false);
    rematchSentRef.current = false;
    setRematchReceived(false);
    setPowerUpInfo({ active: false, timer: 0, type: null });
    setCurrentMode(mode);

    // START 3S COUNTDOWN
    setCountdown(3);
  };

  const createExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < 20; i++) {
      engineRef.current.particles.push({
        x, y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
        life: 1.0, color, size: Math.random() * 4 + 2,
      });
    }
  };
  // --- Stored map data for HOST (used when GUEST_READY arrives) ---
  const pendingStartRef = useRef<{ walls: Position[], foods: Position[] } | null>(null);

  // --- NETWORK MESSAGE HANDLER ---
  const setupNetworkHandlers = (net: NetworkService) => {
    net.onMessage((msg: NetMessage) => {
      const state = engineRef.current;
      switch (msg.type) {
        case "SNAKE_UPDATE":
          state.rivalSnake = msg.snake;
          if (msg.score !== undefined) {
            state.rivalScore = msg.score;
            setRivalScore(msg.score);
          }
          break;
        case "POWERUP_EATEN":
          state.rivalPowerUpType = msg.pType as PowerUpType;
          state.rivalPowerUpTimer = msg.duration;
          setRivalPowerUpInfo({ active: true, timer: Math.ceil(msg.duration), type: msg.pType as PowerUpType });
          break;
        case "SHOCKWAVE_HIT": {
          // Remove 2 tail segments
          for (let t = 0; t < 2 && state.snake.length > 2; t++) {
            state.snake.pop();
          }
          // Deduct 20 points
          state.score = Math.max(0, state.score - 20);
          setScore(state.score);
          // Strong visual feedback
          state.glitch = 60;
          state.shake = 35;
          setHitNotification(prev => ({ active: true, key: prev.key + 1 }));
          setTimeout(() => setHitNotification(prev => ({ ...prev, active: false })), 2000);
          break;
        }
        case "FOOD_EATEN":
          state.foods = msg.foods;
          if (msg.score !== undefined) {
            state.rivalScore = msg.score;
            setRivalScore(msg.score);
          }
          break;
        case "GUEST_READY":
          // Guest is ready, HOST sends the map data now
          if (net.role === "HOST" && pendingStartRef.current) {
            net.send({ type: "START_GAME", walls: pendingStartRef.current.walls, foods: pendingStartRef.current.foods });
            resetGame("PVP", pendingStartRef.current.walls, pendingStartRef.current.foods);
            gameStartTimeRef.current = Date.now();
            setGamePhase("PLAYING");
            pendingStartRef.current = null;
          }
          break;
        case "START_GAME":
          // GUEST receives the map from HOST
          resetGame("PVP", msg.walls, msg.foods);
          gameStartTimeRef.current = Date.now();
          setGamePhase("PLAYING");
          break;
        case "GAME_OVER":
          // Rival died — remove their snake from the board
          state.rivalSnake = [];
          state.shake = 20;
          state.glitch = 25;
          state.rivalDead = true;
          state.rivalScore = msg.score;
          setRivalDead(true);
          setRivalScore(msg.score);
          if (msg.wallet) setRivalWallet(msg.wallet);

          if (state.gameOver) {
            // I was already dead (spectating), now rival also died → full game over
            // Since I died first, I am the loser
            state.pvpResult = 'LOSE';
            setPvpResult('LOSE');
            setIsGameOver(true);
          } else {
            // I'm still alive, rival died → I AM THE WINNER (but I keep playing)
            state.pvpResult = 'WIN';
            setPvpResult('WIN');
          }
          break;
        case "REMATCH_REQUEST":
          // Rival wants a rematch
          setRematchReceived(true);
          // If I also already requested rematch AND I am HOST → start immediately
          if (rematchSentRef.current && net.role === "HOST") {
            const walls: Position[] = [];
            const allSnakes: Position[] = [[10, 20], [10, 21], [10, 22], [40, 12], [40, 11], [40, 10]];
            const foods: Position[] = [];
            for (let i = 0; i < 3; i++) foods.push(generateFood(GRID_COLS, GRID_ROWS, walls, [...allSnakes, ...foods]));
            net.send({ type: "REMATCH_ACCEPT", walls, foods });
            resetGame("PVP", walls, foods);
            setGamePhase("PLAYING");
          }
          break;
        case "WALLET_INFO":
          console.log("[SnakeGame] received WALLET_INFO:", msg.wallet);
          setRivalWallet(msg.wallet);
          break;
        case "REMATCH_ACCEPT": {
          // HOST sent a new map for the rematch
          resetGame("PVP", msg.walls, msg.foods);
          setGamePhase("PLAYING");
          break;
        }
        // VERDICT_RELAY removed — winner-only XP model, loser does not need verdict
      }
    });
  };

  // --- PVP GAME READY (called when lobby connects) ---
  const handlePvpReady = (net: NetworkService) => {
    networkRef.current = net;
    setMyRole(net.role);
    setupNetworkHandlers(net);
    // Share wallet address with rival
    if (address) net.send({ type: "WALLET_INFO", wallet: address });

    // Handle rival disconnect (refresh, close tab, etc.)
    net.onDisconnected(() => {
      console.log("[NET] Rival disconnected");
      networkRef.current?.destroy();
      networkRef.current = null;

      const state = engineRef.current;

      // If game is active and I'm still alive → rival forfeited, let me keep playing
      if (state.gameMode === "PVP" && !state.gameOver) {
        state.rivalDead = true;
        setRivalDead(true);
        state.pvpResult = 'WIN';
        setPvpResult('WIN');
        // Winner keeps playing until their own snake dies — game over screen will appear then
        return;
      }

      // Lobby, waiting, winner or loser already dead → show disconnect and let useEffect handle redirection
      state.gameOver = true;
      setRivalDisconnected(true);
    });

    // Clean up WebRTC when this tab closes/refreshes
    const handleBeforeUnload = () => {
      networkRef.current?.destroy();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    if (net.role === "HOST") {
      // HOST: Prepare the map but DON'T send yet. Wait for GUEST_READY.
      const walls: Position[] = [];
      const allSnakes: Position[] = [[10, 20], [10, 21], [10, 22], [40, 12], [40, 11], [40, 10]];
      const foods: Position[] = [];
      for (let i = 0; i < 3; i++) foods.push(generateFood(GRID_COLS, GRID_ROWS, walls, [...allSnakes, ...foods]));
      pendingStartRef.current = { walls, foods };
      // Freeze engine while waiting
      engineRef.current.gameOver = true;
      engineRef.current.lastTick = Infinity;
      setGamePhase("WAITING_START");
    } else {
      // GUEST: Freeze engine, then tell HOST we're ready
      engineRef.current.gameOver = true;
      engineRef.current.lastTick = Infinity;
      setGamePhase("WAITING_START");
      // Send GUEST_READY so HOST knows our handler is active
      setTimeout(() => {
        net.send({ type: "GUEST_READY" });
      }, 300);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(e.key) > -1) e.preventDefault();
      const { direction, gameMode, gameOver } = engineRef.current;
      // Space = pause (SOLO and BOT only, not during game over or countdown)
      if (e.key === " " && (gameMode === "SOLO" || gameMode === "BOT") && !gameOver && countdownRef.current === null) {
        isPausedRef.current = !isPausedRef.current;
        setIsPaused(isPausedRef.current);
        return;
      }
      switch (e.key) {
        case "ArrowUp": case "w": case "W": if (direction !== "DOWN") engineRef.current.nextDirection = "UP"; break;
        case "ArrowDown": case "s": case "S": if (direction !== "UP") engineRef.current.nextDirection = "DOWN"; break;
        case "ArrowLeft": case "a": case "A": if (direction !== "RIGHT") engineRef.current.nextDirection = "LEFT"; break;
        case "ArrowRight": case "d": case "D": if (direction !== "LEFT") engineRef.current.nextDirection = "RIGHT"; break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Keep ref in sync with countdown state so the render loop can read it
  useEffect(() => { countdownRef.current = countdown; }, [countdown]);

  // --- COUNTDOWN TIMER LOGIC ---
  useEffect(() => {
    if (countdown === null || countdown <= 0) {
      if (countdown === 0) {
        // Just finished countdown, set to null after 500ms to hide "GO"
        const t = setTimeout(() => setCountdown(null), 500);
        return () => clearTimeout(t);
      }
      return;
    }
    const timer = setInterval(() => {
      setCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // --- RIVAL DISCONNECT REDIRECT ---
  useEffect(() => {
    // If rival disconnected and we are NOT looking at the XP modal,
    // show the disconnected message for 2.5 seconds and go to MENU.
    if (rivalDisconnected && !showXpModal) {
      const timer = setTimeout(() => {
        setRivalDisconnected(false);
        setIsGameOver(false);
        setIsSpectating(false);
        setRivalDead(false);
        setRivalScore(0);
        setPvpResult(null);
        setRematchSent(false);
        rematchSentRef.current = false;
        setRematchReceived(false);
        setGamePhase('MENU');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [rivalDisconnected, showXpModal]);

  // --- NETWORK TICK: Send my snake position every game tick ---
  const sendNetworkUpdate = () => {
    if (networkRef.current?.isConnected && engineRef.current.gameMode === "PVP") {
      networkRef.current.send({
        type: "SNAKE_UPDATE",
        snake: engineRef.current.snake,
        direction: engineRef.current.direction,
        score: engineRef.current.score,
      });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    let animationFrameId: number;

    const render = (time: number) => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const state = engineRef.current;
      const w = rect.width;
      const h = rect.height;
      if (w <= 0 || h <= 0) return; // PROTECTION: Don't process if viewport is 0
      const cellSize = Math.floor(w / 50);

      // --- SCREEN SHAKE & GLITCH ---
      if (state.shake > 0) {
        state.shake *= 0.92;
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
      }
      if (state.glitch > 0) state.glitch *= 0.95;

      // TPS logic
      const speedProgression = state.score * 0.15; 
      const currentSpeed = Math.max(70, INITIAL_SPEED - speedProgression);
      
      // MOVEMENT LOGIC (PAUSED STRICTLY DURING COUNTDOWN OR PAUSE)
      if (countdownRef.current !== null || isPausedRef.current) {
        state.lastTick = time; // Keep resetting lastTick so no time accumulates
      } else if (!state.gameOver && time - state.lastTick > currentSpeed) {
        state.direction = state.nextDirection;
        const head = state.snake[0];
        const newHead: Position = [state.direction === "LEFT" ? head[0]-1 : state.direction === "RIGHT" ? head[0]+1 : head[0],
                                    state.direction === "UP" ? head[1]-1 : state.direction === "DOWN" ? head[1]+1 : head[1]];

        const isGhost = state.powerUp?.active && state.powerUp.type === "GHOST";
        const isWallHit = !isGhost && state.walls.some(w => w[0] === newHead[0] && w[1] === newHead[1]);
        const isSelfHit = !isGhost && state.snake.some(s => s[0] === newHead[0] && s[1] === newHead[1]);
        // In PVP/BOT: collide with rival's body
        const isRivalHit = (state.gameMode === "PVP" || state.gameMode === "BOT") && !isGhost && state.rivalSnake.some(s => s[0] === newHead[0] && s[1] === newHead[1]);
        const isOOB = newHead[0] < 0 || newHead[0] >= Math.floor(w/cellSize) || newHead[1] < 0 || newHead[1] >= Math.floor(h/cellSize);

        if (isWallHit || isSelfHit || isRivalHit || isOOB) {
          state.gameOver = true;
          state.shake = 50; 
          state.glitch = 70;
          setDeathSequence(true); // TRIGGER DEATH SEQUENCE

          // Notify opponent with my score and wallet
          if (networkRef.current?.isConnected) {
            networkRef.current.send({ type: "GAME_OVER", loser: networkRef.current.role, score: state.score, wallet: address });
          }
          // Clear my snake from the board
          state.snake = [];
          
          // DELAY THE MENU UNTIL EFFECTS FINISH
          setTimeout(() => {
            setDeathSequence(false);
            if (state.gameMode === "PVP" || state.gameMode === "BOT") {
              if (state.rivalDead) {
                state.pvpResult = 'WIN';
                setPvpResult('WIN');
                setIsGameOver(true);
              } else {
                state.pvpResult = 'LOSE';
                setPvpResult('LOSE');
                if (state.gameMode === "BOT") {
                  setIsGameOver(true); // in BOT mode, no spectating needed
                } else {
                  setIsSpectating(true);
                }
              }
            } else {
              setIsGameOver(true);
            }
          }, 1500);
        } else {
          state.snake.unshift(newHead);
          
          const isMagnet = state.powerUp?.active && state.powerUp.type === "MAGNET";
          const eatenFoodIdx = state.foods.findIndex(f =>
            (newHead[0] === f[0] && newHead[1] === f[1]) ||
            (isMagnet && Math.sqrt(Math.pow(newHead[0] - f[0], 2) + Math.pow(newHead[1] - f[1], 2)) <= 4)
          );
          const reachFood = eatenFoodIdx !== -1;

          if (reachFood) {
            const eatenFood = state.foods[eatenFoodIdx];
            state.score += 10; state.foodCount++; setScore(state.score);
            state.shake = 8;
            createExplosion(eatenFood[0]*cellSize+cellSize/2, eatenFood[1]*cellSize+cellSize/2, isMagnet ? "#00f0ff" : "#22c55e");
            if (state.foodCount % 5 === 0 && !state.powerUp) {
              const types: PowerUpType[] = ((state.gameMode === "PVP" || state.gameMode === "BOT") && state.rivalDead) ? ["MAGNET", "GHOST"] : ["ERASER", "MAGNET", "GHOST"];
              const pType = types[Math.floor(Math.random() * types.length)];
              state.powerUp = { pos: generatePowerUpPos(GRID_COLS, GRID_ROWS, state.walls, state.snake), type: pType, active: false, timer: 0, spawnTimer: POWERUP_SPAWN_TIMER };
            }
            const newFoodPos = generateFood(Math.floor(w/cellSize), Math.floor(h/cellSize), state.walls, [...state.snake, ...state.rivalSnake, ...state.foods]);
            state.foods = state.foods.map((f, i) => i === eatenFoodIdx ? newFoodPos : f);
            // Tell opponent where new foods are
            if (networkRef.current?.isConnected) {
              networkRef.current.send({ type: "FOOD_EATEN", foods: state.foods, score: state.score });
            }
          } else if (state.powerUp && !state.powerUp.active && newHead[0] === state.powerUp.pos[0] && newHead[1] === state.powerUp.pos[1]) {
            state.powerUp.active = true;
            state.shake = 20;
            if (state.powerUp.type === "ERASER") {
              state.powerUp.timer = POWERUP_DURATION_ERASER; state.pendingWalls = [...state.walls];
              state.shockwave = { x: newHead[0]*cellSize+cellSize/2, y: newHead[1]*cellSize+cellSize/2, radius: 0, maxRadius: Math.max(w,h) };
              state.rivalShockwaveHit = false;
            } else if (state.powerUp.type === "MAGNET") {
              state.powerUp.timer = POWERUP_DURATION_MAGNET;
            } else {
              state.powerUp.timer = POWERUP_DURATION_GHOST;
            }
            createExplosion(newHead[0]*cellSize+cellSize/2, newHead[1]*cellSize+cellSize/2, "#ffffff");
            if (networkRef.current?.isConnected) {
              networkRef.current.send({ type: "POWERUP_EATEN", pType: state.powerUp.type, duration: state.powerUp.timer });
            }
          } else {
            state.snake.pop();
          }
        }
        state.lastTick = time;
        // Send network update every tick
        sendNetworkUpdate();

        // --- BOT TICK ---
        if (state.gameMode === "BOT" && !state.rivalDead && state.rivalSnake.length > 0) {
          const cols = Math.floor(w / cellSize);
          const rows = Math.floor(h / cellSize);
          const isBotGhost = state.rivalPowerUpType === "GHOST" && state.rivalPowerUpTimer > 0;
          const isBotMagnet = state.rivalPowerUpType === "MAGNET" && state.rivalPowerUpTimer > 0;
          // Include power-up as navigation target so the bot actively seeks it
          const botTargets: Position[] = [...state.foods];
          if (state.powerUp && !state.powerUp.active) botTargets.push(state.powerUp.pos);
          state.botDirection = botNextDirection(
            state.rivalSnake, botTargets, state.walls, state.snake,
            cols, rows, state.botDirection
          );
          const botHead = state.rivalSnake[0];
          const bH: Position = [
            state.botDirection === "LEFT" ? botHead[0] - 1 : state.botDirection === "RIGHT" ? botHead[0] + 1 : botHead[0],
            state.botDirection === "UP"   ? botHead[1] - 1 : state.botDirection === "DOWN"  ? botHead[1] + 1 : botHead[1],
          ];
          const botOOB = !isBotGhost && (bH[0] < 0 || bH[0] >= cols || bH[1] < 0 || bH[1] >= rows);
          const botWall = !isBotGhost && state.walls.some(wP => wP[0] === bH[0] && wP[1] === bH[1]);
          const botSelf = !isBotGhost && state.rivalSnake.slice(0, -1).some(s => s[0] === bH[0] && s[1] === bH[1]);
          const botHitPlayer = !isBotGhost && state.snake.some(s => s[0] === bH[0] && s[1] === bH[1]);
          if (botOOB || botWall || botSelf || botHitPlayer) {
            state.rivalSnake = [];
            state.rivalDead = true;
            state.shake = 20; state.glitch = 25;
            engineRef.current.rivalDead = true;
            setRivalDead(true);
            setRivalScore(engineRef.current.rivalScore);
            if (!state.gameOver) { state.pvpResult = 'WIN'; setPvpResult('WIN'); }
          } else {
            state.rivalSnake.unshift(bH);
            // Power-up pickup
            if (state.powerUp && !state.powerUp.active && bH[0] === state.powerUp.pos[0] && bH[1] === state.powerUp.pos[1]) {
              const pType = state.powerUp.type;
              const dur = pType === "ERASER" ? POWERUP_DURATION_ERASER : pType === "MAGNET" ? POWERUP_DURATION_MAGNET : POWERUP_DURATION_GHOST;
              state.rivalPowerUpType = pType;
              state.rivalPowerUpTimer = dur;
              setRivalPowerUpInfo({ active: true, timer: Math.ceil(dur), type: pType });
              createExplosion(bH[0]*cellSize+cellSize/2, bH[1]*cellSize+cellSize/2, "#ffffff");
              if (pType === "ERASER") {
                state.botShockwave = { x: bH[0]*cellSize+cellSize/2, y: bH[1]*cellSize+cellSize/2, radius: 0, maxRadius: Math.max(w, h) };
                state.botShockwaveHit = false;
              }
              state.powerUp = null; // consumed
              // grow (don't pop)
            } else {
              // Food check (with magnet)
              const botAteFood = state.foods.findIndex(f =>
                (f[0] === bH[0] && f[1] === bH[1]) ||
                (isBotMagnet && Math.sqrt(Math.pow(bH[0]-f[0],2)+Math.pow(bH[1]-f[1],2)) <= 4)
              );
              if (botAteFood !== -1) {
                engineRef.current.rivalScore += 10;
                setRivalScore(engineRef.current.rivalScore);
                const newF = generateFood(cols, rows, state.walls, [...state.snake, ...state.rivalSnake, ...state.foods]);
                state.foods = state.foods.map((f, i) => i === botAteFood ? newF : f);
              } else {
                state.rivalSnake.pop();
              }
            }
          }
        }
      }

      // Shockwave/PowerUp smooth logic
      if (state.shockwave) {
        state.shockwave.radius += 18;
        for (let i = state.walls.length - 1; i >= 0; i--) {
          const wP = state.walls[i]; const dx = wP[0]*cellSize+cellSize/2-state.shockwave.x, dy = wP[1]*cellSize+cellSize/2-state.shockwave.y;
          if (Math.sqrt(dx*dx+dy*dy) <= state.shockwave.radius) { createExplosion(wP[0]*cellSize+cellSize/2, wP[1]*cellSize+cellSize/2, "#ef4444"); state.walls.splice(i,1); }
        }
        // PvP/BOT: shockwave hits rival snake (once per shockwave)
        if ((state.gameMode === "PVP" || state.gameMode === "BOT") && !state.rivalShockwaveHit && state.rivalSnake.length > 0) {
          const rivalHit = state.rivalSnake.some(seg => {
            const dx = seg[0]*cellSize+cellSize/2 - state.shockwave!.x;
            const dy = seg[1]*cellSize+cellSize/2 - state.shockwave!.y;
            return Math.sqrt(dx*dx+dy*dy) <= state.shockwave!.radius;
          });
          if (rivalHit) {
            state.rivalShockwaveHit = true;
            if (state.gameMode === "PVP") {
              networkRef.current?.send({ type: "SHOCKWAVE_HIT" });
            } else {
              // BOT: apply damage directly
              for (let t = 0; t < 2 && state.rivalSnake.length > 2; t++) state.rivalSnake.pop();
              engineRef.current.rivalScore = Math.max(0, engineRef.current.rivalScore - 20);
              setRivalScore(engineRef.current.rivalScore);
            }
            for (let t = 1; t <= 2 && state.rivalSnake.length - t >= 0; t++) {
              const seg = state.rivalSnake[state.rivalSnake.length - t];
              createExplosion(seg[0]*cellSize+cellSize/2, seg[1]*cellSize+cellSize/2, "#ff003c");
            }
          }
        }
        if (state.shockwave.radius >= state.shockwave.maxRadius) state.shockwave = null;
      }

      // Bot shockwave (ERASER picked up by bot)
      if (state.botShockwave) {
        state.botShockwave.radius += 18;
        for (let i = state.walls.length - 1; i >= 0; i--) {
          const wP = state.walls[i];
          const dx = wP[0]*cellSize+cellSize/2 - state.botShockwave.x;
          const dy = wP[1]*cellSize+cellSize/2 - state.botShockwave.y;
          if (Math.sqrt(dx*dx+dy*dy) <= state.botShockwave.radius) {
            createExplosion(wP[0]*cellSize+cellSize/2, wP[1]*cellSize+cellSize/2, "#ef4444");
            state.walls.splice(i, 1);
          }
        }
        // Bot shockwave hits player snake (once per shockwave)
        if (!state.botShockwaveHit && state.snake.length > 0) {
          const playerHit = state.snake.some(seg => {
            const dx = seg[0]*cellSize+cellSize/2 - state.botShockwave!.x;
            const dy = seg[1]*cellSize+cellSize/2 - state.botShockwave!.y;
            return Math.sqrt(dx*dx+dy*dy) <= state.botShockwave!.radius;
          });
          if (playerHit) {
            state.botShockwaveHit = true;
            for (let t = 0; t < 2 && state.snake.length > 2; t++) state.snake.pop();
            state.score = Math.max(0, state.score - 20);
            setScore(state.score);
            state.glitch = 60; state.shake = 35;
            setHitNotification(prev => ({ active: true, key: prev.key + 1 }));
            setTimeout(() => setHitNotification(prev => ({ ...prev, active: false })), 2000);
            for (let t = 1; t <= 2 && state.snake.length - t >= 0; t++) {
              const seg = state.snake[state.snake.length - t];
              createExplosion(seg[0]*cellSize+cellSize/2, seg[1]*cellSize+cellSize/2, "#ff003c");
            }
          }
        }
        if (state.botShockwave.radius >= state.botShockwave.maxRadius) state.botShockwave = null;
      }

      if (state.powerUp?.active) {
        state.powerUp.timer -= (1/60);
        setPowerUpInfo({ active: true, timer: Math.max(0, Math.ceil(state.powerUp.timer)), type: state.powerUp.type });
        if (state.powerUp.timer <= 0) {
          if (state.powerUp.type === "ERASER" && !state.shockwave) {
            for (let i = state.pendingWalls.length-1; i>=0; i--) {
              const pW = state.pendingWalls[i]; if (!state.snake.some(s => Math.abs(s[0]-pW[0])<=3 && Math.abs(s[1]-pW[1])<=3)) { state.walls.push(pW); state.pendingWalls.splice(i,1); }
            }
            if (state.pendingWalls.length === 0) state.powerUp = null;
          } else if (state.powerUp.type !== "ERASER") {
            state.powerUp = null;
          }
          if (!state.powerUp) setPowerUpInfo({ active: false, timer: 0, type: null });
        }
      } else if (state.powerUp) {
        state.powerUp.spawnTimer -= (1/60); if (state.powerUp.spawnTimer <= 0) state.powerUp = null;
      }

      if (state.rivalPowerUpTimer > 0) {
        state.rivalPowerUpTimer -= (1/60);
        setRivalPowerUpInfo({ active: true, timer: Math.max(0, Math.ceil(state.rivalPowerUpTimer)), type: state.rivalPowerUpType });
        if (state.rivalPowerUpTimer <= 0) {
          state.rivalPowerUpTimer = 0;
          state.rivalPowerUpType = null;
          setRivalPowerUpInfo({ active: false, timer: 0, type: null });
        }
      }

      // Render
      ctx.fillStyle = "#050510"; ctx.fillRect(0,0,w,h);
      
      // Chromatic Aberration
      const gX = state.glitch > 0 ? (Math.random()-0.5) * (state.glitch/2) : 0;
      const gY = state.glitch > 0 ? (Math.random()-0.5) * (state.glitch/2) : 0;

      // Walls
      state.walls.forEach(wP => {
        ctx.fillStyle="#ff003c"; ctx.shadowBlur=15; ctx.shadowColor="#ff003c"; ctx.beginPath(); ctx.roundRect(wP[0]*cellSize+1+gX, wP[1]*cellSize+1+gY, cellSize-2, cellSize-2, cellSize*0.1); ctx.fill();
        ctx.fillStyle="#050510"; ctx.shadowBlur=0; ctx.fillRect(wP[0]*cellSize+cellSize*0.3+gX, wP[1]*cellSize+cellSize*0.3+gY, cellSize*0.4, cellSize*0.4);
      });

      // PREMIUM POWER-UP RENDERING
      if (state.powerUp && !state.powerUp.active) {
        const { pos, type } = state.powerUp;
        const centerX = pos[0] * cellSize + cellSize / 2 + gX;
        const centerY = pos[1] * cellSize + cellSize / 2 + gY;
        const timeVal = time / 1000;
        
        // Dynamic colors based on type
        const pColor = type === "ERASER" ? "#ffffff" : type === "MAGNET" ? "#00f0ff" : "#3b82f6";
        
        // 1. Core definitions
        const coreSize = cellSize * (0.3 + Math.sin(timeVal * 8) * 0.05);
        const coreGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreSize * 1.5);
        coreGrad.addColorStop(0, "#ffffff");
        coreGrad.addColorStop(0.4, pColor);
        coreGrad.addColorStop(1, "transparent");

        // 2. Draw outer glow aura
        const auraSize = cellSize * (1.2 + Math.sin(timeVal * 4) * 0.2);
        const auraGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, auraSize);
        auraGrad.addColorStop(0, pColor + "44");
        auraGrad.addColorStop(1, "transparent");
        ctx.fillStyle = auraGrad;
        ctx.beginPath(); ctx.arc(centerX, centerY, auraSize, 0, Math.PI * 2); ctx.fill();

        // 2. Draw Rotating Rings
        ctx.strokeStyle = pColor;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = pColor;
        
        // Inner Ring
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, cellSize/2.5, cellSize/5, timeVal * 2.5, 0, Math.PI * 2);
        ctx.stroke();
        
        // Outer Slanted Ring
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, cellSize/2, cellSize/6, -timeVal * 1.8, 0, Math.PI * 2);
        ctx.stroke();

        // 3. UNIQUE GEOMETRY CORE
        ctx.fillStyle = coreGrad;
        ctx.shadowBlur = 25;
        ctx.beginPath();
        
        if (type === "MAGNET") {
          // DIAMOND SHAPE
          ctx.moveTo(centerX, centerY - coreSize * 1.2);
          ctx.lineTo(centerX + coreSize * 1.2, centerY);
          ctx.lineTo(centerX, centerY + coreSize * 1.2);
          ctx.lineTo(centerX - coreSize * 1.2, centerY);
        } else if (type === "ERASER") {
          // HEXAGON SHAPE
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3 - Math.PI / 2;
            ctx.lineTo(centerX + coreSize * 1.3 * Math.cos(angle), centerY + coreSize * 1.3 * Math.sin(angle));
          }
        } else {
          // GHOST (Sharp Star)
          for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const r = i % 2 === 0 ? coreSize * 1.5 : coreSize * 0.5;
            ctx.lineTo(centerX + r * Math.cos(angle + timeVal * 2), centerY + r * Math.sin(angle + timeVal * 2));
          }
        }
        ctx.closePath();
        ctx.fill();

        // 4. TYPE-SPECIFIC ORBITALS
        ctx.shadowBlur = 0;
        ctx.strokeStyle = pColor;
        ctx.lineWidth = 1.5;
        
        if (type === "MAGNET") {
          // Magnetic arcs pulling in/out
          const arcDist = cellSize * 0.4 + Math.sin(timeVal * 10) * 5;
          ctx.beginPath(); ctx.arc(centerX - arcDist, centerY, cellSize/3, -Math.PI/2, Math.PI/2); ctx.stroke();
          ctx.beginPath(); ctx.arc(centerX + arcDist, centerY, cellSize/3, Math.PI/2, -Math.PI/2); ctx.stroke();
        } else if (type === "ERASER") {
          // Pulse rings (like shockwaves)
          const p1 = (time % 1000) / 1000;
          ctx.beginPath(); ctx.arc(centerX, centerY, cellSize * p1, 0, Math.PI * 2); ctx.stroke();
        } else {
          // Floating orbit dots
          for (let i = 0; i < 3; i++) {
            const a = timeVal * 3 + (i * Math.PI * 2) / 3;
            ctx.beginPath(); ctx.arc(centerX + Math.cos(a)*cellSize/2, centerY + Math.sin(a)*cellSize/2, 2, 0, Math.PI*2); ctx.fill();
          }
        }

        // 5. Floating Timer Info (Cleaner)
        ctx.fillStyle = "#fff";
        ctx.font = `900 ${Math.floor(cellSize * 1)}px Monospace`;
        ctx.textAlign = "center";
        ctx.fillText(Math.ceil(state.powerUp.spawnTimer).toString(), centerX, centerY - cellSize + Math.sin(timeVal * 6) * 3);
      }

      // My Snake (Ghost + Glitch) — only render if alive (has segments)
      const isGhostActive = state.powerUp?.active && state.powerUp.type === "GHOST";
      if (state.snake.length > 0) {
        if (isGhostActive) ctx.globalAlpha = 0.4;
        state.snake.forEach((seg, i) => {
          const isHead = i === 0;
          const color = isGhostActive ? "#00f6ff" : (isHead ? "#00f0ff" : `rgb(${Math.floor(112*i/state.snake.length)}, ${Math.floor(240*(1-i/state.snake.length))}, 255)`);
          ctx.shadowBlur = (isHead || isGhostActive || state.glitch > 0) ? 30 : 10; ctx.shadowColor = color; ctx.fillStyle = color;
          const m = cellSize * 0.1;
          ctx.beginPath(); ctx.roundRect(seg[0]*cellSize+m+gX, seg[1]*cellSize+m+gY, cellSize-m*2, cellSize-m*2, isHead?cellSize*0.2:cellSize*0.1); ctx.fill();
          if (isHead) {
            ctx.fillStyle="#fff"; ctx.shadowBlur=15; ctx.beginPath(); ctx.arc(seg[0]*cellSize+cellSize/2+gX, seg[1]*cellSize+cellSize/2+gY, cellSize*0.2, 0, Math.PI*2); ctx.fill();
            if (state.powerUp?.active && state.powerUp.type === "MAGNET") {
              const mP = (time%1000)/1000; ctx.strokeStyle=`rgba(0,240,255,${1-mP})`; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(seg[0]*cellSize+cellSize/2+gX, seg[1]*cellSize+cellSize/2+gY, cellSize*4*mP, 0, Math.PI*2); ctx.stroke();
            }
          }
        });
        if (isGhostActive) ctx.globalAlpha = 1.0;
      }
      
      // Rival Snake (PVP / BOT)
      if ((state.gameMode === "PVP" || state.gameMode === "BOT") && state.rivalSnake.length > 0) {
        const isRivalGhost = state.rivalPowerUpType === "GHOST" && state.rivalPowerUpTimer > 0;
        const isRivalMagnet = state.rivalPowerUpType === "MAGNET" && state.rivalPowerUpTimer > 0;
        if (isRivalGhost) ctx.globalAlpha = 0.4;
        state.rivalSnake.forEach((seg, i) => {
          const isHead = i === 0;
          const color = isRivalGhost ? "#ff69b4" : (isHead ? "#ff003c" : `rgb(255, ${Math.floor(80 + 60*i/state.rivalSnake.length)}, ${Math.floor(60*i/state.rivalSnake.length)})`);
          ctx.shadowBlur = isHead ? 25 : 15; ctx.shadowColor = isRivalGhost ? "#ff69b4" : "#ff003c"; ctx.fillStyle = color;
          const m = cellSize * 0.1;
          ctx.beginPath(); ctx.roundRect(seg[0]*cellSize+m+gX, seg[1]*cellSize+m+gY, cellSize-m*2, cellSize-m*2, isHead?cellSize*0.2:cellSize*0.1); ctx.fill();
          if (isHead) {
            ctx.fillStyle="#fff"; ctx.shadowBlur=10; ctx.beginPath(); ctx.arc(seg[0]*cellSize+cellSize/2+gX, seg[1]*cellSize+cellSize/2+gY, cellSize*0.15, 0, Math.PI*2); ctx.fill();
            if (isRivalMagnet) {
              const mP = (time%1000)/1000; ctx.strokeStyle=`rgba(255,0,60,${1-mP})`; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(seg[0]*cellSize+cellSize/2+gX, seg[1]*cellSize+cellSize/2+gY, cellSize*4*mP, 0, Math.PI*2); ctx.stroke();
            }
          }
        });
        if (isRivalGhost) ctx.globalAlpha = 1.0;
      }
      ctx.globalAlpha = 1.0;

      // Food
      const bS = (cellSize*0.7) * (Math.sin(time/150)*0.15+1);
      ctx.fillStyle="#00ff66"; ctx.shadowBlur=25; ctx.shadowColor="#00ff66";
      state.foods.forEach(f => {
        ctx.beginPath(); ctx.roundRect(f[0]*cellSize+(cellSize-bS)/2+gX, f[1]*cellSize+(cellSize-bS)/2+gY, bS, bS, bS*0.2); ctx.fill();
      });

      // Particles & Shockwaves
      if (state.shockwave) {
        const sw = state.shockwave, op = Math.max(0, 1-(sw.radius/sw.maxRadius));
        ctx.strokeStyle=`rgba(255,255,255,${op*0.8})`; ctx.lineWidth=4; ctx.shadowBlur=30; ctx.shadowColor=`rgba(255,0,60,${op})`;
        ctx.beginPath(); ctx.arc(sw.x+gX, sw.y+gY, sw.radius, 0, Math.PI*2); ctx.stroke();
      }
      if (state.botShockwave) {
        const sw = state.botShockwave, op = Math.max(0, 1-(sw.radius/sw.maxRadius));
        ctx.strokeStyle=`rgba(255,100,255,${op*0.8})`; ctx.lineWidth=4; ctx.shadowBlur=30; ctx.shadowColor=`rgba(112,0,255,${op})`;
        ctx.beginPath(); ctx.arc(sw.x+gX, sw.y+gY, sw.radius, 0, Math.PI*2); ctx.stroke();
      }
      for (let i=state.particles.length-1; i>=0; i--) {
        const p=state.particles[i]; p.x+=p.vx; p.y+=p.vy; p.life-=0.05;
        if (p.life<=0) state.particles.splice(i,1);
        else { ctx.globalAlpha=p.life; ctx.fillStyle=p.color; ctx.shadowColor=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); }
      }
      ctx.globalAlpha=1; ctx.shadowBlur=0;
      animationFrameId = requestAnimationFrame(render);
    };
    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* MENU PRINCIPAL */}
      {gamePhase === 'MENU' && (
        <MainMenu
          onStartSolo={() => {
            setGamePhase('PLAYING');
            resetGame('SOLO');
          }}
          onStartBot={() => {
            setMyRole(null);
            setGamePhase('PLAYING');
            resetGame('BOT');
          }}
          onStartPvp={() => {
            setGamePhase('LOBBY');
          }}
          onLeaderboard={() => {
            setGamePhase('LEADERBOARD');
          }}
        />
      )}

      {/* LEADERBOARD */}
      {gamePhase === 'LEADERBOARD' && (
        <Leaderboard myAddress={address} onBack={() => setGamePhase('MENU')} />
      )}

      {/* PVP LOBBY */}
      {gamePhase === 'LOBBY' && (
        <PvpLobby
          onGameReady={handlePvpReady}
          onBack={() => {
            networkRef.current?.destroy();
            networkRef.current = null;
            setGamePhase('MENU');
          }}
        />
      )}

      {/* WAITING FOR HANDSHAKE */}
      {gamePhase === 'WAITING_START' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050510] overflow-hidden rounded-2xl border-[6px] border-white/5">
          <div className="w-3 h-3 bg-[#ff003c] rounded-full animate-ping mb-6"></div>
          <h2 className="text-3xl font-black text-white tracking-[0.3em] uppercase mb-3">SYNCING_ARENA</h2>
          <p className="text-sm text-white/40 font-mono tracking-wider">Establishing P2P data channel...</p>
        </div>
      )}
      
      {/* SCORE — only during PLAYING phase, hide once game is over */}
      {gamePhase === 'PLAYING' && !isGameOver && (
        <div className="absolute -top-[100px] left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center animate-bounce-subtle">
          <span className="text-[14px] text-[#00f0ff] uppercase tracking-[0.6em] font-black mb-1 opacity-90 drop-shadow-[0_0_8px_#00f0ff]">Sync Score</span>
          <div className="flex items-baseline gap-1">
            <span className="text-7xl text-white font-black drop-shadow-[0_0_25px_#00f0ff]">{score}</span>
            {(currentMode === "PVP" || currentMode === "BOT") && (
              <>
                <span className="text-4xl text-white/30 font-black mx-1">\</span>
                <span className="text-5xl text-[#ff003c]/80 font-black drop-shadow-[0_0_15px_#ff003c]">{rivalScore}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* POWER UP BARS — player left, rival/bot right (except PVP GUEST: player right, rival left) */}
      {powerUpInfo.active && !isGameOver && (
        <div className={`absolute z-30 pointer-events-none animate-slide-in ${myRole === 'GUEST' ? 'right-2' : 'left-2'}`} style={{ top: 'clamp(-60px, -7vw, -90px)', width: 'clamp(180px, 22vw, 280px)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 'clamp(4px, 0.5vw, 8px)' }}>
            <span className="font-black uppercase drop-shadow-[0_0_10px_currentColor] animate-pulse-fast whitespace-nowrap" style={{ fontSize: 'clamp(8px, 1vw, 11px)', letterSpacing: 'clamp(0.1em, 0.2vw, 0.2em)', color: powerUpInfo.type === 'ERASER' ? '#ff003c' : powerUpInfo.type === 'MAGNET' ? '#00f0ff' : '#3b82f6' }}>
              {powerUpInfo.type === "ERASER" ? "HACK_ERASER_ACTIVE" : powerUpInfo.type === "MAGNET" ? "HACK_MAGNET_ACTIVE" : "HACK_GHOST_ACTIVE"}
            </span>
            <span className="text-white font-mono font-bold bg-white/5 rounded-sm border border-white/10" style={{ fontSize: 'clamp(0.8rem, 1.5vw, 1.25rem)', padding: '0 clamp(4px, 0.5vw, 8px)' }}>{powerUpInfo.timer}s</span>
          </div>
          <div className="w-full bg-white/5 rounded-full border border-white/10 overflow-hidden" style={{ height: 'clamp(8px, 1.2vw, 14px)' }}>
            <div className="h-full rounded-full transition-all duration-200 ease-out"
              style={{
                width: `${(powerUpInfo.timer / (powerUpInfo.type === "ERASER" ? POWERUP_DURATION_ERASER : powerUpInfo.type === "MAGNET" ? POWERUP_DURATION_MAGNET : POWERUP_DURATION_GHOST)) * 100}%`,
                background: powerUpInfo.type === "ERASER" ? "linear-gradient(90deg, #ff003c, #ff4d79)" : powerUpInfo.type === "MAGNET" ? "linear-gradient(90deg, #00f0ff, #00ff66)" : "linear-gradient(90deg, #3b82f6, #00f6ff)",
                boxShadow: `0 0 20px ${powerUpInfo.type === 'ERASER' ? '#ff003c' : powerUpInfo.type === 'MAGNET' ? '#00f0ff' : '#3b82f6'}`,
              }}
            ></div>
          </div>
        </div>
      )}

      {/* RIVAL POWER UP BAR */}
      {rivalPowerUpInfo.active && !isGameOver && !deathSequence && (
        <div className={`absolute z-30 pointer-events-none animate-slide-in ${myRole === 'GUEST' ? 'left-2' : 'right-2'}`} style={{ top: 'clamp(-60px, -7vw, -90px)', width: 'clamp(180px, 22vw, 280px)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 'clamp(4px, 0.5vw, 8px)' }}>
            <span className="font-black uppercase drop-shadow-[0_0_10px_currentColor] animate-pulse-fast whitespace-nowrap" style={{ fontSize: 'clamp(8px, 1vw, 11px)', letterSpacing: 'clamp(0.1em, 0.2vw, 0.2em)', color: rivalPowerUpInfo.type === 'ERASER' ? '#ff003c' : rivalPowerUpInfo.type === 'MAGNET' ? '#00f0ff' : '#3b82f6' }}>
              {rivalPowerUpInfo.type === "ERASER" ? "RIVAL_ERASER_ACTIVE" : rivalPowerUpInfo.type === "MAGNET" ? "RIVAL_MAGNET_ACTIVE" : "RIVAL_GHOST_ACTIVE"}
            </span>
            <span className="text-white font-mono font-bold bg-white/5 rounded-sm border border-white/10" style={{ fontSize: 'clamp(0.8rem, 1.5vw, 1.25rem)', padding: '0 clamp(4px, 0.5vw, 8px)' }}>{rivalPowerUpInfo.timer}s</span>
          </div>
          <div className="w-full bg-white/5 rounded-full border border-white/10 overflow-hidden" style={{ height: 'clamp(8px, 1.2vw, 14px)' }}>
            <div className="h-full rounded-full transition-all duration-200 ease-out"
              style={{
                width: `${(rivalPowerUpInfo.timer / (rivalPowerUpInfo.type === "ERASER" ? POWERUP_DURATION_ERASER : rivalPowerUpInfo.type === "MAGNET" ? POWERUP_DURATION_MAGNET : POWERUP_DURATION_GHOST)) * 100}%`,
                background: rivalPowerUpInfo.type === "ERASER" ? "linear-gradient(90deg, #ff003c, #ff4d79)" : rivalPowerUpInfo.type === "MAGNET" ? "linear-gradient(90deg, #00f0ff, #00ff66)" : "linear-gradient(90deg, #3b82f6, #00f6ff)",
                boxShadow: `0 0 20px ${rivalPowerUpInfo.type === 'ERASER' ? '#ff003c' : rivalPowerUpInfo.type === 'MAGNET' ? '#00f0ff' : '#3b82f6'}`,
              }}
            ></div>
          </div>
        </div>
      )}

      {/* GAME BOARD */}
      <div className="absolute inset-0 w-full h-full bg-[#050510] overflow-hidden rounded-2xl group border-[6px] border-white/5 flex flex-col">
        <div className="absolute inset-0 z-10 pointer-events-none rounded-xl border-[3px] border-white/10 shadow-[inset_0_0_40px_rgba(112,0,255,0.2)]"></div>
        <div className="absolute inset-0 z-10 pointer-events-none rounded-xl border-[3px] border-[#00f0ff]/30 animate-pulse"></div>
        <div className="absolute inset-0 z-10 pointer-events-none rounded-xl overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent animate-border-scan-top opacity-70"></div>
          <div className="absolute bottom-0 left-0 w-full h-[4px] bg-gradient-to-r from-transparent via-[#7000ff] to-transparent animate-border-scan-bottom opacity-70"></div>
          <div className="absolute top-0 right-0 w-[4px] h-full bg-gradient-to-b from-transparent via-[#ff003c] to-transparent animate-border-scan-right opacity-70"></div>
          <div className="absolute top-0 left-0 w-[4px] h-full bg-gradient-to-b from-transparent via-[#00f0ff] to-transparent animate-border-scan-left opacity-70"></div>
        </div>
        <canvas ref={canvasRef} className="w-full h-full block" />
        <style jsx>{`
          @keyframes scanTop { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
          @keyframes scanBottom { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
          @keyframes scanRight { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
          @keyframes scanLeft { 0% { transform: translateY(100%); } 100% { transform: translateY(-100%); } }
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
          @keyframes floatUp { 0% { transform: translateY(0) scale(1.4); opacity: 1; } 100% { transform: translateY(-80px) scale(0.8); opacity: 0; } }
          .animate-float-up { animation: floatUp 2s ease-out forwards; }
          
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
        {/* RIVAL DISCONNECTED OVERLAY */}
        {rivalDisconnected && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-[#050510]/80 backdrop-blur-md pointer-events-none">
            <div className="flex flex-col items-center gap-3 animate-slide-in">
              <div className="w-3 h-3 bg-[#ff003c] rounded-full animate-ping"></div>
              <span className="text-2xl font-black text-[#ff003c] tracking-[0.3em] uppercase drop-shadow-[0_0_20px_#ff003c]">RIVAL_DISCONNECTED</span>
              <span className="text-xs font-mono text-white/40 tracking-[0.4em] uppercase animate-pulse">Connection lost — returning to menu...</span>
            </div>
          </div>
        )}

        {/* SHOCKWAVE HIT NOTIFICATION */}
        {hitNotification.active && !isGameOver && (
          <div key={hitNotification.key} className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center animate-float-up">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[56px] font-black text-[#ff4400] drop-shadow-[0_0_30px_#ff4400] leading-none">-20</span>
              <span className="text-[13px] font-black text-[#ff4400]/80 tracking-[0.4em] uppercase">pts</span>
            </div>
          </div>
        )}

        {/* DEATH SEQUENCE OVERLAY (FLASHES & GLITCH) */}
        {deathSequence && gamePhase === 'PLAYING' && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-red-600/20 backdrop-invert-[0.1] animate-death-flash pointer-events-none">
            <div className="flex flex-col items-center">
              <div className="text-[64px] font-black text-white drop-shadow-[0_0_20px_#ff0000] animate-glitch-text italic">
                CORE_BREACHED
              </div>
              <div className="text-[14px] font-mono text-red-100/60 tracking-[1em] animate-pulse">
                FATAL_ERROR: CONNECTION_TERM
              </div>
              {/* Fake scanning line */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-red-400/50 shadow-[0_0_15px_red] animate-scanline"></div>
            </div>
          </div>
        )}

        {/* --- START COUNTDOWN OVERLAY --- */}
        {/* PAUSE OVERLAY */}
        {isPaused && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none bg-black/50 backdrop-blur-sm">
            <span className="text-6xl font-black text-white tracking-[0.3em] uppercase drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">PAUSED</span>
            <span className="mt-3 text-[11px] font-mono text-white/40 tracking-[0.4em] uppercase">Press Space to resume</span>
          </div>
        )}

        {countdown !== null && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden bg-black/10">
            <div className="relative flex flex-col items-center">
              {/* Pulsing ring background */}
              <div className="absolute inset-0 scale-[3] blur-[100px] bg-white/5 rounded-full animate-pulse-slow"></div>
              
              <div key={countdown} className="relative z-10 flex flex-col items-center animate-countdown-bounce">
                {/* Digit */}
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

        {/* PREMIUM GAME OVER OVERLAY */}
        {isGameOver && gamePhase === 'PLAYING' && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden p-2">
            {/* Dark blur backdrop */}
            <div className="absolute inset-0 bg-[#050510]/80 backdrop-blur-xl"></div>

            {/* Main Result Card */}
            <div className="relative w-[90%] max-w-md bg-black/40 border border-white/10 p-4 sm:p-6 rounded-2xl backdrop-blur-2xl shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden animate-slide-in">
              {/* Dynamic Glow Background */}
              <div className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-[100px] opacity-20 ${pvpResult === 'WIN' ? 'bg-[#00ff66]' : 'bg-[#ff003c]'}`}></div>
              <div className={`absolute -bottom-24 -right-24 w-48 h-48 rounded-full blur-[100px] opacity-20 ${pvpResult === 'LOSE' ? 'bg-[#ff003c]' : 'bg-[#00f0ff]'}`}></div>

              {/* Header */}
              <div className="relative z-10 text-center mb-4 sm:mb-6">
                <div className="text-[8px] sm:text-[10px] font-mono text-white/40 tracking-[0.5em] uppercase mb-1">Match_Analysis_Report</div>
                <h2 className={`text-4xl sm:text-5xl font-black italic tracking-tighter uppercase mb-1 drop-shadow-2xl ${
                  engineRef.current.gameMode === "SOLO" ? 'text-white' : (pvpResult === 'WIN' ? 'text-[#00ff66]' : 'text-[#ff003c]')
                }`}>
                  {engineRef.current.gameMode === "SOLO" ? 'FAILURE' : (pvpResult === 'WIN' ? 'VICTORY' : 'DEFEATED')}
                </h2>
                {engineRef.current.gameMode === "BOT" && (
                  <div className="text-[9px] font-mono text-[#7000ff]/70 tracking-[0.4em] uppercase mb-1">vs A.I.</div>
                )}
                <div className={`h-[2px] w-14 mx-auto rounded-full ${
                  engineRef.current.gameMode === "SOLO" ? 'bg-white/20' : (pvpResult === 'WIN' ? 'bg-[#00ff66]/50' : 'bg-[#ff003c]/50')
                }`}></div>
              </div>

              {/* Scoreboard Area */}
              <div className="relative z-10 flex gap-3 mb-4 sm:mb-6">
                {(engineRef.current.gameMode === "PVP" || engineRef.current.gameMode === "BOT") ? (
                  <>
                    {/* Player Info */}
                    <div className={`flex-1 p-3 sm:p-4 rounded-xl border ${pvpResult === 'WIN' ? 'bg-[#00ff66]/5 border-[#00ff66]/30' : 'bg-white/5 border-white/10'}`}>
                      <div className="flex flex-col items-center gap-2">
                        <div className="relative">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 ${pvpResult === 'WIN' ? 'border-[#00ff66] shadow-[0_0_15px_#00ff66]' : 'border-white/20'}`}>
                            {pvpResult === 'WIN' ? (
                              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#00ff66]" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z" /></svg>
                            ) : (
                              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white/40" fill="currentColor" viewBox="0 0 24 24"><path d="M12,2A9,9 0 0,0 3,11C3,14.03 4.53,16.82 7,18.47V22H9V19H11V22H13V19H15V22H17V18.46C19.47,16.81 21,14.03 21,11A9,9 0 0,0 12,2M8,11A2,2 0 0,1 10,13A2,2 0 0,1 8,15A2,2 0 0,1 6,13A2,2 0 0,1 8,11M16,11A2,2 0 0,1 18,13A2,2 0 0,1 16,15A2,2 0 0,1 14,13A2,2 0 0,1 16,11Z" /></svg>
                            )}
                          </div>
                          {pvpResult === 'WIN' && <div className="absolute -top-1 -right-1 bg-[#00ff66] text-black text-[7px] font-black px-1 py-0.5 rounded-sm">MVP</div>}
                        </div>
                        <span className="text-[9px] font-mono text-white/40 tracking-widest">YOU</span>
                        <span className="text-2xl sm:text-3xl font-black text-white">{score}</span>
                      </div>
                    </div>

                    {/* VS divider */}
                    <div className="flex flex-col items-center justify-center font-mono text-white/20 italic text-sm">VS</div>

                    {/* Rival / A.I. Info */}
                    <div className={`flex-1 p-3 sm:p-4 rounded-xl border ${pvpResult === 'LOSE' ? 'bg-[#00ff66]/5 border-[#00ff66]/30' : 'bg-white/5 border-white/10'}`}>
                      <div className="flex flex-col items-center gap-2">
                        <div className="relative">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 ${pvpResult === 'LOSE' ? 'border-[#00ff66] shadow-[0_0_15px_#00ff66]' : 'border-white/20'}`}>
                            {pvpResult === 'LOSE' ? (
                              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#00ff66]" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z" /></svg>
                            ) : (
                              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white/40" fill="currentColor" viewBox="0 0 24 24"><path d="M12,2A9,9 0 0,0 3,11C3,14.03 4.53,16.82 7,18.47V22H9V19H11V22H13V19H15V22H17V18.46C19.47,16.81 21,14.03 21,11A9,9 0 0,0 12,2M8,11A2,2 0 0,1 10,13A2,2 0 0,1 8,15A2,2 0 0,1 6,13A2,2 0 0,1 8,11M16,11A2,2 0 0,1 18,13A2,2 0 0,1 16,15A2,2 0 0,1 14,13A2,2 0 0,1 16,11Z" /></svg>
                            )}
                          </div>
                          {pvpResult === 'LOSE' && <div className="absolute -top-1 -right-1 bg-[#00ff66] text-black text-[7px] font-black px-1 py-0.5 rounded-sm">MVP</div>}
                        </div>
                        <span className="text-[9px] font-mono text-white/40 tracking-widest">
                          {engineRef.current.gameMode === "BOT" ? "A.I." : "RIVAL"}
                        </span>
                        <span className="text-2xl sm:text-3xl font-black text-white">{rivalScore}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full flex flex-col items-center py-4 bg-white/5 border border-white/10 rounded-xl">
                    <span className="text-[9px] font-mono text-white/40 tracking-widest mb-1">FINAL_SCORE</span>
                    <span className="text-5xl sm:text-6xl font-black text-[#00f0ff] drop-shadow-[0_0_20px_rgba(0,240,255,0.5)]">{score}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="relative z-10 flex flex-col gap-2">
                {engineRef.current.gameMode === "BOT" ? (
                  <>
                    <button
                      onClick={() => resetGame("BOT")}
                      className="w-full py-5 font-black tracking-[0.4em] text-sm uppercase transition-all transform active:scale-95 flex items-center justify-center gap-3 rounded-xl bg-[#7000ff] text-white hover:bg-[#9040ff] hover:shadow-[0_0_30px_rgba(112,0,255,0.6)]"
                    >
                      REMATCH_A.I.
                    </button>
                    <button
                      onClick={() => { setGamePhase('MENU'); setIsGameOver(false); }}
                      className="w-full py-4 text-white/40 hover:text-white font-mono text-[10px] tracking-[0.3em] uppercase transition-colors"
                    >
                      ← Back_to_Main_Menu
                    </button>
                  </>
                ) : engineRef.current.gameMode === "PVP" ? (
                  <>
                    {/* REMATCH BUTTON */}
                    {rivalDisconnected ? (
                      <div className="w-full py-4 text-center border border-[#ff003c]/20 bg-[#ff003c]/5 rounded-xl">
                        <span className="text-[10px] font-mono text-[#ff003c] tracking-[0.3em] uppercase animate-pulse">
                          RIVAL_DISCONNECTED
                        </span>
                      </div>
                    ) : !rematchSent ? (
                      <button
                        onClick={() => {
                          if (rematchReceived && networkRef.current) {
                            // Both want rematch: HOST generates new map
                            if (networkRef.current.role === "HOST") {
                              const walls: Position[] = [];
                              const allSnakes: Position[] = [[10, 20], [10, 21], [10, 22], [40, 12], [40, 11], [40, 10]];
                              const foods: Position[] = [];
                              for (let i = 0; i < 3; i++) foods.push(generateFood(GRID_COLS, GRID_ROWS, walls, [...allSnakes, ...foods]));
                              networkRef.current.send({ type: "REMATCH_ACCEPT", walls, foods });
                              resetGame("PVP", walls, foods);
                              setGamePhase("PLAYING");
                            } else {
                              networkRef.current.send({ type: "REMATCH_REQUEST" });
                              setRematchSent(true);
                              rematchSentRef.current = true;
                            }
                          } else {
                            networkRef.current?.send({ type: "REMATCH_REQUEST" });
                            setRematchSent(true);
                            rematchSentRef.current = true;
                          }
                        }}
                        className={`w-full py-3 font-black tracking-[0.3em] text-xs uppercase transition-all transform active:scale-95 flex items-center justify-center gap-2 rounded-lg ${
                          rematchReceived
                            ? 'bg-[#00ff66] text-black hover:shadow-[0_0_30px_rgba(0,255,102,0.6)] animate-pulse'
                            : 'bg-white text-black hover:bg-[#00f0ff] hover:shadow-[0_0_30px_rgba(0,240,255,0.6)]'
                        }`}
                      >
                        <span className="relative z-10">
                          {rematchReceived ? '⚡ ACCEPT_REMATCH' : '🔄 REQUEST_REMATCH'}
                        </span>
                      </button>
                    ) : (
                      <div className="w-full py-3 flex items-center justify-center gap-2 rounded-lg border border-[#00f0ff]/30 bg-[#00f0ff]/5">
                        <div className="w-2 h-2 bg-[#00f0ff] rounded-full animate-pulse"></div>
                        <span className="text-[#00f0ff] font-mono text-xs tracking-widest">WAITING_RIVAL...</span>
                      </div>
                    )}

                    {/* Rival wants rematch notification */}
                    {!rivalDisconnected && rematchReceived && !rematchSent && (
                      <div className="text-center text-[10px] font-mono text-[#00ff66] tracking-widest animate-pulse">
                        ⚡ RIVAL_REQUESTS_REMATCH
                      </div>
                    )}


                    {/* SURRENDER BUTTON */}
                    <button
                      onClick={() => {
                        networkRef.current?.destroy();
                        networkRef.current = null;
                        setGamePhase('MENU');
                        setIsGameOver(false);
                        setIsSpectating(false);
                        setRivalDead(false);
                        setRivalScore(0);
                        setPvpResult(null);
                        setRematchSent(false);
                        rematchSentRef.current = false;
                        setRematchReceived(false);
                      }}
                      className="w-full py-4 text-white/30 hover:text-[#ff003c] font-mono text-[10px] tracking-[0.3em] uppercase transition-colors border border-transparent hover:border-[#ff003c]/20 rounded-xl"
                    >
                      🏳 SURRENDER_&_EXIT
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => resetGame("SOLO")}
                      className="w-full py-5 font-black tracking-[0.4em] text-sm uppercase transition-all transform active:scale-95 flex items-center justify-center gap-3 rounded-xl bg-white text-black hover:bg-[#00f0ff] hover:shadow-[0_0_30px_rgba(0,240,255,0.6)]"
                    >
                      <span className="relative z-10">REBOOT_ENGINE</span>
                    </button>
                    <button
                      onClick={() => setGamePhase('MENU')}
                      className="w-full py-4 text-white/40 hover:text-white font-mono text-[10px] tracking-[0.3em] uppercase transition-colors"
                    >
                      ← Back_to_Main_Menu
                    </button>
                  </>
                )}
              </div>

              {/* Decorative side lines */}
              <div className="absolute top-0 left-10 bottom-0 w-[1px] bg-white/5"></div>
              <div className="absolute top-0 right-10 bottom-0 w-[1px] bg-white/5"></div>
            </div>
          </div>
        )}
      </div>

      {/* PVP SPECTATOR MODE PANEL — loser can watch or leave */}
      {isSpectating && !isGameOver && (
        <div className={`absolute z-30 ${myRole === 'GUEST' ? 'right-2' : 'left-2'}`} style={{ top: 'clamp(-60px, -7vw, -90px)', width: 'clamp(180px, 22vw, 280px)' }}>
          <div className="flex flex-col items-center gap-1 rounded-lg backdrop-blur-sm bg-[#ff003c]/10 border border-[#ff003c]/40" style={{ padding: 'clamp(4px, 0.6vw, 8px) clamp(6px, 0.8vw, 12px)' }}>
            <span className="font-black text-[#ff003c] uppercase animate-pulse whitespace-nowrap pointer-events-none" style={{ fontSize: 'clamp(7px, 0.9vw, 10px)', letterSpacing: 'clamp(0.1em, 0.15vw, 0.2em)' }}>ELIMINATED — SPECTATING</span>
            <button
              onClick={() => {
                networkRef.current?.destroy();
                networkRef.current = null;
                setGamePhase('MENU');
                setIsGameOver(false);
                setIsSpectating(false);
                setRivalDead(false);
                setRivalScore(0);
                setPvpResult(null);
                setRematchSent(false);
                rematchSentRef.current = false;
                setRematchReceived(false);
              }}
              className="w-full py-1 rounded text-center font-mono uppercase tracking-wider transition-all hover:bg-[#ff003c]/30 border border-[#ff003c]/20 hover:border-[#ff003c]/60 text-[#ff003c]/70 hover:text-[#ff003c] cursor-pointer"
              style={{ fontSize: 'clamp(6px, 0.7vw, 9px)' }}
            >
              ✕ LEAVE MATCH
            </button>
          </div>
        </div>
      )}

      {/* PVP WIN BANNER — same position as power-up bars (rival's side) */}
      {pvpResult === 'WIN' && !isGameOver && !isSpectating && (
        <div className={`absolute z-30 pointer-events-none ${myRole === 'GUEST' ? 'left-2' : 'right-2'}`} style={{ top: 'clamp(-60px, -7vw, -90px)', width: 'clamp(180px, 22vw, 280px)' }}>
          <div className="flex items-center justify-center rounded-lg backdrop-blur-sm bg-[#00ff66]/10 border border-[#00ff66]/40" style={{ padding: 'clamp(4px, 0.6vw, 12px) clamp(8px, 1vw, 16px)' }}>
            <span className="font-black text-[#00ff66] uppercase whitespace-nowrap" style={{ fontSize: 'clamp(8px, 1vw, 11px)', letterSpacing: 'clamp(0.1em, 0.2vw, 0.2em)' }}>OPPONENT_ELIMINATED ✓</span>
          </div>
        </div>
      )}

      {/* Game Timer — below game board, all modes */}
      {gameStartTimeRef.current > 0 && gamePhase === 'PLAYING' && !isGameOver && !deathSequence && (
        <div className="absolute left-1/2 -translate-x-1/2 z-20" style={{ bottom: 'clamp(-40px, -4.5vw, -52px)' }}>
          <GameTimer startTime={gameStartTimeRef.current} isRunning={!isGameOver} />
        </div>
      )}
      {/* XP RESULT MODAL — winner only, rendered as a full-screen overlay */}
      {showXpModal && pvpResult === "WIN" && address && (
        <XpResult
          myAddress={address}
          rivalAddress={rivalWallet || ""}
          myScore={score}
          rivalScore={rivalScore}
          pvpResult={pvpResult}
          duration={Math.floor((Date.now() - gameStartTimeRef.current) / 1000)}
          onViewLeaderboard={() => {
            setShowXpModal(false);
            setGamePhase('LEADERBOARD');
          }}
          onClose={() => {
            setShowXpModal(false);
          }}
        />
      )}
    </div>
  );
}
