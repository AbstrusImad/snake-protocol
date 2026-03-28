import { Position } from "./types";

export const safeLeft = (x: number, max: number) => Math.max(0, Math.min(max - 1, x));
export const safeTop = (y: number, max: number) => Math.max(0, Math.min(max - 1, y));

export const generateWalls = (cols: number, rows: number): Position[] => {
  const walls: Position[] = [];
  const numObstacles = 9;
  
  const midX = Math.floor(cols / 2);
  const midY = Math.floor(rows / 2);
  const safeRadius = 7;
  const minDistBetween = 8;

  const centers: Position[] = [];

  for (let i = 0; i < numObstacles; i++) {
    let startX = 0, startY = 0;
    let valid = false;
    let attempts = 0;
    
    while (!valid && attempts < 100) {
      startX = Math.floor(Math.random() * (cols - 10)) + 5;
      startY = Math.floor(Math.random() * (rows - 10)) + 5;
      attempts++;

      if (Math.abs(startX - midX) < safeRadius && Math.abs(startY - midY) < safeRadius) continue;

      const tooClose = centers.some(c => 
        Math.abs(c[0] - startX) < minDistBetween && Math.abs(c[1] - startY) < minDistBetween
      );
      if (!tooClose) valid = true;
    }

    if (!valid) continue;
    centers.push([startX, startY]);

    const type = Math.floor(Math.random() * 4);
    const len = Math.floor(Math.random() * 3) + 3;

    if (type === 0) { // Horizontal
      for (let j = 0; j < len; j++) walls.push([Math.min(cols-1, startX + j), startY]);
    } else if (type === 1) { // Vertical
      for (let j = 0; j < len; j++) walls.push([startX, Math.min(rows-1, startY + j)]);
    } else if (type === 2) { // L-Shape 
      const dirX = Math.random() > 0.5 ? 1 : -1;
      const dirY = Math.random() > 0.5 ? 1 : -1;
      for (let j = 0; j < len; j++) walls.push([safeLeft(startX + (j * dirX), cols), startY]);
      for (let j = 1; j < len; j++) walls.push([startX, safeTop(startY + (j * dirY), rows)]);
    } else { // Cruz / Plus
      for (let j = -Math.floor(len/2); j <= Math.floor(len/2); j++) {
        walls.push([safeLeft(startX + j, cols), startY]);
        walls.push([startX, safeTop(startY + j, rows)]);
      }
    }
  }

  const uniqueWalls = new Set(walls.map(w => `${w[0]},${w[1]}`));
  return Array.from(uniqueWalls).map(str => {
    const [x, y] = str.split(",");
    return [parseInt(x, 10), parseInt(y, 10)] as Position;
  });
};

export const generatePowerUpPos = (limitX: number, limitY: number, walls: Position[] = [], snake: Position[] = []): Position => {
  const margin = 2;
  let pos: Position = [0, 0];
  let isOccupied = true;
  let attempts = 0;
  while (isOccupied && attempts < 200) {
    pos = [
      margin + Math.floor(Math.random() * (limitX - margin * 2)),
      margin + Math.floor(Math.random() * (limitY - margin * 2)),
    ];
    const inSnake = snake.some(s => s[0] === pos[0] && s[1] === pos[1]);
    const inWall = walls.some(w => w[0] === pos[0] && w[1] === pos[1]);
    isOccupied = inSnake || inWall;
    attempts++;
  }
  return pos;
};

export const generateFood = (limitX: number, limitY: number, walls: Position[] = [], snake: Position[] = []): Position => {
  let newFood: Position = [0, 0];
  let isOccupied = true;
  let attempts = 0;
  
  while(isOccupied && attempts < 200) {
    newFood = [
      Math.floor(Math.random() * limitX),
      Math.floor(Math.random() * limitY)
    ];
    const inSnake = snake.some(s => s[0] === newFood[0] && s[1] === newFood[1]);
    const inWall = walls.some(w => w[0] === newFood[0] && w[1] === newFood[1]);
    
    isOccupied = inSnake || inWall;
    attempts++;
  }
  return newFood;
};
