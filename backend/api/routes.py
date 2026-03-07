"""
backend/api/routes.py

Defines all REST API endpoints for the Football Analytics system.

PIPELINE PROGRESS TRACKING (added this session):

    Problem: The pipeline runs for several minutes. The old design blocked
    the HTTP response until everything was done — frontend showed a spinner
    with no feedback.

    Solution: Two-part pattern:

    1. BACKGROUND THREAD
       POST /api/pipeline/run now starts the pipeline in a separate thread
       using Python's threading.Thread. It returns { "status": "started" }
       immediately — the HTTP response is not blocked.

       threading.Thread(target=fn, daemon=True).start()
         - target: the function to run in the background
         - daemon=True: thread is killed automatically when the main process
           exits — no orphaned threads if Flask shuts down

    2. PROGRESS STORE
       A module-level dict `_pipeline_progress` acts as shared state between
       the background thread (writer) and the status endpoint (reader).

       Why module-level dict and not a database?
         Progress is ephemeral — we don't need it after the run finishes.
         A dict is instant to read/write with no I/O overhead.

       Is this thread-safe?
         In CPython (standard Python), dict assignment is atomic due to the
         GIL (Global Interpreter Lock). Simple key assignments like
         `_pipeline_progress["current"] = "Arsenal vs Chelsea"` cannot be
         interrupted mid-write. This is sufficient for our use case.
         For production systems with multiple workers you'd use Redis instead.

    3. GET /api/pipeline/status
       Returns the current contents of _pipeline_progress.
       PipelineButton polls this every 1.5 seconds while running.
"""

import threading
from flask import Blueprint, jsonify, request
from sqlalchemy.orm import sessionmaker
from backend.db.schema import engine, Match, Summary, MatchEvent, Team, Competition, MatchStat

api = Blueprint("api", __name__)
SessionLocal = sessionmaker(bind=engine)

# ── Pipeline progress store ────────────────────────────────────────────────
# Written by the pipeline thread, read by GET /api/pipeline/status.
# States: "idle" | "running" | "complete" | "up_to_date" | "error"
_pipeline_progress = {
    "state":       "idle",
    "competition": None,
    "current":     None,   # e.g. "Arsenal FC vs Chelsea FC"
    "index":       0,      # current match number (1-based)
    "total":       0,      # total matches to process
    "ok":          0,      # successfully completed
    "failed":      0,      # failed
    "error":       None,   # error message if state == "error"
}


def _get_db():
    return SessionLocal()


def _match_to_dict(match: Match, session) -> dict:
    home_team = session.query(Team).filter_by(id=match.home_team_id).first()
    away_team = session.query(Team).filter_by(id=match.away_team_id).first()
    competition = session.query(Competition).filter_by(id=match.competition_id).first()
    summary_exists = session.query(Summary).filter_by(match_id=match.id).first() is not None

    return {
        "id": match.id,
        "competition": competition.name if competition else "Unknown",
        "competition_code": competition.code if competition else None,
        "matchday": match.matchday,
        "date": match.utc_date.strftime("%Y-%m-%d") if match.utc_date else None,
        "status": match.status,
        "home_team": home_team.name if home_team else "Unknown",
        "away_team": away_team.name if away_team else "Unknown",
        "home_score": match.home_score,
        "away_score": match.away_score,
        "has_summary": summary_exists,
    }


@api.route("/health")
def health():
    return jsonify({"status": "ok", "service": "football-analytics-api"})


@api.route("/matches")
def get_matches():
    """
    GET /api/matches
    Returns finished matches ordered by date descending.
    Query params: limit (default 20), competition (e.g. PL)
    """
    limit = request.args.get("limit", 20, type=int)
    competition_code = request.args.get("competition", None)

    session = _get_db()
    try:
        query = (
            session.query(Match)
            .filter(Match.status == "FINISHED")
            .order_by(Match.utc_date.desc())
        )
        if competition_code:
            query = (
                query
                .join(Competition, Match.competition_id == Competition.id)
                .filter(Competition.code == competition_code)
            )
        matches = query.limit(limit).all()
        return jsonify([_match_to_dict(m, session) for m in matches])
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@api.route("/matches/<int:match_id>")
def get_match(match_id: int):
    """GET /api/matches/<id> — single match detail."""
    session = _get_db()
    try:
        match = session.query(Match).filter_by(id=match_id).first()
        if not match:
            return jsonify({"error": f"Match {match_id} not found"}), 404
        return jsonify(_match_to_dict(match, session))
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@api.route("/matches/<int:match_id>/stats")
def get_match_stats(match_id: int):
    """
    GET /api/matches/<id>/stats
    Returns team-level stats from the match_stats table.
    """
    session = _get_db()
    try:
        match = session.query(Match).filter_by(id=match_id).first()
        if not match:
            return jsonify({"error": f"Match {match_id} not found"}), 404

        home_team = session.query(Team).filter_by(id=match.home_team_id).first()
        away_team = session.query(Team).filter_by(id=match.away_team_id).first()

        stat_rows = session.query(MatchStat).filter_by(match_id=match_id).all()

        if not stat_rows:
            return jsonify({
                "match_id": match_id,
                "available": False,
                "note": "No stats found. Run the pipeline for this match."
            })

        def _row_to_dict(row: MatchStat) -> dict:
            return {
                "possession":          row.possession,
                "xg":                  row.xg,
                "big_chances":         row.big_chances,
                "total_shots":         row.total_shots,
                "shots_on_target":     row.shots_on_target,
                "shots_off_target":    row.shots_off_target,
                "shots_inside_box":    row.shots_inside_box,
                "passes":              row.passes,
                "accurate_passes":     row.accurate_passes,
                "pass_accuracy":       row.pass_accuracy,
                "tackles":             row.tackles,
                "interceptions":       row.interceptions,
                "recoveries":          row.recoveries,
                "clearances":          row.clearances,
                "fouls":               row.fouls,
                "final_third_entries": row.final_third_entries,
                "goalkeeper_saves":    row.goalkeeper_saves,
                "goals_prevented":     row.goals_prevented,
            }

        home_row = next((r for r in stat_rows if r.is_home), None)
        away_row = next((r for r in stat_rows if not r.is_home), None)

        home_dict = _row_to_dict(home_row) if home_row else {}
        away_dict = _row_to_dict(away_row) if away_row else {}

        home_dict["team"] = home_team.name if home_team else "Home"
        away_dict["team"] = away_team.name if away_team else "Away"

        return jsonify({
            "match_id": match_id,
            "available": True,
            "home": home_dict,
            "away": away_dict,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@api.route("/matches/<int:match_id>/summary")
def get_summary(match_id: int):
    """GET /api/matches/<id>/summary — AI-generated match analysis."""
    session = _get_db()
    try:
        summary = session.query(Summary).filter_by(match_id=match_id).first()
        if not summary:
            return jsonify({"error": f"No summary for match {match_id}."}), 404
        return jsonify({
            "match_id": match_id,
            "content": summary.content,
            "generated_at": summary.generated_at.isoformat() if summary.generated_at else None,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@api.route("/matches/<int:match_id>/events")
def get_events(match_id: int):
    """GET /api/matches/<id>/events — goals, cards, substitutions."""
    session = _get_db()
    try:
        events = (
            session.query(MatchEvent)
            .filter_by(match_id=match_id)
            .order_by(MatchEvent.minute)
            .all()
        )
        if not events:
            return jsonify({"match_id": match_id, "events": [], "note": "No events recorded."})

        return jsonify({
            "match_id": match_id,
            "events": [{
                "type": e.event_type,
                "minute": e.minute,
                "player": e.player_name,
                "secondary_player": e.secondary_player_name,
                "detail": e.detail,
                "reason": e.reason,
            } for e in events]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@api.route("/pipeline/status")
def pipeline_status():
    """
    GET /api/pipeline/status
    Returns the current state of the pipeline progress store.
    Polled by PipelineButton every 1.5 seconds while running.
    Safe to call at any time — always returns the current snapshot.
    """
    return jsonify(_pipeline_progress)


@api.route("/pipeline/run", methods=["POST"])
def run_pipeline():
    """
    POST /api/pipeline/run — starts pipeline in a background thread.

    Returns { "status": "started" } immediately.
    Progress is tracked in _pipeline_progress and readable via
    GET /api/pipeline/status.

    WHY A BACKGROUND THREAD:
        The pipeline takes several minutes. Blocking the HTTP response
        would cause the frontend to wait with no feedback, and eventually
        time out. A background thread lets us return immediately while
        the pipeline runs independently.

    GUARD AGAINST DOUBLE-RUN:
        If the pipeline is already running, we reject the request with 409
        (Conflict). Running two pipelines simultaneously would cause race
        conditions on the DB and exhaust the Groq token budget faster.
    """
    global _pipeline_progress

    # Prevent double-run
    if _pipeline_progress["state"] == "running":
        return jsonify({
            "status": "already_running",
            "message": "Pipeline is already running. Wait for it to complete.",
        }), 409

    try:
        from backend.main import run_pipeline as _run_pipeline, COMPETITIONS

        body = request.get_json(silent=True) or {}
        competition_code = body.get("competition", "PL")

        if competition_code not in COMPETITIONS:
            return jsonify({
                "error": f"Unknown competition: {competition_code}",
                "supported": list(COMPETITIONS.keys()),
            }), 400

        comp_name = COMPETITIONS[competition_code]["name"]

        # Reset progress store for this run
        _pipeline_progress.update({
            "state":       "running",
            "competition": comp_name,
            "current":     "Fetching match list...",
            "index":       0,
            "total":       0,
            "ok":          0,
            "failed":      0,
            "error":       None,
        })

        def progress_callback(event: str, data: dict):
            """
            Called by the pipeline to report progress.
            Events:
              "total_found"  — how many matches need processing
              "match_start"  — about to process a match
              "match_done"   — match completed (ok or error)
              "up_to_date"   — nothing to process
              "complete"     — all done
            """
            if event == "total_found":
                _pipeline_progress["total"] = data["total"]
                if data["total"] == 0:
                    _pipeline_progress["state"] = "up_to_date"
                    _pipeline_progress["current"] = "Fetching matchups... seems up-to-date"

            elif event == "match_start":
                _pipeline_progress["current"] = (
                    f"{data['home']} vs {data['away']}"
                )
                _pipeline_progress["index"] = data["index"]

            elif event == "match_done":
                if data["status"] == "ok":
                    _pipeline_progress["ok"] += 1
                else:
                    _pipeline_progress["failed"] += 1

            elif event == "up_to_date":
                _pipeline_progress["state"] = "up_to_date"
                _pipeline_progress["current"] = "Fetching matchups... seems up-to-date"

            elif event == "complete":
                _pipeline_progress["state"] = "complete"
                _pipeline_progress["current"] = None

        def run_in_background():
            try:
                _run_pipeline(
                    competition_code=competition_code,
                    progress_callback=progress_callback,
                )
            except Exception as e:
                _pipeline_progress["state"] = "error"
                _pipeline_progress["error"] = str(e)

        # daemon=True: thread is killed when Flask process exits
        thread = threading.Thread(target=run_in_background, daemon=True)
        thread.start()

        return jsonify({
            "status": "started",
            "competition": comp_name,
        })

    except Exception as e:
        _pipeline_progress["state"] = "error"
        _pipeline_progress["error"] = str(e)
        return jsonify({"error": str(e), "status": "pipeline_failed"}), 500
