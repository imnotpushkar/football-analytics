"""
backend/main.py

Orchestrates the full V1 pipeline:
    1. Initialize database
    2. Fetch matches from Football-Data.org API
    3. Clean and store competitions, teams, matches
    4. Find the most recent finished match
    5. Fetch SofaScore stats and lineups for that match
    6. Generate creator-quality AI summary
    7. Save summary to DB and print it

Run with: python -m backend.main
This is also what n8n will trigger via a scheduled Execute Command node.
"""

import sys
from datetime import datetime

from backend.db.schema import init_db
from backend.db.writer import (
    save_competitions,
    save_teams,
    save_matches,
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
    print("[1/6] Initializing database...")
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
    print(f"[2/6] Fetching matches for: {competition_code}...")

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
    print("[3/6] Finding most recent finished match...")

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
    Bridges Football-Data.org match data with SofaScore match IDs
    using team names and date for matching.

    Returns:
        Dict with "stats" and "lineups" keys, or empty dict on failure.
    """
    from backend.scrapers.sofascore import get_full_match_data

    home_team = raw_match.get("homeTeam", {}).get("name", "")
    away_team = raw_match.get("awayTeam", {}).get("name", "")
    date_str = raw_match.get("utcDate", "")[:10]

    print(f"[4/6] Fetching SofaScore data: {home_team} vs {away_team}...")

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
        }

    except Exception as e:
        print(f"      SofaScore fetch failed: {e} — "
              f"continuing without stats.\n")
        return {}


def step_summarize(raw_match: dict, competition_name: str,
                   sofascore_data: dict) -> str:
    """
    Step 5: Build full match context and generate AI summary.
    Uses SofaScore stats and lineups if available, falls back
    to match-only data gracefully.

    Returns:
        Summary text string.
    """
    print("[5/6] Generating AI summary...")

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
        )
    else:
        context = {
            **match_data,
            "home_stats": {},
            "away_stats": {},
            "narrative_hints": [],
            "home_formation": "Unknown",
            "away_formation": "Unknown",
            "home_players": [],
            "away_players": [],
            "lineups_confirmed": False,
        }

    summary = summarize_match(context)
    print("      Summary generated.\n")
    return summary


def step_save_summary(match_id: int, summary: str):
    """Step 6: Persist the AI summary to the DB."""
    print("[6/6] Saving summary to database...")
    save_summary(match_id, summary)
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

    sofascore_data = step_fetch_sofascore_data(latest_match)

    summary = step_summarize(latest_match, competition_name, sofascore_data)

    step_save_summary(latest_match["id"], summary)

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