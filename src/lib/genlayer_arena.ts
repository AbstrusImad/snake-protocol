"use client";

import { createClient, chains } from "genlayer-js";

// Deploy snake_arena_multiplayer.py to get this address
const ARENA_CONTRACT = "0x0eE581Ab08ff732C935dBd44ca07d6a94Db45606" as const; // TODO: fill after deploy

const readClient = createClient({ chain: chains.studionet });

function writeClient(address: string) {
  return createClient({ chain: chains.studionet, account: address as `0x${string}` });
}

export async function submitArenaResult(
  callerAddress: string,
  position: number,
  score: number,
  totalPlayers: number,
  playerDuration: number,
  matchDuration: number
): Promise<{ xp: number; tier: number; reason: string }> {
  if (!ARENA_CONTRACT) throw new Error("Arena contract not deployed yet");

  const currentWeek = Math.floor(Date.now() / 1000 / 604800);
  const client = writeClient(callerAddress);

  const txHash = await client.writeContract({
    address: ARENA_CONTRACT,
    functionName: "submit_arena_result",
    args: [callerAddress, position, score, totalPlayers, playerDuration, matchDuration, currentWeek],
    value: BigInt(0),
  });

  console.log("[ArenaGenLayer] tx submitted:", txHash);

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: "ACCEPTED" as any,
    retries: 60,
    interval: 3000,
  });

  console.log("[ArenaGenLayer] receipt:", JSON.stringify(receipt));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = receipt as any;

  // Check for contract error first
  const stderr: string = r.consensus_data?.leader_receipt?.[0]?.genvm_result?.stderr || "";
  if (stderr.includes("already played")) throw new Error("Already played this week");
  if (stderr.includes("too short")) throw new Error("Game too short");

  let resultStr: string | undefined;
  if (typeof r.data === "string") {
    resultStr = r.data;
  } else if (r.consensus_data?.leader_receipt?.[0]?.result?.payload?.readable) {
    resultStr = r.consensus_data.leader_receipt[0].result.payload.readable;
  }

  if (!resultStr) throw new Error("Contract rejected the result.");

  let parsed = JSON.parse(resultStr);
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  return parsed;
}

export async function getArenaPlayerXp(address: string): Promise<number> {
  if (!ARENA_CONTRACT) return 0;
  const result = await readClient.readContract({
    address: ARENA_CONTRACT,
    functionName: "get_player_xp",
    args: [address],
  });
  return Number(result);
}

export async function getArenaLeaderboard(): Promise<{ address: string; xp: number }[]> {
  if (!ARENA_CONTRACT) return [];
  const raw = await readClient.readContract({
    address: ARENA_CONTRACT,
    functionName: "get_leaderboard",
    args: [],
  });
  return JSON.parse(raw as string);
}
