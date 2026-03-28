"use client";

import { useState, useEffect, useCallback } from "react";

interface Room {
  id: string;
  created_at: string;
}

interface RoomsListProps {
  onJoin: (roomCode: string) => void;
  onBack: () => void;
}

export default function RoomsList({ onJoin, onBack }: RoomsListProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/rooms");
      const data = await res.json();
      setRooms(data);
    } catch {
      // silently ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-sm px-8">
      <div className="text-[10px] text-white/40 font-mono tracking-widest uppercase text-center">
        Available Rooms
      </div>

      <div className="w-full flex flex-col gap-2 max-h-52 overflow-y-auto">
        {loading && (
          <div className="text-center text-white/30 font-mono text-xs py-6 animate-pulse">
            Scanning network...
          </div>
        )}

        {!loading && rooms.length === 0 && (
          <div className="text-center text-white/30 font-mono text-xs py-6">
            No open rooms. Create one!
          </div>
        )}

        {!loading && rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => onJoin(room.id)}
            className="group w-full py-3 px-4 bg-[#7000ff]/5 border border-[#7000ff]/30 hover:border-[#7000ff] hover:bg-[#7000ff]/10 transition-all text-left"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-white tracking-[0.2em] font-mono group-hover:text-[#7000ff] transition-colors">
                {room.id}
              </span>
              <span className="text-[9px] text-white/30 font-mono">JOIN →</span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 w-full">
        <button
          onClick={fetchRooms}
          className="flex-1 py-2 bg-white/5 border border-white/10 hover:border-white/30 text-white/50 hover:text-white font-mono text-xs tracking-widest transition-all"
        >
          ↻ REFRESH
        </button>
        <button
          onClick={onBack}
          className="flex-1 py-2 text-white/30 hover:text-white/70 text-sm font-mono tracking-widest transition-colors"
        >
          ← BACK
        </button>
      </div>
    </div>
  );
}
