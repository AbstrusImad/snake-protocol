import Peer, { DataConnection } from "peerjs";
import { Position, Direction } from "./types";

export type NetMessage =
  | { type: "SNAKE_UPDATE"; snake: Position[]; direction: Direction; score?: number }
  | { type: "FOOD_EATEN"; foods: Position[]; score: number }
  | { type: "POWERUP_SPAWN"; pos: Position; pType: string; spawnTimer: number }
  | { type: "POWERUP_EATEN"; pType: string; duration: number }
  | { type: "SHOCKWAVE_HIT" }
  | { type: "GAME_OVER"; loser: "HOST" | "GUEST"; score: number; wallet?: string }
  | { type: "WALLS"; walls: Position[] }
  | { type: "FOOD_POS"; pos: Position }
  | { type: "GUEST_READY" }
  | { type: "START_GAME"; walls: Position[]; foods: Position[] }
  | { type: "REMATCH_REQUEST" }
  | { type: "REMATCH_ACCEPT"; walls: Position[]; foods: Position[] }
  | { type: "WALLET_INFO"; wallet: string };

export type NetworkRole = "HOST" | "GUEST";

export class NetworkService {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private _role: NetworkRole = "HOST";
  private _roomId: string = "";
  private _onMessage: ((msg: NetMessage) => void) | null = null;
  private _onConnected: (() => void) | null = null;
  private _onDisconnected: (() => void) | null = null;
  private _connectionOpen: boolean = false;

  get role() { return this._role; }
  get roomId() { return this._roomId; }
  get isConnected() { return this._connectionOpen; }

  onMessage(handler: (msg: NetMessage) => void) { this._onMessage = handler; }
  onConnected(handler: () => void) { this._onConnected = handler; }
  onDisconnected(handler: () => void) { this._onDisconnected = handler; }

  createRoom(): Promise<string> {
    return new Promise((resolve, reject) => {
      this._role = "HOST";
      const roomCode = "GL-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      
      this.peer = new Peer(roomCode, { debug: 0 });

      this.peer.on("open", (id) => {
        this._roomId = id;
        resolve(id);
      });

      this.peer.on("connection", (connection) => {
        this.conn = connection;
        // Handle both: already open OR not yet open
        const onOpen = () => {
          if (this._connectionOpen) return; // Prevent double-fire
          this._connectionOpen = true;
          this._setupDataHandler();
          console.log("[NET-HOST] Connection open, handler ready");
          if (this._onConnected) this._onConnected();
        };

        if (connection.open) {
          onOpen();
        }
        connection.on("open", onOpen);
      });

      this.peer.on("error", (err) => {
        console.error("[NetworkService] Peer error:", err);
        reject(err);
      });
    });
  }

  joinRoom(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this._role = "GUEST";
      this._roomId = roomId;

      this.peer = new Peer({ debug: 0 });

      this.peer.on("open", () => {
        this.conn = this.peer!.connect(roomId, { reliable: true, serialization: "json" });
        
        const onOpen = () => {
          if (this._connectionOpen) return;
          this._connectionOpen = true;
          this._setupDataHandler();
          console.log("[NET-GUEST] Connection open, handler ready");
          if (this._onConnected) this._onConnected();
          resolve();
        };

        if (this.conn.open) {
          onOpen();
        }
        this.conn.on("open", onOpen);

        this.conn.on("error", (err) => {
          console.error("[NetworkService] Connection error:", err);
          reject(err);
        });
      });

      this.peer.on("error", (err) => {
        console.error("[NetworkService] Peer error:", err);
        reject(err);
      });
    });
  }

  send(msg: NetMessage) {
    if (this.conn && this._connectionOpen) {
      try {
        this.conn.send(msg);
        console.log("[NET] Sent:", msg.type);
      } catch (e) {
        console.error("[NetworkService] Send error:", e);
      }
    } else {
      console.warn("[NetworkService] Cannot send, connection not open. open:", this._connectionOpen);
    }
  }

  destroy() {
    this._connectionOpen = false;
    this._onMessage = null;
    this._onConnected = null;
    this._onDisconnected = null;
    this.conn?.close();
    this.peer?.destroy();
    this.conn = null;
    this.peer = null;
  }

  private _setupDataHandler() {
    if (!this.conn) return;

    this.conn.on("data", (data) => {
      console.log("[NET] Received:", (data as NetMessage).type);
      if (this._onMessage) {
        this._onMessage(data as NetMessage);
      }
    });

    this.conn.on("close", () => {
      this._connectionOpen = false;
      if (this._onDisconnected) this._onDisconnected();
    });
  }
}
