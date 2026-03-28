# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json

# ─── Constants ────────────────────────────────────────────────────────────────
MIN_DURATION  = 60
MAX_DURATION  = 900

# XP tiers — LLM picks a tier (1–5), contract maps to XP
# Winner tiers: 1=100, 2=200, 3=350, 4=500, 5=750
WINNER_XP = {1: 100, 2: 200, 3: 350, 4: 500, 5: 750}


class SnakeArena(gl.Contract):
    xp:                TreeMap[Address, u256]
    last_played_week:  TreeMap[Address, u256]
    weekly_challenge:  str
    challenge_week:    u256

    def __init__(self) -> None:
        self.weekly_challenge = ""
        self.challenge_week   = u256(0)

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _validate_and_tier(self, winner_score: int, loser_score: int, duration: int) -> dict:
        """Ask the LLM to validate the game and assign performance tiers."""
        def ask_llm() -> str:
            prompt = f"""You are a fair referee for a Snake PvP game on the GenLayer blockchain.

Game result:
- Winner score : {winner_score}
- Loser score  : {loser_score}
- Duration     : {duration} seconds

Rules:
1. Set valid to false if duration < {MIN_DURATION} or duration > {MAX_DURATION} seconds.
2. Set valid to false if winner_score < loser_score or either score < 0.
3. If valid, assign a performance tier (integer 1–5) for the winner and the loser:
   - Tier 1 (poor): barely played, very uncompetitive
   - Tier 2 (fair): average match
   - Tier 3 (good): solid performance
   - Tier 4 (great): impressive skill shown
   - Tier 5 (outstanding): exceptional play
   Base tiers on: score gap, duration, and match intensity.

Respond ONLY with this JSON — no markdown, no explanation:
{{"loser_tier": 2, "valid": true, "winner_tier": 3}}"""
            raw = gl.nondet.exec_prompt(prompt)
            raw = raw.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(raw)
            return json.dumps(parsed, sort_keys=True)

        result_str = gl.eq_principle.strict_eq(ask_llm)
        return json.loads(result_str)

    @staticmethod
    def _tier_reason(winner_tier: int, loser_tier: int) -> str:
        labels = {1: "Poor", 2: "Fair", 3: "Good", 4: "Great", 5: "Outstanding"}
        return f"Winner: {labels[winner_tier]} (Tier {winner_tier}), Loser: {labels[loser_tier]} (Tier {loser_tier})"

    # ── Write methods ─────────────────────────────────────────────────────────

    @gl.public.write
    def submit_result(
        self,
        winner:       str,
        loser:        str,
        winner_score: int,
        loser_score:  int,
        duration:     int,
        current_week: int,
    ) -> str:
        """
        Called after a PvP match ends — only the WINNER earns XP.
        The loser is free to play again and earn XP from their own future win.
        current_week = Math.floor(Date.now() / 1000 / 604800) from the frontend.
        """
        winner_addr = Address(winner)
        week        = u256(current_week)

        # ── Weekly limit (winner only) ────────────────────────────────────────
        if winner_addr in self.last_played_week:
            if self.last_played_week[winner_addr] >= week:
                raise Exception("Winner already played this week")

        # ── LLM validation via Optimistic Democracy ───────────────────────────
        verdict = self._validate_and_tier(winner_score, loser_score, duration)

        if not verdict["valid"]:
            raise Exception("Invalid result rejected by AI validators")

        winner_tier = max(1, min(int(verdict["winner_tier"]), 5))
        loser_tier  = max(1, min(int(verdict["loser_tier"]),  5))
        xp_winner   = u256(WINNER_XP[winner_tier])
        reason      = self._tier_reason(winner_tier, loser_tier)

        # ── XP distribution (winner only) ─────────────────────────────────────
        self.xp[winner_addr] = self.xp.get(winner_addr, u256(0)) + xp_winner

        # ── Record this week for winner ───────────────────────────────────────
        self.last_played_week[winner_addr] = week

        return json.dumps({
            "xp_winner": int(xp_winner),
            "reason":    reason,
        })

    @gl.public.write
    def refresh_weekly_challenge(self, current_week: int) -> None:
        """Generates a new weekly challenge via LLM if the week has changed."""
        week = u256(current_week)
        if self.challenge_week == week and self.weekly_challenge != "":
            return

        def generate() -> str:
            prompt = f"""Generate a creative weekly challenge for a Snake PvP mini-game (week #{current_week}).
The challenge must be short, fun, and change how players earn bonus XP this week.

Examples:
- "Speed Run Week: finish under 5 minutes for +20 bonus XP"
- "Giant Slayer: beat an opponent with double your score for +30 bonus XP"
- "Survivor Week: keep the game alive past 12 minutes for +25 bonus XP"

Respond ONLY with this JSON (no markdown):
{{"title": "short title", "description": "one sentence rule", "bonus_xp": 20}}"""
            raw = gl.nondet.exec_prompt(prompt)
            raw = raw.replace("```json", "").replace("```", "").strip()
            return json.dumps(json.loads(raw), sort_keys=True)

        self.weekly_challenge = gl.eq_principle.strict_eq(generate)
        self.challenge_week   = week

    # ── View methods ──────────────────────────────────────────────────────────

    @gl.public.view
    def get_leaderboard(self) -> str:
        players = [
            {"address": addr.as_hex, "xp": int(xp)}
            for addr, xp in self.xp.items()
        ]
        players.sort(key=lambda p: p["xp"], reverse=True)
        return json.dumps(players[:100])

    @gl.public.view
    def get_player_xp(self, player: str) -> int:
        return int(self.xp.get(Address(player), u256(0)))

    @gl.public.view
    def get_last_played_week(self, player: str) -> int:
        addr = Address(player)
        if addr not in self.last_played_week:
            return 0
        return int(self.last_played_week[addr])

    @gl.public.view
    def get_weekly_challenge(self) -> str:
        return self.weekly_challenge
