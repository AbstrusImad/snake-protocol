import json
import gl

class SnakeArenaMultiplayer:
    def __init__(self):
        self.players = {}  # address -> {"xp": int, "last_played_week": int}

    MIN_DURATION = 60
    MAX_DURATION = 900

    XP_MAP = {1: 100, 2: 200, 3: 350, 4: 500, 5: 750}

    @staticmethod
    def _tier_reason(tier: int, position: int, total: int) -> str:
        labels = {1: "Poor", 2: "Fair", 3: "Good", 4: "Great", 5: "Outstanding"}
        return f"{labels[tier]} performance (Tier {tier}), Position {position}/{total}"

    def submit_arena_result(
        self,
        player: str,
        position: int,
        score: int,
        total_players: int,
        player_duration: int,
        match_duration: int,
        week: int,
    ) -> str:
        # Weekly limit
        if player in self.players and self.players[player].get("last_played_week") == week:
            raise Exception("Already played this week")

        # Duration validation
        if player_duration < self.MIN_DURATION:
            raise Exception(f"Game too short: minimum {self.MIN_DURATION}s required")
        if match_duration > self.MAX_DURATION:
            raise Exception(f"Game too long: maximum {self.MAX_DURATION}s allowed")

        # Validate inputs
        if position < 1 or position > total_players:
            raise Exception("Invalid position")
        if total_players < 3 or total_players > 4:
            raise Exception("Arena requires 3-4 players")
        if match_duration <= 0 or player_duration <= 0:
            raise Exception("Invalid duration")

        survival_pct = round(player_duration / match_duration * 100)

        def ask_llm():
            prompt = (
                "You are validating an Arena Snake multiplayer game result.\n\n"
                f"Game data:\n"
                f"- Final position: {position} out of {total_players} players\n"
                f"- Player score: {score} points\n"
                f"- Player survived: {player_duration} seconds\n"
                f"- Total match duration: {match_duration} seconds\n"
                f"- Survival ratio: {survival_pct}%\n\n"
                "Assign a performance tier (1-5):\n"
                "- Position 1 (winner) should get tier 4-5\n"
                "- Position 2 should get tier 3-4\n"
                "- Position 3 should get tier 2-3\n"
                "- Position 4 (last) should get tier 1-2\n"
                "- Adjust within range based on score and survival ratio\n\n"
                "Respond with ONLY valid JSON, no markdown, no explanation:\n"
                '{"tier": <number 1-5>, "valid": true}'
            )
            raw = gl.nondet.exec_prompt(prompt)
            parsed = json.loads(raw)
            return json.dumps(
                {"tier": int(parsed["tier"]), "valid": bool(parsed["valid"])},
                sort_keys=True,
            )

        result_str = gl.eq_principle.strict_eq(ask_llm)
        result = json.loads(result_str)

        if not result.get("valid"):
            raise Exception("Result rejected by validators")

        tier = result["tier"]
        if tier not in self.XP_MAP:
            raise Exception(f"Invalid tier: {tier}")

        xp = self.XP_MAP[tier]
        reason = self._tier_reason(tier, position, total_players)

        if player not in self.players:
            self.players[player] = {"xp": 0, "last_played_week": 0}

        self.players[player]["xp"] += xp
        self.players[player]["last_played_week"] = week

        return json.dumps({"xp": xp, "tier": tier, "reason": reason})

    def get_player_xp(self, player: str) -> int:
        return self.players.get(player, {}).get("xp", 0)

    def get_leaderboard(self) -> str:
        sorted_players = sorted(
            self.players.items(),
            key=lambda x: x[1]["xp"],
            reverse=True,
        )
        return json.dumps(
            [{"address": addr, "xp": data["xp"]} for addr, data in sorted_players[:10]]
        )

    def get_last_played_week(self, player: str) -> int:
        return self.players.get(player, {}).get("last_played_week", 0)
