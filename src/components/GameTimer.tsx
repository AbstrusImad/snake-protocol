"use client";

import { useState, useEffect } from "react";

interface GameTimerProps {
  startTime: number;
  isRunning: boolean;
}

export default function GameTimer({ startTime, isRunning }: GameTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning || !startTime) return;
    const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isRunning, startTime]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const display = `${mins}:${secs.toString().padStart(2, "0")}`;

  // Color shifts as time progresses: cyan → green (5min+) → orange (12min+) → red (14min+)
  const color =
    elapsed >= 840 ? "#ff003c" :
    elapsed >= 720 ? "#ff9900" :
    elapsed >= 300 ? "#00ff66" :
    "#00f0ff";

  return (
    <div className="flex flex-col items-center">
      <span
        className="font-black font-mono tabular-nums drop-shadow-[0_0_10px_currentColor]"
        style={{ color, fontSize: 'clamp(1rem, 2.5vw, 1.5rem)' }}
      >
        {display}
      </span>
      <span className="font-mono tracking-[0.4em] text-white/30 uppercase" style={{ fontSize: 'clamp(6px, 0.8vw, 8px)' }}>
        Match_Time
      </span>
    </div>
  );
}
