"use client";

import { createClient, chains } from "genlayer-js";

const CONTRACT = "0xB5918B9F7EF66D522727b29D0a1e42EA6282152F" as const;

// Use SDK's testnetBradbury — rpc-bradbury.genlayer.com supports both gen_call and eth_sendRawTransaction
const readClient = createClient({ chain: chains.testnetBradbury });

function writeClient(address: string) {
  return createClient({
    chain: chains.testnetBradbury,
    account: address as `0x${string}`,
  });
}

// ── Read functions ───────────────────────────────────────────────────────────

export async function getLeaderboard(): Promise<{ address: string; xp: number }[]> {
  const raw = await readClient.readContract({
    address: CONTRACT,
    functionName: "get_leaderboard",
    args: [],
  });
  return JSON.parse(raw as string);
}

export async function getPlayerXp(address: string): Promise<number> {
  const result = await readClient.readContract({
    address: CONTRACT,
    functionName: "get_player_xp",
    args: [address],
  });
  return Number(result);
}

export async function getLastPlayedWeek(address: string): Promise<number> {
  const result = await readClient.readContract({
    address: CONTRACT,
    functionName: "get_last_played_week",
    args: [address],
  });
  return Number(result);
}

export async function getWeeklyChallenge(): Promise<string> {
  const result = await readClient.readContract({
    address: CONTRACT,
    functionName: "get_weekly_challenge",
    args: [],
  });
  return result as string;
}

// ── Write functions ──────────────────────────────────────────────────────────

export async function submitResult(
  callerAddress: string,
  winner: string,
  loser: string,
  winnerScore: number,
  loserScore: number,
  duration: number
): Promise<{ xp_winner: number; xp_loser: number; reason: string }> {
  const currentWeek = Math.floor(Date.now() / 1000 / 604800);
  const client = writeClient(callerAddress);

  // Snapshot XP before tx so we can compute earned XP if receipt has no return value
  const xpBefore = await getPlayerXp(winner).catch(() => 0);

  const txHash = await client.writeContract({
    address: CONTRACT,
    functionName: "submit_result",
    args: [winner, loser, winnerScore, loserScore, duration, currentWeek],
    value: BigInt(0),
  });
  console.log("[GenLayer] tx submitted:", txHash);
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: "ACCEPTED" as any,
    retries: 120,   // 120 × 5s = 10 min max — Bradbury can be slow
    interval: 5000,
  });
  console.log("[GenLayer] receipt:", JSON.stringify(receipt, (_k, v) => typeof v === "bigint" ? v.toString() : v));

  // Read updated XP from contract state after tx
  const xpAfter = await getPlayerXp(winner);
  if (xpAfter <= xpBefore) {
    throw new Error("Winner already played this week");
  }
  const xpEarned = xpAfter - xpBefore;
  return { xp_winner: xpEarned, xp_loser: 0, reason: "AI validators reached consensus" };
}
