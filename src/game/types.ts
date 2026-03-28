export type Position = [number, number];
export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export type PowerUpType = "ERASER" | "MAGNET" | "GHOST";

export interface PowerUp {
  pos: Position;
  type: PowerUpType;
  active: boolean;
  timer: number; // segundos activos
  spawnTimer: number; // segundos para desaparecer si no se come
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
}

export interface GameEngineState {
  snake: Position[];
  rivalSnake: Position[];
  gameMode: "SOLO" | "PVP" | "BOT";
  walls: Position[];
  pendingWalls: Position[];
  powerUp: PowerUp | null;
  foodCount: number;
  shockwave: Shockwave | null;
  foods: Position[];
  direction: Direction;
  nextDirection: Direction;
  score: number;
  gameOver: boolean;
  lastTick: number;
  particles: Particle[];
}
