"""
backend/main.py

Orchestrates the full V1 pipeline:
    1. Initialize database
    2. Fetch matches from Football-Data.org API
    3. Clean and store competitions, teams, matches
    4. Find the most recent finished match
    5. Fetch SofaScore stats and lineups for that match
    6. Fetch SofaScore incidents (goals, cards, subs)  ← NEW
    7. Generate creator-quality AI summary
    8. Save summary and events to DB

Run with: python -m backend.main
"""

import sys
from datetime import datetime

from backend.db.schema import init_db
from backend.db.writer import (
    save_competitions,
    save_teams,
    save_matches,
    save_match_events,
    save_summary,
    get_match_ids_in_db,
)
from backend.scrapers.football_data_api import (
    get_competitions,
    get_matches_by_competition,
)
from backend.processors.cleaner import (
    clean_competitions,
    clean_teams_from_matches,
    clean_matches,
    clean_sofascore_stats,
    clean_sofascore_lineups,
    clean_match_incidents,
    build_match_context,
)
from backend.summarizer.summarize import summarize_match


# -------------------------------------------------------------------------
# Configuration
# -------------------------------------------------------------------------

TARGET_COMPETITION_CODE = "PL"
TARGET_COMPETITION_ID = 2021
TARGET_COMPETITION_NAME = "Premier League"


# -------------------------------------------------------------------------
# Pipeline steps
# -------------------------------------------------------------------------

def step_init():
    """Step 1: Ensure DB exists with all tables."""
    print("[1/7] Initializing database...")
    init_db()
    print("      Done.\n")


def step_fetch_and_store(competition_code: str,
                          competition_id: int) -> list:
    """
    Step 2: Fetch matches from Football-Data.org, clean, save to DB.
    Skips matches already in DB to avoid redundant API calls.

    Returns:
        List of all raw match dicts from the API.
    """
    print(f"[2/7] Fetching matches for: {competition_code}...")

    raw_matches = get_matches_by_competition(competition_code)
    print(f"      Found {len(raw_matches)} matches from API.")

    raw_competitions = get_competitions()
    clean_comps = clean_competitions(raw_competitions)
    saved_comps = save_competitions(clean_comps)
    print(f"      Saved {saved_comps} competition(s).")

    clean_team_list = clean_teams_from_matches(raw_matches)
    saved_teams = save_teams(clean_team_list)
    print(f"      Saved {saved_teams} team(s).")

    existing_ids = set(get_match_ids_in_db())
    new_raw_matches = [
        m for m in raw_matches if m.get("id") not in existing_ids
    ]
    print(f"      {len(new_raw_matches)} new match(es) to save "
          f"(skipping {len(existing_ids)} already in DB).")

    if new_raw_matches:
        clean_match_list = clean_matches(new_raw_matches, competition_id)
        saved_matches = save_matches(clean_match_list)
        print(f"      Saved {saved_matches} new match(es).\n")
    else:
        print("      No new matches to save.\n")

    return raw_matches


def step_get_latest_finished_match(raw_matches: list) -> dict | None:
    """
    Step 3: Find the most recently finished match from the raw list.

    Returns:
        Single raw match dict, or None if no finished matches found.
    """
    print("[3/7] Finding most recent finished match...")

    finished = [m for m in raw_matches if m.get("status") == "FINISHED"]

    if not finished:
        print("      No finished matches found.\n")
        return None

    finished.sort(key=lambda m: m.get("utcDate", ""), reverse=True)
    latest = finished[0]

    home = latest.get("homeTeam", {}).get("name", "Unknown")
    away = latest.get("awayTeam", {}).get("name", "Unknown")
    score_home = latest.get("score", {}).get("fullTime", {}).get("home", "?")
    score_away = latest.get("score", {}).get("fullTime", {}).get("away", "?")
    print(f"      Latest: {home} {score_home} - {score_away} {away}\n")

    return latest


def step_fetch_sofascore_data(raw_match: dict) -> dict:
    """
    Step 4: Fetch SofaScore statistics and lineups for the match.

    Returns:
        Dict with "stats" and "lineups" keys, or empty dict on failure.
    """
    from backend.scrapers.sofascore import get_full_match_data

    home_team = raw_match.get("homeTeam", {}).get("name", "")
    away_team = raw_match.get("awayTeam", {}).get("name", "")
    date_str = raw_match.get("utcDate", "")[:10]

    print(f"[4/7] Fetching SofaScore stats + lineups: "
          f"{home_team} vs {away_team}...")

    try:
        result = get_full_match_data(date_str, home_team, away_team)

        if not result:
            print("      Match not found on SofaScore — "
                  "summary will use match data only.\n")
            return {}

        cleaned_stats = clean_sofascore_stats(
            result["statistics"], home_team, away_team
        )
        cleaned_lineups = clean_sofascore_lineups(result["lineups"])

        hint_count = len(cleaned_stats.get("narrative_hints", []))
        confirmed = cleaned_lineups.get("confirmed", False)
        print(f"      Stats fetched. Narrative hints: {hint_count}")
        print(f"      Lineups confirmed: {confirmed}\n")

        return {
            "stats": cleaned_stats,
            "lineups": cleaned_lineups,
            # Pass raw incidents through for step 5 to clean separately
            "raw_incidents": result.get("incidents", {}),
            "sofascore_match_id": result.get("match_id"),
        }

    except Exception as e:
        print(f"      SofaScore fetch failed: {e} — "
              f"continuing without stats.\n")
        return {}


def step_fetch_incidents(sofascore_data: dict, home_team: str,
                          away_team: str) -> dict:
    """
    Step 5: Clean match incidents (goals, cards, subs) from the
    raw incidents data fetched in step 4.

    Incidents are fetched as part of get_full_match_data() in step 4
    and stored in sofascore_data["raw_incidents"]. This step cleans
    and structures them.

    Returns:
        Output of clean_match_incidents() — goals, cards, subs, events_text.
        Returns empty dict if incidents unavailable.
    """
    print("[5/7] Processing match incidents (goals, cards, subs)...")

    raw_incidents = sofascore_data.get("raw_incidents", {})

    if not raw_incidents:
        print("      No incidents data available.\n")
        return {}

    try:
        cleaned = clean_match_incidents(raw_incidents, home_team, away_team)
        goal_count = len(cleaned.get("goals", []))
        card_count = len(cleaned.get("cards", []))
        sub_count = len(cleaned.get("substitutions", []))
        print(f"      Goals: {goal_count} | Cards: {card_count} "
              f"| Subs: {sub_count}")
        print(f"      Events text preview: "
              f"{cleaned.get('events_text', '')[:80]}...\n")
        return cleaned
    except Exception as e:
        print(f"      Incidents processing failed: {e}\n")
        return {}


def step_summarize(raw_match: dict, competition_name: str,
                   sofascore_data: dict, incidents: dict) -> str:
    """
    Step 6: Build full match context and generate AI summary.
    Now includes match events in the context so the AI knows
    who scored, when, and who was carded.

    Returns:
        Summary text string.
    """
    print("[6/7] Generating AI summary...")

    match_data = {
        "home_team": raw_match.get("homeTeam", {}).get("name", "Unknown"),
        "away_team": raw_match.get("awayTeam", {}).get("name", "Unknown"),
        "home_score": raw_match.get("score", {}).get("fullTime", {}).get("home"),
        "away_score": raw_match.get("score", {}).get("fullTime", {}).get("away"),
        "competition": competition_name,
        "matchday": raw_match.get("matchday"),
        "date": raw_match.get("utcDate", "")[:10],
    }

    if sofascore_data:
        context = build_match_context(
            match_data,
            sofascore_data.get("stats", {}),
            sofascore_data.get("lineups", {}),
            sofascore_incidents=incidents,
        )
    else:
        context = {
            **match_data,
            "home_stats": {}, "away_stats": {},
            "narrative_hints": [],
            "home_formation": "Unknown", "away_formation": "Unknown",
            "home_players": [], "away_players": [],
            "lineups_confirmed": False,
            "goals": [], "cards": [], "substitutions": [],
            "events_text": incidents.get("events_text", ""),
        }

    summary = summarize_match(context)
    print("      Summary generated.\n")
    return summary


def step_save(match_id: int, summary: str, incidents: dict):
    """Step 7: Persist the AI summary and match events to DB."""
    print("[7/7] Saving summary and events to database...")
    save_summary(match_id, summary)

    if incidents:
        saved_events = save_match_events(match_id, incidents)
        print(f"      Saved {saved_events} match event(s).")

    print("      Done.\n")


# -------------------------------------------------------------------------
# Main entry point
# -------------------------------------------------------------------------

def run_pipeline(
    competition_code: str = TARGET_COMPETITION_CODE,
    competition_id: int = TARGET_COMPETITION_ID,
    competition_name: str = TARGET_COMPETITION_NAME,
):
    """
    Runs the full ETL + summarization pipeline.
    Called directly or triggered by n8n Execute Command node.
    """
    start = datetime.now()
    print("=" * 55)
    print("  FOOTBALL ANALYTICS PIPELINE — V1")
    print(f"  Started: {start.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 55 + "\n")

    step_init()

    raw_matches = step_fetch_and_store(competition_code, competition_id)
    if not raw_matches:
        print("No matches returned from API. Exiting.")
        sys.exit(0)

    latest_match = step_get_latest_finished_match(raw_matches)
    if not latest_match:
        print("No finished matches available. Exiting.")
        sys.exit(0)

    home_team = latest_match.get("homeTeam", {}).get("name", "")
    away_team = latest_match.get("awayTeam", {}).get("name", "")

    sofascore_data = step_fetch_sofascore_data(latest_match)
    incidents = step_fetch_incidents(sofascore_data, home_team, away_team)

    summary = step_summarize(
        latest_match, competition_name, sofascore_data, incidents
    )

    step_save(latest_match["id"], summary, incidents)

    elapsed = (datetime.now() - start).seconds
    print("=" * 55)
    print("  PIPELINE COMPLETE")
    print(f"  Time elapsed: {elapsed}s")
    print("=" * 55 + "\n")
    print("MATCH SUMMARY:")
    print("-" * 55)
    print(summary)


if __name__ == "__main__":
    run_pipeline()
