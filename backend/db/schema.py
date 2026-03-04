"""
backend/db/schema.py

Defines the database schema using SQLAlchemy ORM.
Creates the SQLite database file at data/football.db if it doesn't exist.

Tables:
    - competitions: stores league/cup info
    - teams: stores team info
    - matches: stores match results linked to competitions and teams
    - players: stores player info linked to a team
    - player_stats: stores per-match stats for each player
    - summaries: stores AI-generated summaries linked to a match
"""

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime
import os

# -------------------------------------------------------------------------
# Engine setup
# -------------------------------------------------------------------------
# create_engine() is SQLAlchemy's way of connecting to a database.
# The string "sqlite:///..." is a connection URL.
# Three slashes = relative path. We point it to data/football.db
# echo=False means SQLAlchemy won't print every SQL statement it runs.
# We build the path dynamically so it works regardless of where the script
# is called from.

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "data", "football.db")
DB_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DB_URL, echo=False)

# -------------------------------------------------------------------------
# Base class
# -------------------------------------------------------------------------
# declarative_base() returns a base class that all our table models will
# inherit from. SQLAlchemy uses this to track all defined tables.

Base = declarative_base()


# -------------------------------------------------------------------------
# Table definitions
# -------------------------------------------------------------------------

class Competition(Base):
    """
    Represents a football competition (e.g. Premier League, Champions League).
    Football-Data.org uses competition IDs — we store them here.
    """
    __tablename__ = "competitions"

    id = Column(Integer, primary_key=True)          # Football-Data.org competition ID
    name = Column(String(100), nullable=False)       # e.g. "Premier League"
    code = Column(String(20), unique=True)           # e.g. "PL"
    country = Column(String(50))                     # e.g. "England"

    # One competition has many matches
    matches = relationship("Match", back_populates="competition")

    def __repr__(self):
        return f"<Competition {self.name}>"


class Team(Base):
    """
    Represents a football club.
    """
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True)           # Football-Data.org team ID
    name = Column(String(100), nullable=False)       # e.g. "Arsenal FC"
    short_name = Column(String(50))                  # e.g. "Arsenal"
    tla = Column(String(5))                          # Three Letter Abbreviation e.g. "ARS"

    # One team has many players
    players = relationship("Player", back_populates="team")

    def __repr__(self):
        return f"<Team {self.name}>"


class Match(Base):
    """
    Represents a single football match.
    Links to Competition, and to two Teams (home and away).
    """
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True)           # Football-Data.org match ID
    competition_id = Column(Integer, ForeignKey("competitions.id"))
    home_team_id = Column(Integer, ForeignKey("teams.id"))
    away_team_id = Column(Integer, ForeignKey("teams.id"))
    matchday = Column(Integer)                       # e.g. Matchday 12
    status = Column(String(20))                      # FINISHED, SCHEDULED, etc.
    utc_date = Column(DateTime)                      # Match datetime in UTC
    home_score = Column(Integer)
    away_score = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    competition = relationship("Competition", back_populates="matches")
    home_team = relationship("Team", foreign_keys=[home_team_id])
    away_team = relationship("Team", foreign_keys=[away_team_id])
    player_stats = relationship("PlayerStat", back_populates="match")
    summary = relationship("Summary", back_populates="match", uselist=False)

    def __repr__(self):
        return f"<Match {self.home_team_id} vs {self.away_team_id}>"


class Player(Base):
    """
    Represents a football player linked to a team.
    """
    __tablename__ = "players"

    id = Column(Integer, primary_key=True)           # Football-Data.org player ID
    name = Column(String(100), nullable=False)
    position = Column(String(50))                    # e.g. "Midfielder"
    nationality = Column(String(50))
    team_id = Column(Integer, ForeignKey("teams.id"))

    team = relationship("Team", back_populates="players")
    stats = relationship("PlayerStat", back_populates="player")

    def __repr__(self):
        return f"<Player {self.name}>"


class PlayerStat(Base):
    """
    Per-match statistics for a single player.
    This is the core table for Version 1 — player performance tracking.
    Stats like xG and passes will be populated from Understat/FBref scrapers later.
    """
    __tablename__ = "player_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    match_id = Column(Integer, ForeignKey("matches.id"))
    player_id = Column(Integer, ForeignKey("players.id"))
    team_id = Column(Integer, ForeignKey("teams.id"))

    # Basic stats from Football-Data.org
    goals = Column(Integer, default=0)
    assists = Column(Integer, default=0)
    minutes_played = Column(Integer, default=0)
    yellow_cards = Column(Integer, default=0)
    red_cards = Column(Integer, default=0)

    # Advanced stats — populated later from Understat/FBref
    shots = Column(Integer, default=0)
    shots_on_target = Column(Integer, default=0)
    xg = Column(Float, default=0.0)                  # Expected goals
    passes = Column(Integer, default=0)
    pass_accuracy = Column(Float, default=0.0)       # Percentage
    tackles = Column(Integer, default=0)
    interceptions = Column(Integer, default=0)

    match = relationship("Match", back_populates="player_stats")
    player = relationship("Player", back_populates="stats")

    def __repr__(self):
        return f"<PlayerStat player={self.player_id} match={self.match_id}>"


class Summary(Base):
    """
    Stores the AI-generated performance summary for a match.
    One summary per match — generated by Claude via the summarizer module.
    """
    __tablename__ = "summaries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    match_id = Column(Integer, ForeignKey("matches.id"), unique=True)
    content = Column(Text, nullable=False)           # The full AI summary text
    generated_at = Column(DateTime, default=datetime.utcnow)

    match = relationship("Match", back_populates="summary")

    def __repr__(self):
        return f"<Summary match={self.match_id}>"


# -------------------------------------------------------------------------
# Database initializer
# -------------------------------------------------------------------------

def init_db():
    """
    Creates all tables in the database if they don't already exist.
    Safe to call multiple times — won't overwrite existing data.
    Call this once at application startup.
    """
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    Base.metadata.create_all(engine)
    print(f"Database initialized at: {DB_PATH}")


if __name__ == "__main__":
    init_db()