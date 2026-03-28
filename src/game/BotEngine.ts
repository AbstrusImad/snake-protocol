import { Position, Direction } from "./types";

const OPPOSITE: Record<Direction, Direction> = {
  UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT",
};

const DIR_OFFSETS: [Direction, number, number][] = [
  ["UP", 0, -1], ["DOWN", 0, 1], ["LEFT", -1, 0], ["RIGHT", 1, 0],
];

/** BFS from start → nearest target. Returns the first direction to take. */
function bfs(
  start: Position,
  targets: Position[],
  blocked: Set<string>,
  cols: number,
  rows: number
): Direction | null {
  const queue: Array<{ pos: Position; firstDir: Direction | null }> = [
    { pos: start, firstDir: null },
  ];
  const visited = new Set<string>([`${start[0]},${start[1]}`]);

  while (queue.length > 0) {
    const { pos, firstDir } = queue.shift()!;
    for (const [dir, dx, dy] of DIR_OFFSETS) {
      const nx = pos[0] + dx;
      const ny = pos[1] + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      if (blocked.has(key) || visited.has(key)) continue;
      const fDir = firstDir ?? dir;
      if (targets.some((t) => t[0] === nx && t[1] === ny)) return fDir;
      visited.add(key);
      queue.push({ pos: [nx, ny], firstDir: fDir });
    }
  }
  return null;
}

/**
 * Given the current game state, returns the next direction for the bot.
 * Uses BFS toward the nearest food, falls back to any safe direction.
 */
export function botNextDirection(
  botSnake: Position[],
  foods: Position[],
  walls: Position[],
  playerSnake: Position[],
  cols: number,
  rows: number,
  currentDir: Direction
): Direction {
  if (botSnake.length === 0) return currentDir;
  const head = botSnake[0];

  // Build blocked set: walls + bot body (minus tail, which vacates) + player snake
  const blocked = new Set<string>();
  walls.forEach((w) => blocked.add(`${w[0]},${w[1]}`));
  botSnake.slice(0, -1).forEach((s) => blocked.add(`${s[0]},${s[1]}`));
  playerSnake.forEach((s) => blocked.add(`${s[0]},${s[1]}`));

  const dir = bfs(head, foods, blocked, cols, rows);
  if (dir && dir !== OPPOSITE[currentDir]) return dir;

  // Fallback: any safe non-reverse direction
  for (const [d, dx, dy] of DIR_OFFSETS) {
    if (d === OPPOSITE[currentDir]) continue;
    const nx = head[0] + dx;
    const ny = head[1] + dy;
    if (
      nx >= 0 && nx < cols &&
      ny >= 0 && ny < rows &&
      !blocked.has(`${nx},${ny}`)
    ) return d;
  }
  return currentDir; // no safe move → will die on next tick
}
