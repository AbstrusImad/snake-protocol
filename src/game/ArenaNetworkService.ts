import Peer, { DataConnection } from "peerjs";
import { Position, Direction } from "./types";

export interface ArenaPlayer {
  index: number;
  snake: Position[];
  score: number;
  alive: boolean;
  direction: Direction;
  powerUpType: string | null;
  powerUpTimer: number;
}

export interface ArenaGameResult {
  playerIndex: number;
  position: number;       // 1 = winner
  score: number;
  playerDuration: number; // seconds this player survived
  matchDuration: number;  // total match duration
}

export interface ArenaBoardPowerUp {
  pos: Position;
  type: string;
  spawnTimer: number;
}

export type ArenaMessage =
  | { type: "INPUT"; direction: Direction }
  | { type: "FULL_STATE"; players: ArenaPlayer[]; foods: Position[]; tick: number; boardPowerUp: ArenaBoardPowerUp | null }
  | { type: "PLAYER_DIED"; playerIndex: number; score: number; position: number }
  | { type: "GAME_OVER"; results: ArenaGameResult[] }
  | { type: "GAME_START"; myIndex: number; totalPlayers: number; walls: Position[]; initialPlayers: ArenaPlayer[] }
  | { type: "LOBBY_UPDATE"; connectedCount: number; maxPlayers: number }
  | { type: "WALLET_INFO"; wallet: string }
  | { type: "POWERUP_EATEN"; playerIndex: number; pType: string }
  | { type: "SHOCKWAVE_HIT"; targetIndex: number };

export class ArenaNetworkService {
  private peer: Peer | null = null;
  private hostConn: DataConnection | null = null;
  private guestConns: Map<number, DataConnection> = new Map();
  private nextGuestIndex = 1;
  private maxPlayers = 4;

  role: "HOST" | "GUEST" = "GUEST";
  myIndex = 0;
  roomId = "";

  private _onMessage: ((msg: ArenaMessage, fromIndex?: number) => void) | null = null;
  private _onPlayerJoined: ((index: number) => void) | null = null;
  private _onPlayerLeft: ((index: number) => void) | null = null;
  private _onConnected: (() => void) | null = null;

  onMessage(h: (msg: ArenaMessage, fromIndex?: number) => void) { this._onMessage = h; }
  onPlayerJoined(h: (index: number) => void) { this._onPlayerJoined = h; }
  onPlayerLeft(h: (index: number) => void) { this._onPlayerLeft = h; }
  onConnected(h: () => void) { this._onConnected = h; }

  get connectedGuestCount() { return this.guestConns.size; }
  get totalConnected() { return this.role === "HOST" ? this.guestConns.size + 1 : 0; }

  createRoom(maxPlayers = 4): Promise<string> {
    return new Promise((resolve, reject) => {
      this.role = "HOST";
      this.myIndex = 0;
      this.maxPlayers = maxPlayers;
      const roomCode = "AR-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      this.peer = new Peer(roomCode, { debug: 0 });

      this.peer.on("open", (id) => {
        this.roomId = id;
        resolve(id);
      });

      this.peer.on("connection", (conn) => {
        if (this.nextGuestIndex >= this.maxPlayers) {
          conn.close();
          return;
        }
        const guestIndex = this.nextGuestIndex++;

        const onOpen = () => {
          this.guestConns.set(guestIndex, conn);

          conn.on("data", (data) => {
            if (this._onMessage) this._onMessage(data as ArenaMessage, guestIndex);
          });

          conn.on("close", () => {
            this.guestConns.delete(guestIndex);
            if (this._onPlayerLeft) this._onPlayerLeft(guestIndex);
          });

          if (this._onPlayerJoined) this._onPlayerJoined(guestIndex);
          if (this._onConnected) this._onConnected();
        };

        if (conn.open) onOpen();
        else conn.on("open", onOpen);
      });

      this.peer.on("error", reject);
    });
  }

  joinRoom(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.role = "GUEST";
      this.peer = new Peer({ debug: 0 });

      this.peer.on("open", () => {
        this.hostConn = this.peer!.connect(roomId, { reliable: true, serialization: "json" });

        const onOpen = () => {
          this.hostConn!.on("data", (data) => {
            const msg = data as ArenaMessage;
            if (msg.type === "GAME_START") this.myIndex = msg.myIndex;
            if (this._onMessage) this._onMessage(msg);
          });

          this.hostConn!.on("close", () => {
            if (this._onPlayerLeft) this._onPlayerLeft(0);
          });

          if (this._onConnected) this._onConnected();
          resolve();
        };

        if (this.hostConn.open) onOpen();
        else this.hostConn.on("open", onOpen);
        this.hostConn.on("error", reject);
      });

      this.peer.on("error", reject);
    });
  }

  // HOST → all GUESTs
  broadcast(msg: ArenaMessage) {
    this.guestConns.forEach((conn) => {
      if (conn.open) conn.send(msg);
    });
  }

  // HOST → specific GUEST
  sendToPlayer(playerIndex: number, msg: ArenaMessage) {
    const conn = this.guestConns.get(playerIndex);
    if (conn?.open) conn.send(msg);
  }

  // GUEST → HOST
  send(msg: ArenaMessage) {
    if (this.hostConn?.open) this.hostConn.send(msg);
  }

  destroy() {
    this.guestConns.forEach((conn) => conn.close());
    this.guestConns.clear();
    this.hostConn?.close();
    this.peer?.destroy();
    this.hostConn = null;
    this.peer = null;
    this._onMessage = null;
    this._onPlayerJoined = null;
    this._onPlayerLeft = null;
    this._onConnected = null;
  }
}
