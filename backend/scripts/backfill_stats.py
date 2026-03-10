"""
backend/scripts/backfill_stats.py

Backfills match_stats rows for matches that have summaries but no stats.

WHY THIS SCRIPT EXISTS:
    The match_stats table was added mid-project (Session 14/15).
    All matches summarised before that point have a summary row but
    zero rows in match_stats. The main pipeline only saves stats for
    matches it processes fresh — it won't go back and fill old ones.
    This script bridges that gap without touching summaries or events.

WHAT IT DOES:
    1. Queries DB for matches that have a Summary but no MatchStat rows
    2. Optionally filters by competition code (--competition)
    3. For each match:
        a. Gets team names from the Team table
        b. Calls SofaScore get_full_match_data() — stats + lineups only
        c. Cleans the stats via clean_sofascore_stats()
        d. Saves via save_match_stats()
    4. Logs skipped matches (SofaScore couldn't find them)

WHAT IT DOES NOT DO:
    - Does NOT call Groq — no summaries generated or modified
    - Does NOT overwrite existing match_stats rows (skips if already present)
    - Does NOT touch match_events

RATE LIMITS:
    SofaScore via RapidAPI — depends on your plan.
    Each match needs ~3 requests (match list, statistics, lineups).
    REQUEST_DELAY in sofascore.py adds 1s between calls automatically.
    Use --limit to process a safe number per run.

CLI USAGE:
    # All competitions, all unbackfilled matches
    python -m backend.scripts.backfill_stats

    # Specific competition only
    python -m backend.scripts.backfill_stats --competition PL

    # Limit number of matches processed (safe for rate limits)
    python -m backend.scripts.backfill_stats --competition PL --limit 10

    # Dry run — show what would be processed without fetching anything
    python -m backend.scripts.backfill_stats --dry-run

EXPECTED AFFECTED MATCHES (as of Session 16):
    PL MD25  10 matches
    PL MD26  10 matches
    PL MD27  10 matches
    PL MD28  10 matches
    CL MD2   12 matches
    CL MD7   18 matches
    CL MD8   18 matches
    Total:   88 matches (~264 RapidAPI requests)
"""

import time
import argparse
from datetime import datetime

from sqlalchemy.orm import sessionmaker
from backend.db.schema import engine, Match, Summary, MatchStat, Team, Competition
from backend.db.writer import save_match_stats
from backend.scrapers.sofascore import get_full_match_data
from backend.processors.cleaner import clean_sofascore_stats

SessionLocal = sessionmaker(bind=engine)

# Extra wait between matches on top of the per-request delays already
# built into sofascore.py (REQUEST_DELAY = 1s per call).
# Each match makes ~3 calls so ~3s of built-in delay + 2s here = ~5s total.
MATCH_DELAY = 2


def get_unbackfilled_matches(session, competition_code: str = None) -> list:
    """
    Returns Match objects that have a Summary but no MatchStat rows.

    HOW THE QUERY WORKS:
        We build two sets in Python from lightweight ID-only queries,
        then subtract to find matches that need backfilling.

        Set A = match IDs that already have stats  (skip these)
        Set B = match IDs that have summaries      (our candidates)
        Need backfill = B - A

        This avoids a complex LEFT JOIN and is easy to reason about.
        Both queries return only IDs so memory usage is minimal even
        with hundreds of matches.

    Args:
        session:          Active SQLAlchemy session
        competition_code: Optional filter e.g. "PL", "CL"

    Returns:
        List of Match ORM objects ordered by competition, matchday, date
    """
    # Match IDs that already have stats — skip these
    already_have_stats = {
        row.match_id
        for row in session.query(MatchStat.match_id).distinct().all()
    }

    # Match IDs that have summaries — these are our candidates
    have_summary = {
        row.match_id
        for row in session.query(Summary.match_id).all()
    }

    # Need backfill = have summary AND no stats yet
    need_stats = have_summary - already_have_stats

    if not need_stats:
        return []

    # Load full Match objects for those IDs
    query = (
        session.query(Match)
        .filter(Match.id.in_(need_stats))
        .filter(Match.status == "FINISHED")
    )

    if competition_code:
        query = (
            query
            .join(Competition, Match.competition_id == Competition.id)
            .filter(Competition.code == competition_code)
        )

    return (
        query
        .order_by(Match.competition_id, Match.matchday, Match.utc_date)
        .all()
    )


def get_team_name(session, team_id: int) -> str:
    """Looks up team name from DB. Returns 'Unknown' if not found."""
    team = session.query(Team).filter_by(id=team_id).first()
    return team.name if team else "Unknown"


def get_competition_code(session, competition_id: int) -> str:
    """Looks up competition code from DB. Returns empty string if not found."""
    comp = session.query(Competition).filter_by(id=competition_id).first()
    return comp.code if comp else ""


def backfill(competition_code: str = None,
             limit: int = None,
             dry_run: bool = False) -> dict:
    """
    Main backfill function.

    Args:
        competition_code: Filter to one competition, or None for all
        limit:            Max matches to process (None = no limit)
        dry_run:          If True, print what would be done without fetching

    Returns:
        Summary dict: { found, saved, skipped, failed }
    """
    session = SessionLocal()
    try:
        matches = get_unbackfilled_matches(session, competition_code)
    finally:
        session.close()

    if not matches:
        print("No matches need backfilling. All summaries have stats.")
        return {"found": 0, "skipped": 0, "saved": 0, "failed": 0}

    if limit:
        matches = matches[:limit]

    total = len(matches)
    comp_label = competition_code or "ALL"

    print("=" * 55)
    print(f"  MATCH STATS BACKFILL")
    print(f"  Competition: {comp_label}")
    print(f"  Matches to process: {total}")
    if dry_run:
        print(f"  MODE: DRY RUN — no API calls will be made")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 55 + "\n")

    skipped = 0
    saved = 0
    failed = 0

    # Single session for all team/competition name lookups in the loop
    session = SessionLocal()

    try:
        for i, match in enumerate(matches, start=1):
            home_name = get_team_name(session, match.home_team_id)
            away_name = get_team_name(session, match.away_team_id)
            comp_code  = get_competition_code(session, match.competition_id)
            date_str   = match.utc_date.strftime("%Y-%m-%d")

            print(f"  [{i}/{total}] {comp_code} MD{match.matchday} | "
                  f"{home_name} vs {away_name} ({date_str})")

            if dry_run:
                print(f"      [DRY RUN] Would fetch SofaScore for match ID {match.id}")
                continue

            try:
                # get_full_match_data chains three RapidAPI calls:
                #   1. /match/list       — find match ID by date + team names
                #   2. /match/statistics — team-level stats
                #   3. /match/lineups    — formations and players
                # Each has a 1s REQUEST_DELAY in sofascore.py.
                # Incidents are NOT fetched — we only need stats here.
                result = get_full_match_data(date_str, home_name, away_name)

                if not result:
                    print(f"      ✗ Not found on SofaScore — skipping.")
                    skipped += 1
                    continue

                # clean_sofascore_stats() normalises the raw statistics dict
                # into { "home": {...}, "away": {...} } with consistent keys
                # that map directly to MatchStat column names in the schema.
                cleaned_stats = clean_sofascore_stats(
                    result["statistics"], home_name, away_name
                )

                # save_match_stats() expects match_id, a dict with team IDs,
                # and the cleaned stats dict. It uses delete-then-insert so
                # it's safe to call even if partial stats exist somehow.
                match_ids = {
                    "home_team_id": match.home_team_id,
                    "away_team_id": match.away_team_id,
                }

                rows_saved = save_match_stats(match.id, match_ids, cleaned_stats)

                if rows_saved:
                    print(f"      ✓ Saved {rows_saved} stat row(s).")
                    saved += 1
                else:
                    print(f"      ✗ Stats empty after cleaning — skipping.")
                    skipped += 1

            except Exception as e:
                print(f"      ✗ Failed: {e}")
                failed += 1

            if i < total:
                time.sleep(MATCH_DELAY)

    finally:
        session.close()

    print("\n" + "=" * 55)
    print(f"  BACKFILL COMPLETE")
    print(f"  Processed: {total}")
    print(f"  Saved:     {saved}")
    print(f"  Skipped:   {skipped}  (not found on SofaScore)")
    print(f"  Failed:    {failed}  (errors)")
    print("=" * 55 + "\n")

    return {
        "found":   total,
        "saved":   saved,
        "skipped": skipped,
        "failed":  failed,
    }


# -------------------------------------------------------------------------
# CLI entry point
# -------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Backfill match_stats for matches with summaries but no stats.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m backend.scripts.backfill_stats
  python -m backend.scripts.backfill_stats --competition PL
  python -m backend.scripts.backfill_stats --competition CL --limit 10
  python -m backend.scripts.backfill_stats --dry-run

Each match makes ~3 RapidAPI requests.
Check your daily quota before running without --limit.
        """
    )
    parser.add_argument(
        "--competition",
        type=str,
        default=None,
        help="Competition code to filter (e.g. PL, CL). Default: all."
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max matches to process. Default: no limit."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Preview what would be processed without making API calls."
    )
    args = parser.parse_args()

    backfill(
        competition_code=args.competition,
        limit=args.limit,
        dry_run=args.dry_run,
    )