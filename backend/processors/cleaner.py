"""
backend/processors/cleaner.py

Transforms raw API responses from Football-Data.org and SofaScore
into clean, flat Python dicts that map to SQLAlchemy models and
AI summarizer context objects.

No database interaction here — functions take raw dicts, return clean dicts.
Pipeline: scraper → cleaner → db writer / summarizer

Session 15 change:
    clean_match_incidents() now filters out events where the player name
    is "Unknown" from the events_text string sent to the AI.
    The raw goals/cards/substitutions lists retain all events (including
    Unknown ones) so the DB writer has complete data. Only the events_text
    string — which is what the AI reads — strips Unknown-player events.
    This prevents the AI from writing "Unknown received a yellow card" in
    the narrative, which degrades output quality.
"""

from datetime import datetime
from typing import Optional
from backend.processors.formation_roles import map_tactical_roles


# -------------------------------------------------------------------------
# Utility helpers
# -------------------------------------------------------------------------

def _safe_get(d: dict, *keys, default=None):
    """
    Safely traverses a nested dict using a chain of keys.
    Returns default if any key is missing or value is None.
    """
    for key in keys:
        if not isinstance(d, dict):
            return default
        d = d.get(key)
        if d is None:
            return default
    return d


def _parse_utc_date(date_str: Optional[str]) -> Optional[datetime]:
    """
    Converts Football-Data.org UTC date string to Python datetime.
    Format: "2024-01-15T20:00:00Z"
    Returns None if missing or unparseable.
    """
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str.replace("Z", ""), "%Y-%m-%dT%H:%M:%S")
    except ValueError:
        return None


# -------------------------------------------------------------------------
# Football-Data.org cleaners
# -------------------------------------------------------------------------

def clean_competition(raw: dict) -> dict:
    return {
        "id":      raw.get("id"),
        "name":    raw.get("name"),
        "code":    raw.get("code"),
        "country": _safe_get(raw, "area", "name", default="Unknown"),
    }


def clean_team(raw: dict) -> dict:
    return {
        "id":         raw.get("id"),
        "name":       raw.get("name", "Unknown"),
        "short_name": raw.get("shortName") or raw.get("name", "Unknown"),
        "tla":        raw.get("tla", "???"),
    }


def clean_match(raw: dict, competition_id: int) -> dict:
    """
    Flattens a raw match dict.
    Scheduled matches store None scores to avoid implying 0-0.
    """
    status = raw.get("status", "UNKNOWN")

    if status == "FINISHED":
        home_score = _safe_get(raw, "score", "fullTime", "home", default=None)
        away_score = _safe_get(raw, "score", "fullTime", "away", default=None)
    else:
        home_score = None
        away_score = None

    return {
        "id":             raw.get("id"),
        "competition_id": competition_id,
        "home_team_id":   _safe_get(raw, "homeTeam", "id"),
        "away_team_id":   _safe_get(raw, "awayTeam", "id"),
        "matchday":       raw.get("matchday"),
        "status":         status,
        "utc_date":       _parse_utc_date(raw.get("utcDate")),
        "home_score":     home_score,
        "away_score":     away_score,
    }


def clean_player(raw: dict, team_id: int) -> dict:
    return {
        "id":          raw.get("id"),
        "name":        raw.get("name", "Unknown"),
        "position":    raw.get("position", "Unknown"),
        "nationality": raw.get("nationality", "Unknown"),
        "team_id":     team_id,
    }


def clean_competitions(raw_list: list) -> list:
    return [clean_competition(c) for c in raw_list if c.get("id")]


def clean_teams_from_matches(raw_matches: list) -> list:
    seen_ids = set()
    teams = []
    for match in raw_matches:
        for key in ["homeTeam", "awayTeam"]:
            raw_team = match.get(key, {})
            team_id = raw_team.get("id")
            if team_id and team_id not in seen_ids:
                seen_ids.add(team_id)
                teams.append(clean_team(raw_team))
    return teams


def clean_matches(raw_matches: list, competition_id: int) -> list:
    return [clean_match(m, competition_id) for m in raw_matches if m.get("id")]


# -------------------------------------------------------------------------
# SofaScore cleaners
# -------------------------------------------------------------------------

def clean_sofascore_stats(raw_stats: dict, home_team: str,
                           away_team: str) -> dict:
    """
    Flattens the SofaScore statistics dict into a structured context
    object ready for the AI summarizer.
    """
    if not raw_stats:
        return {}

    def _extract(key: str, side: str):
        stat = raw_stats.get(key, {})
        return stat.get(side)

    home = {
        "possession":          _extract("ballPossession", "home"),
        "xg":                  _extract("expectedGoals", "home"),
        "big_chances":         _extract("bigChances", "home"),
        "total_shots":         _extract("totalShots", "home"),
        "shots_on_target":     _extract("shotsOnTarget", "home"),
        "shots_off_target":    _extract("shotsOffTarget", "home"),
        "shots_inside_box":    _extract("shotsInsideBox", "home"),
        "passes":              _extract("passes", "home"),
        "accurate_passes":     _extract("accuratePasses", "home"),
        "long_balls":          _extract("longBalls", "home_display"),
        "crosses":             _extract("crosses", "home_display"),
        "final_third_entries": _extract("finalThirdEntries", "home"),
        "tackles":             _extract("totalTackles", "home"),
        "tackles_won_pct":     _extract("tacklesWon", "home_display"),
        "interceptions":       _extract("interceptions", "home"),
        "recoveries":          _extract("recoveries", "home"),
        "clearances":          _extract("clearances", "home"),
        "aerial_duels":        _extract("aerialDuels", "home_display"),
        "ground_duels":        _extract("groundDuels", "home_display"),
        "dribbles":            _extract("dribbles", "home_display"),
        "fouls":               _extract("fouls", "home"),
        "yellow_cards":        _extract("yellowCards", "home"),
        "goalkeeper_saves":    _extract("goalKeeperSaves", "home"),
        "goals_prevented":     _extract("goalsPrevented", "home"),
    }

    away = {
        "possession":          _extract("ballPossession", "away"),
        "xg":                  _extract("expectedGoals", "away"),
        "big_chances":         _extract("bigChances", "away"),
        "total_shots":         _extract("totalShots", "away"),
        "shots_on_target":     _extract("shotsOnTarget", "away"),
        "shots_off_target":    _extract("shotsOffTarget", "away"),
        "shots_inside_box":    _extract("shotsInsideBox", "away"),
        "passes":              _extract("passes", "away"),
        "accurate_passes":     _extract("accuratePasses", "away"),
        "long_balls":          _extract("longBalls", "away_display"),
        "crosses":             _extract("crosses", "away_display"),
        "final_third_entries": _extract("finalThirdEntries", "away"),
        "tackles":             _extract("totalTackles", "away"),
        "tackles_won_pct":     _extract("tacklesWon", "away_display"),
        "interceptions":       _extract("interceptions", "away"),
        "recoveries":          _extract("recoveries", "away"),
        "clearances":          _extract("clearances", "away"),
        "aerial_duels":        _extract("aerialDuels", "away_display"),
        "ground_duels":        _extract("groundDuels", "away_display"),
        "dribbles":            _extract("dribbles", "away_display"),
        "fouls":               _extract("fouls", "away"),
        "yellow_cards":        _extract("yellowCards", "away"),
        "goalkeeper_saves":    _extract("goalKeeperSaves", "away"),
        "goals_prevented":     _extract("goalsPrevented", "away"),
    }

    hints = []

    home_xg          = _extract("expectedGoals", "home") or 0
    away_xg          = _extract("expectedGoals", "away") or 0
    home_shots       = _extract("totalShots", "home") or 0
    away_shots       = _extract("totalShots", "away") or 0
    home_poss        = _extract("ballPossession", "home") or 0
    away_poss        = _extract("ballPossession", "away") or 0
    home_recoveries  = _extract("recoveries", "home") or 0
    away_recoveries  = _extract("recoveries", "away") or 0
    home_final_third = _extract("finalThirdEntries", "home") or 0
    away_final_third = _extract("finalThirdEntries", "away") or 0

    if home_xg and away_xg:
        if home_xg < away_xg:
            hints.append(
                f"{home_team} underperformed their xG ({home_xg}) vs "
                f"{away_team}'s xG ({away_xg}) — {away_team} created "
                f"the better chances despite the result."
            )
        elif home_xg > away_xg * 1.5:
            hints.append(
                f"{home_team} dominated in expected goals ({home_xg} vs "
                f"{away_xg}) — their attacking pressure was significant."
            )

    if home_poss and away_poss:
        dominant = home_team if home_poss > away_poss else away_team
        dominant_poss = max(home_poss, away_poss)
        other = away_team if home_poss > away_poss else home_team
        other_shots = away_shots if home_poss > away_poss else home_shots
        if dominant_poss > 60 and other_shots > 10:
            hints.append(
                f"{other} was dangerous without the ball — despite {dominant} "
                f"holding {dominant_poss}% possession, {other} still generated "
                f"{other_shots} shots suggesting a counter-attacking threat."
            )

    if home_recoveries and away_recoveries:
        if home_recoveries > away_recoveries * 1.3:
            hints.append(
                f"{home_team} pressed aggressively — {home_recoveries} ball "
                f"recoveries vs {away_team}'s {away_recoveries} suggests "
                f"a high-intensity pressing game."
            )
        elif away_recoveries > home_recoveries * 1.3:
            hints.append(
                f"{away_team} were the more aggressive pressers — "
                f"{away_recoveries} recoveries vs {home_team}'s {home_recoveries}."
            )

    if home_final_third and away_final_third:
        if away_final_third > home_final_third * 1.5:
            hints.append(
                f"{away_team} consistently threatened in the final third — "
                f"{away_final_third} entries vs {home_team}'s {home_final_third}."
            )
        elif home_final_third > away_final_third * 1.5:
            hints.append(
                f"{home_team} dominated in the attacking third — "
                f"{home_final_third} final third entries vs {away_final_third}."
            )

    return {
        "home_team":       home_team,
        "away_team":       away_team,
        "home":            home,
        "away":            away,
        "narrative_hints": hints,
    }


def clean_sofascore_lineups(raw_lineups: dict) -> dict:
    """
    Cleans and structures lineup data from SofaScore.
    Filters starters from substitutes, assigns tactical roles.
    """
    if not raw_lineups:
        return {}

    position_map = {
        "G": "Goalkeeper",
        "D": "Defender",
        "M": "Midfielder",
        "F": "Forward",
    }

    def _format_player(p: dict) -> dict:
        return {
            "id":            p.get("id"),
            "name":          p.get("name", "Unknown"),
            "short_name":    p.get("short_name", ""),
            "position":      position_map.get(p.get("position", ""), p.get("position", "Unknown")),
            "jersey_number": p.get("jersey_number", "?"),
        }

    def _split_starters_subs(players: list) -> tuple[list, list]:
        starters = [p for p in players if not p.get("substitute", True)]
        subs     = [p for p in players if p.get("substitute", False)]
        if not starters:
            starters = players[:11]
            subs     = players[11:]
        return starters, subs

    home_formation = raw_lineups.get("home_formation", "Unknown")
    away_formation = raw_lineups.get("away_formation", "Unknown")

    home_all = raw_lineups.get("home_players", [])
    away_all = raw_lineups.get("away_players", [])

    home_starters_raw, home_subs_raw = _split_starters_subs(home_all)
    away_starters_raw, away_subs_raw = _split_starters_subs(away_all)

    home_starters = [_format_player(p) for p in home_starters_raw]
    away_starters = [_format_player(p) for p in away_starters_raw]
    home_subs     = [_format_player(p) for p in home_subs_raw]
    away_subs     = [_format_player(p) for p in away_subs_raw]

    home_starters = map_tactical_roles(home_starters, home_formation)
    away_starters = map_tactical_roles(away_starters, away_formation)

    return {
        "confirmed":        raw_lineups.get("confirmed", False),
        "home_formation":   home_formation,
        "away_formation":   away_formation,
        "home_players":     home_starters,
        "away_players":     away_starters,
        "home_substitutes": home_subs,
        "away_substitutes": away_subs,
    }


def clean_match_incidents(raw_incidents: dict, home_team: str,
                           away_team: str) -> dict:
    """
    Parses the raw SofaScore incidents response into structured
    goals, cards, and substitutions.

    Session 15 change: events_text now filters out any event where
    the player name is "Unknown". The raw goals/cards/substitutions
    lists still contain all events — the DB writer needs complete data.
    Only events_text (the AI-readable string) is filtered, so the model
    never writes "Unknown received a yellow card" in the narrative.

    WHY SEPARATE LISTS FROM events_text:
        The raw lists go to the DB via writer.py — we want the full record
        there even if the player name is unknown. events_text goes directly
        into the LLM prompt — we want clean, named events only.
        Filtering at the prompt-building level (not the data level) keeps
        the data layer complete while improving AI output quality.
    """
    if not raw_incidents:
        return {}

    incidents = raw_incidents.get("incidents", [])
    if not incidents:
        return {}

    incidents_sorted = sorted(incidents, key=lambda x: x.get("time", 0))

    goals         = []
    cards         = []
    substitutions = []

    for inc in incidents_sorted:
        inc_type = inc.get("incidentType")
        minute   = inc.get("time", 0)
        is_home  = inc.get("isHome", True)
        team     = home_team if is_home else away_team

        if inc_type == "goal":
            scorer     = inc.get("player", {}).get("name", "Unknown")
            assist     = inc.get("assist1", {}).get("name") if inc.get("assist1") else None
            goal_class = inc.get("incidentClass", "regular")
            goals.append({
                "minute": minute,
                "scorer": scorer,
                "assist": assist,
                "team":   team,
                "type":   goal_class,
            })

        elif inc_type == "card":
            player    = inc.get("player", {}).get("name", "Unknown")
            card_class = inc.get("incidentClass", "yellow")
            reason    = inc.get("reason", "")
            cards.append({
                "minute":    minute,
                "player":    player,
                "team":      team,
                "card_type": card_class,
                "reason":    reason,
            })

        elif inc_type == "substitution":
            player_off = inc.get("playerOut", {}).get("name", "Unknown")
            player_on  = inc.get("playerIn",  {}).get("name", "Unknown")
            injury     = inc.get("injury", False)
            substitutions.append({
                "minute":    minute,
                "player_off": player_off,
                "player_on":  player_on,
                "team":       team,
                "injury":     injury,
            })

    # Build events_text for the AI prompt.
    # FILTER: skip any event where the player name is "Unknown".
    # The AI should only reference named players — "Unknown" events
    # produce low-quality narrative output and confuse the model.
    event_lines = []

    for card in cards:
        if card["player"] == "Unknown":
            continue  # Skip unnamed card events — don't send to AI
        card_label = card["card_type"].upper().replace("-", " ")
        reason_str = f" ({card['reason']})" if card.get("reason") else ""
        event_lines.append(
            f"{card['minute']}' {card_label} CARD — "
            f"{card['player']} ({card['team']}){reason_str}"
        )

    for goal in goals:
        if goal["scorer"] == "Unknown":
            continue  # Skip unnamed goal events — rare but possible
        assist_str = f" (assist: {goal['assist']})" if goal.get("assist") else ""
        type_str   = f" [{goal['type']}]" if goal["type"] != "regular" else ""
        event_lines.append(
            f"{goal['minute']}' GOAL{type_str} — "
            f"{goal['scorer']}{assist_str} ({goal['team']})"
        )

    event_lines.sort(key=lambda line: int(line.split("'")[0]))

    return {
        "goals":         goals,
        "cards":         cards,
        "substitutions": substitutions,
        "events_text":   "\n".join(event_lines) if event_lines else "No events recorded.",
    }


def build_match_context(match_data: dict, sofascore_stats: dict,
                         sofascore_lineups: dict,
                         sofascore_incidents: dict = None) -> dict:
    """
    Combines all data sources into a single context dict for the AI.
    """
    incidents = sofascore_incidents or {}

    return {
        "home_team":        match_data.get("home_team", "Home Team"),
        "away_team":        match_data.get("away_team", "Away Team"),
        "home_score":       match_data.get("home_score"),
        "away_score":       match_data.get("away_score"),
        "competition":      match_data.get("competition", "Unknown"),
        "matchday":         match_data.get("matchday"),
        "date":             match_data.get("date", ""),
        "home_stats":       sofascore_stats.get("home", {}),
        "away_stats":       sofascore_stats.get("away", {}),
        "narrative_hints":  sofascore_stats.get("narrative_hints", []),
        "home_formation":   sofascore_lineups.get("home_formation", "Unknown"),
        "away_formation":   sofascore_lineups.get("away_formation", "Unknown"),
        "home_players":     sofascore_lineups.get("home_players", []),
        "away_players":     sofascore_lineups.get("away_players", []),
        "home_substitutes": sofascore_lineups.get("home_substitutes", []),
        "away_substitutes": sofascore_lineups.get("away_substitutes", []),
        "lineups_confirmed": sofascore_lineups.get("confirmed", False),
        "goals":            incidents.get("goals", []),
        "cards":            incidents.get("cards", []),
        "substitutions":    incidents.get("substitutions", []),
        "events_text":      incidents.get("events_text", ""),
    }


# -------------------------------------------------------------------------
# Quick test
# -------------------------------------------------------------------------

if __name__ == "__main__":
    print("Testing cleaner functions...\n")

    raw_comp = {"id": 2021, "name": "Premier League", "code": "PL",
                "area": {"name": "England"}}
    print(f"Competition: {clean_competition(raw_comp)}")

    raw_team = {"id": 65, "name": "Manchester City FC",
                "shortName": "Man City", "tla": "MCI"}
    print(f"Team: {clean_team(raw_team)}")

    # Test Unknown filtering — the card with Unknown player should not
    # appear in events_text but should still be in the cards list
    sample_incidents = {
        "incidents": [
            {"incidentType": "goal", "time": 78, "isHome": True,
             "incidentClass": "regular",
             "player": {"name": "Rodrigo Gomes"},
             "assist1": {"name": "Tolu Arokodare"}},
            {"incidentType": "card", "time": 5, "isHome": False,
             "incidentClass": "yellow", "reason": "argument",
             "player": {"name": "Unknown"}},   # ← should be filtered from events_text
            {"incidentType": "card", "time": 22, "isHome": False,
             "incidentClass": "yellow", "reason": "Foul",
             "player": {"name": "Ryan Gravenberch"}},
            {"incidentType": "period", "text": "HT"},
        ],
        "home": {}, "away": {}
    }
    result = clean_match_incidents(
        sample_incidents,
        home_team="Wolverhampton Wanderers",
        away_team="Liverpool FC"
    )
    print(f"\nAll cards (including Unknown): {len(result['cards'])} entries")
    print(f"Events text (Unknown filtered):\n{result['events_text']}")
    assert "Unknown" not in result["events_text"], "Unknown leaked into events_text!"
    print("\nAll cleaner tests passed.")
