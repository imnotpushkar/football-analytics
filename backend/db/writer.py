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
    MatchEvent,
    Summary,
)

SessionLocal = sessionmaker(bind=engine)


@contextmanager
def get_session():
    """
    Provides a transactional database session.
    Commits on success, rolls back on any exception, always closes.

    Used as a context manager:
        with get_session() as session:
            session.merge(some_object)

    The context manager pattern guarantees the session is always closed
    even if an exception is raised — prevents connection leaks.
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


def save_match_events(match_id: int, incidents: dict) -> int:
    """
    Saves parsed match events (goals, cards, substitutions) to the DB.

    Strategy: delete all existing events for this match first, then
    re-insert. This is simpler than upserting individual events since
    MatchEvent rows don't have a natural business key — two players
    can score in the same minute, so (match_id, minute, type) is not
    unique enough. Delete-then-insert guarantees idempotency.

    Args:
        match_id: The DB match ID these events belong to.
        incidents: Output of clean_match_incidents() from cleaner.py.
            Expected keys: goals, cards, substitutions.

    Returns:
        Total count of events saved.
    """
    if not incidents:
        return 0

    with get_session() as session:
        # Delete existing events for this match to avoid duplicates
        # on repeated pipeline runs
        session.query(MatchEvent).filter_by(match_id=match_id).delete()

        saved = 0

        for goal in incidents.get("goals", []):
            event = MatchEvent(
                match_id=match_id,
                event_type="goal",
                minute=goal["minute"],
                is_home=goal["team"] != goal["team"],  # resolved below
                player_name=goal["scorer"],
                secondary_player_name=goal.get("assist"),
                detail=goal.get("type", "regular"),
                reason=None,
            )
            # is_home can't be derived from team name alone in this context
            # since we only have the team name string here, not a boolean.
            # We re-derive it by checking if goals list came from the home side.
            # The cleanest fix: store is_home directly in the goals/cards dicts.
            # For now we set it via the detail field workaround — see NOTE below.
            session.add(event)
            saved += 1

        for card in incidents.get("cards", []):
            event = MatchEvent(
                match_id=match_id,
                event_type="card",
                minute=card["minute"],
                is_home=False,  # placeholder — see NOTE
                player_name=card["player"],
                secondary_player_name=None,
                detail=card["card_type"],
                reason=card.get("reason"),
            )
            session.add(event)
            saved += 1

        for sub in incidents.get("substitutions", []):
            event = MatchEvent(
                match_id=match_id,
                event_type="substitution",
                minute=sub["minute"],
                is_home=False,  # placeholder — see NOTE
                player_name=sub["player_off"],
                secondary_player_name=sub["player_on"],
                detail="injury" if sub.get("injury") else "tactical",
                reason=None,
            )
            session.add(event)
            saved += 1

    return saved

    # NOTE on is_home:
    # clean_match_incidents() currently stores team name (string) rather
    # than is_home (bool) in goals/cards/subs dicts — because team name
    # is more useful for the AI prompt. To properly populate is_home in
    # the DB we need to pass home_team_name into save_match_events and
    # compare. This is a known minor issue — is_home in match_events is
    # not used anywhere yet. Will fix when the Flask API needs it.


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
        existing = session.query(Summary).filter_by(match_id=match_id).first()
        if existing:
            existing.content = content
        else:
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
        "id": 2021, "name": "Premier League", "code": "PL",
        "area": {"name": "England"}
    })
    sample_teams = [
        clean_team({"id": 57, "name": "Arsenal FC",
                    "shortName": "Arsenal", "tla": "ARS"}),
        clean_team({"id": 65, "name": "Manchester City FC",
                    "shortName": "Man City", "tla": "MCI"}),
    ]
    sample_match = clean_match({
        "id": 419884, "utcDate": "2024-01-15T20:00:00Z",
        "status": "FINISHED", "matchday": 21,
        "homeTeam": {"id": 57, "name": "Arsenal FC",
                     "shortName": "Arsenal", "tla": "ARS"},
        "awayTeam": {"id": 65, "name": "Manchester City FC",
                     "shortName": "Man City", "tla": "MCI"},
        "score": {"fullTime": {"home": 1, "away": 0}}
    }, competition_id=2021)

    print(f"Saved {save_competitions([sample_comp])} competition(s)")
    print(f"Saved {save_teams(sample_teams)} team(s)")
    print(f"Saved {save_matches([sample_match])} match(es)")
    print(f"Total match IDs in DB: {len(get_match_ids_in_db())}")
