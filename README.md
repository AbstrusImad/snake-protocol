# 🐍 Snake Protocol

> A real-time Web3 multiplayer Snake game with AI-validated XP on the GenLayer blockchain.

Players compete in PvP matches and earn on-chain XP validated by GenLayer's **Optimistic Democracy** — a consensus mechanism where multiple AI validators agree on the outcome of each match.

---

## Features

- **3 Game Modes** — Solo, Player vs Bot, and Player vs Player
- **AI-Validated XP** — Smart contract sends match data to GenLayer's AI validator network (Optimistic Democracy on Bradbury Testnet); 5 independent LLM validators reach consensus to assign a performance tier and award XP on-chain
- **Weekly Challenge** — Each wallet can earn XP once per week in PvP mode
- **Global Leaderboard** — Top 100 players ranked by XP earned through the Weekly Challenge PvP mode, stored on-chain
- **Weekly Challenge** — LLM-generated challenge that changes every week
- **Power-ups** — Eraser, Magnet, Ghost with unique mechanics
- **Wallet Gate** — RainbowKit wallet connection required to play

---

## Game Modes

### Solo
Single player mode. Eat food, grow your snake, avoid walls and yourself. No XP reward.

### PvB (Player vs Bot)
Compete against a BFS pathfinding AI. The bot actively seeks food and power-ups. No XP reward.

### PvP (Player vs Player)
Two players compete via **WebRTC P2P** — no server relay, direct browser-to-browser connection.

- Host creates a room and shares a 6-character code
- Guest joins with the code
- Last snake alive wins
- Loser enters spectator mode and watches the winner continue
- **Winner earns on-chain XP** if the match lasted at least 60 seconds

---

## XP System

After a PvP match ends, the winner signs a transaction calling the `submit_result` function on the GenLayer smart contract.

The contract sends the match data to an LLM (via GenLayer's Optimistic Democracy):

```
- Winner score
- Loser score
- Duration (seconds)
```

5 independent AI validators evaluate the match and must reach consensus. They return a **performance tier (1–5)**:

| Tier | Label | XP Awarded |
|------|-------|-----------|
| 1 | Poor | 100 XP |
| 2 | Fair | 200 XP |
| 3 | Good | 350 XP |
| 4 | Great | 500 XP |
| 5 | Outstanding | 750 XP |

The match is **rejected** (0 XP) if:
- Duration < 60s or > 900s
- Winner score < loser score
- Winner already earned XP this week

---

## Power-ups

Power-ups spawn after every 5 foods eaten. They disappear after 12 seconds if not collected.

| Power-up | Color | Duration | Effect |
|----------|-------|----------|--------|
| **Eraser** | White | 9s | Expands a shockwave that destroys all walls and deals -2 segments / -20 pts to the rival |
| **Magnet** | Cyan | 10s | Attracts food within 4-cell radius; auto-collects without touching |
| **Ghost** | Blue | 8s | Pass through walls and rival snakes (30% opacity) |

---

## Smart Contract

**Network:** GenLayer Bradbury Testnet (Chain ID 4221)
**Contract:** `0xB5918B9F7EF66D522727b29D0a1e42EA6282152F`
**Language:** Python (py-genlayer SDK)

### Public Methods

| Method | Type | Description |
|--------|------|-------------|
| `submit_result(winner, loser, winnerScore, loserScore, duration, currentWeek)` | Write | Submit PvP result; LLM validates and awards XP |
| `get_player_xp(address)` | View | Returns player's total XP |
| `get_leaderboard()` | View | Returns top 100 players as JSON |
| `get_last_played_week(address)` | View | Returns the week number of last win |
| `get_weekly_challenge()` | View | Returns current weekly challenge as JSON |
| `refresh_weekly_challenge(currentWeek)` | Write | Generates a new challenge via LLM if week changed |

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 |
| Runtime | React 19 |
| Blockchain SDK | genlayer-js 0.23.1 |
| Wallet | RainbowKit + Wagmi + Viem |
| P2P Networking | PeerJS (WebRTC) |
| Database | PostgreSQL (Neon serverless) |
| Styling | Tailwind CSS v4 |
| Language | TypeScript |

---

## Architecture

```
Browser (Player A)                    Browser (Player B)
       │                                      │
  WebRTC DataChannel ◄────────────────────────┤
       │                                      │
  Canvas 2D Engine                    Canvas 2D Engine
       │                                      │
  On game end (winner)                        │
       │                                      │
  MetaMask / Wallet ──► GenLayer Bradbury RPC
                               │
                    Smart Contract (Python)
                               │
                    5 AI Validators (LLM)
                               │
                    Optimistic Democracy Consensus
                               │
                    XP written on-chain
```

### Networking (WebRTC Messages)

| Message | Direction | Purpose |
|---------|-----------|---------|
| `SNAKE_UPDATE` | Both | Snake position + score every tick |
| `FOOD_EATEN` | Both | New food positions + updated score |
| `POWERUP_EATEN` | Both | Power-up type and duration |
| `SHOCKWAVE_HIT` | Both | Notify rival of shockwave damage |
| `GAME_OVER` | Both | Loser notifies winner with score and wallet address |
| `START_GAME` | Host → Guest | Map data (walls, foods) to start match |
| `REMATCH_REQUEST` | Both | Request a rematch |
| `REMATCH_ACCEPT` | Host → Guest | New map for rematch |
| `WALLET_INFO` | Both | Share wallet address with rival |

---

## Project Structure

```
snake-app/
├── contracts/
│   └── snake_arena.py              # GenLayer intelligent contract
├── src/
│   ├── app/
│   │   ├── page.tsx                # Landing page + wallet gate + main layout
│   │   ├── Providers.tsx           # RainbowKit + Wagmi configuration
│   │   └── api/rooms/              # Room management API (PostgreSQL)
│   ├── components/
│   │   ├── SnakeGame.tsx           # Main game engine + all game logic
│   │   ├── MainMenu.tsx            # Mode selection screen
│   │   ├── PvpLobby.tsx            # Room create/join + RoomsList
│   │   ├── XpResult.tsx            # Post-match XP modal
│   │   ├── Leaderboard.tsx         # Global rankings
│   │   ├── GameTimer.tsx           # Elapsed time display
│   │   └── GameWrapper.tsx         # SSR-disabled wrapper
│   ├── game/
│   │   ├── types.ts                # TypeScript interfaces
│   │   ├── constants.ts            # Game constants (speed, grid, timers)
│   │   ├── utils.ts                # Wall/food generation helpers
│   │   ├── BotEngine.ts            # BFS pathfinding AI
│   │   └── NetworkService.ts       # PvP WebRTC networking
│   └── lib/
│       ├── genlayer.ts             # Contract read/write (PvP)
│       └── db.ts                   # Room persistence (PostgreSQL)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A wallet with GEN tokens on Bradbury testnet
- Neon (PostgreSQL) database URL

### Install

```bash
cd snake-app
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
DATABASE_URL=your_neon_postgres_connection_string
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), connect your wallet, and play.

---

## GenLayer Bradbury Testnet

| Field | Value |
|-------|-------|
| Chain ID | 4221 |
| RPC | `https://rpc-bradbury.genlayer.com` |
| Explorer | `https://explorer-bradbury.genlayer.com` |
| Currency | GEN |

Get testnet GEN from the [GenLayer faucet](https://faucet.genlayer.com).

---

Made by [iAbstrus](https://x.com/iAbstrus)

Powered by [GenLayer](https://genlayer.com)
