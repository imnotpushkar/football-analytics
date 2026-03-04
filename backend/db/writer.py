"""
backend/db/writer.py

Handles all database write operations using SQLAlchemy sessions.
Takes clean dicts (output of cleaner.py) and persists them to SQLite.

Uses upsert pattern via session.merge() — safe to call multiple times
without creating duplicate records.

Pipeline position: scraper → cleaner → writer → DB
"""

from contextlib import contextmanager
from sqlalchemy.orm import sessionmaker
from backend.db.schema import (
    engine,
    Competition,
    Team,
    Match,
    Player,
    PlayerStat,
    Summary,
)

SessionLocal = sessionmaker(bind=engine)


@contextmanager
def get_session():
    """
    Provides a transactional database session.
    Commits on success, rolls back on any exception, always closes.
    """
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def save_competitions(competitions: list) -> int:
    """
    Saves a list of clean competition dicts to the DB.
    Uses merge() so existing competitions are updated, not duplicated.

    Args:
        competitions: List of clean dicts from clean_competitions()

    Returns:
        Count of competitions saved.
    """
    with get_session() as session:
        for comp_data in competitions:
            competition = Competition(**comp_data)
            session.merge(competition)
    return len(competitions)


def save_teams(teams: list) -> int:
    """
    Saves a list of clean team dicts to the DB.

    Args:
        teams: List of clean dicts from clean_teams_from_matches()

    Returns:
        Count of teams saved.
    """
    with get_session() as session:
        for team_data in teams:
            team = Team(**team_data)
            session.merge(team)
    return len(teams)


def save_matches(matches: list) -> int:
    """
    Saves a list of clean match dicts to the DB.
    Skips matches with missing team IDs.

    Args:
        matches: List of clean dicts from clean_matches()

    Returns:
        Count of matches saved.
    """
    saved = 0
    with get_session() as session:
        for match_data in matches:
            if not match_data.get("home_team_id") or not match_data.get("away_team_id"):
                print(f"Skipping match {match_data.get('id')} — missing team IDs")
                continue
            match = Match(**match_data)
            session.merge(match)
            saved += 1
    return saved


def save_players(players: list) -> int:
    """
    Saves a list of clean player dicts to the DB.

    Args:
        players: List of clean dicts from clean_player()

    Returns:
        Count of players saved.
    """
    with get_session() as session:
        for player_data in players:
            if not player_data.get("id"):
                continue
            player = Player(**player_data)
            session.merge(player)
    return len(players)


def save_player_stat(stat_data: dict) -> None:
    """
    Saves a single player stat record.

    Args:
        stat_data: Dict with keys matching PlayerStat model fields.
                   Must include match_id and player_id.
    """
    with get_session() as session:
        stat = PlayerStat(**stat_data)
        session.merge(stat)


def save_summary(match_id: int, content: str) -> None:
    """
    Saves or updates the AI-generated summary for a match.
    Explicitly checks for an existing summary and updates it
    rather than inserting — avoids UNIQUE constraint errors
    on repeated pipeline runs for the same match.

    Args:
        match_id: The DB match ID this summary belongs to.
        content: The full text of the AI-generated summary.
    """
    with get_session() as session:
        # Check if a summary already exists for this match
        existing = session.query(Summary).filter_by(match_id=match_id).first()

        if existing:
            # Update the existing record in place
            existing.content = content
        else:
            # Insert a new record
            summary = Summary(match_id=match_id, content=content)
            session.add(summary)


def get_match_ids_in_db() -> list:
    """
    Returns a list of all match IDs currently stored in the DB.
    Used by the pipeline to skip already-stored matches.
    """
    with get_session() as session:
        results = session.query(Match.id).all()
        return [r[0] for r in results]


# -------------------------------------------------------------------------
# Quick test
# -------------------------------------------------------------------------

if __name__ == "__main__":
    from backend.db.schema import init_db
    from backend.processors.cleaner import clean_competition, clean_team, clean_match

    init_db()

    sample_comp = clean_competition({
        "id": 2021,
        "name": "Premier League",
        "code": "PL",
        "area": {"name": "England"}
    })

    sample_teams = [
        clean_team({"id": 57, "name": "Arsenal FC",
                    "shortName": "Arsenal", "tla": "ARS"}),
        clean_team({"id": 65, "name": "Manchester City FC",
                    "shortName": "Man City", "tla": "MCI"}),
    ]

    sample_match = clean_match({
        "id": 419884,
        "utcDate": "2024-01-15T20:00:00Z",
        "status": "FINISHED",
        "matchday": 21,
        "homeTeam": {"id": 57, "name": "Arsenal FC",
                     "shortName": "Arsenal", "tla": "ARS"},
        "awayTeam": {"id": 65, "name": "Manchester City FC",
                     "shortName": "Man City", "tla": "MCI"},
        "score": {"fullTime": {"home": 1, "away": 0}}
    }, competition_id=2021)

    saved_comps = save_competitions([sample_comp])
    saved_teams = save_teams(sample_teams)
    saved_matches = save_matches([sample_match])

    print(f"Saved {saved_comps} competition(s)")
    print(f"Saved {saved_teams} team(s)")
    print(f"Saved {saved_matches} match(es)")

    match_ids = get_match_ids_in_db()
    print(f"Total match IDs in DB: {len(match_ids)}")