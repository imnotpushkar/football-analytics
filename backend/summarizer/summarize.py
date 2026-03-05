"""
backend/summarizer/summarize.py

Generates creator-quality match analysis using the Groq API.

WHY GROQ:
    Groq provides a free tier for LLM inference. It runs Meta's
    LLaMA models at extremely high speed (tokens/second) compared
    to other providers. Free tier is sufficient for this project.
    Model: llama-3.3-70b-versatile — strong reasoning, good at
    structured output, follows formatting instructions reliably.

HOW THE PROMPT IS STRUCTURED:
    We use a two-message structure:
    1. System message — sets the AI's role and output format.
       Think of this as the standing instructions that never change.
    2. User message — the actual match data for this specific game.
       Built dynamically from the context dict.

    This separation matters: the system message shapes HOW the AI
    writes; the user message gives it WHAT to write about.

HALLUCINATION PREVENTION:
    LLMs will invent plausible-sounding details if not grounded.
    We prevent this by:
    - Explicitly listing every player with their role
    - Including a structured events_text block with actual goals/cards
    - Instructing the model to only reference players from the provided list
    - One-player-per-line format for the Players section enforces specificity

FUNCTIONS:
    summarize_match(context) -> str
        Main entry point. Takes a context dict built by
        build_match_context() in cleaner.py. Returns summary string.

    _build_system_prompt() -> str
        Returns the static system prompt defining output style.

    _build_user_prompt(context) -> str
        Builds the dynamic user prompt from match context data.
"""

import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Client initialisation
# ---------------------------------------------------------------------------

def _get_client() -> Groq:
    """
    Creates and returns a Groq API client.

    WHY A FUNCTION INSTEAD OF A MODULE-LEVEL VARIABLE:
        If we wrote `client = Groq(api_key=...)` at module level,
        the client would be created at import time. If the .env file
        isn't loaded yet or the key is missing, it silently creates
        a broken client. A factory function fails loudly and late —
        only when actually called — which is easier to debug.

    Raises:
        ValueError if GROQ_API_KEY is not set in environment.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError(
            "GROQ_API_KEY not found in environment. "
            "Check your .env file."
        )
    return Groq(api_key=api_key)


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------

def _build_system_prompt() -> str:
    """
    Returns the static system prompt.

    This is the instruction layer — it tells the model WHO it is
    and HOW to write. It never changes between matches.

    The style target is Tifo Football / The Athletic:
    - Tactical vocabulary (halfspace, pivot, zone 14, pressing)
    - Opinionated — takes a position on what happened
    - Stats as evidence, not decoration
    - Events (goals, cards) as anchors for the narrative
    """
    return """You are a football analyst writing for a premium football media outlet in the style of Tifo Football or The Athletic.

Your analysis must be:
- Tactically specific: use terms like halfspace, pivot, zone 14, pressing intensity, overloads, ball progression
- Opinionated: take a clear position on why the result happened
- Grounded in the match events provided: reference actual goals (who scored, when, how) and cards
- Evidence-based: cite the stats provided as proof for tactical claims

Output format — four sections, each with an ALL CAPS header prefixed by ##:

## THE STORY OF THE MATCH
2-3 paragraphs. Set the scene, describe the flow of the match, reference actual goals and key incidents by minute and player name. Never invent events.

## TACTICAL BREAKDOWN
2-3 paragraphs. Analyse formations, pressing schemes, how each team tried to create and prevent chances. Reference specific players in specific roles.

## PLAYERS WHO MADE THE DIFFERENCE
List each key player on its own line using this exact format:
* [Player Name], [role label]: [one sentence on their specific impact]

Only include players from the provided lineup. Do not invent players.

## THE VERDICT
1-2 paragraphs. Who deserved to win and why? What does this result tell us about each team?

CRITICAL RULES:
- Never fabricate goals, assists, cards, or stats not provided
- Only reference players explicitly listed in the lineups
- Use the events block as the single source of truth for match incidents
- Write in confident, declarative sentences — no hedging"""


def _build_user_prompt(context: dict) -> str:
    """
    Builds the dynamic user prompt from the match context dict.

    The context dict comes from build_match_context() in cleaner.py.
    We extract every useful field and structure it clearly so the
    model has all the evidence it needs to write accurate analysis.

    Args:
        context: Dict with keys:
            home_team, away_team, home_score, away_score,
            competition, matchday, date,
            home_stats, away_stats, narrative_hints,
            home_formation, away_formation,
            home_players, away_players, lineups_confirmed,
            goals, cards, substitutions, events_text

    Returns:
        Formatted string to send as the user message.
    """
    home = context.get("home_team", "Home")
    away = context.get("away_team", "Away")
    home_score = context.get("home_score", "?")
    away_score = context.get("away_score", "?")
    competition = context.get("competition", "Unknown")
    matchday = context.get("matchday", "?")
    date = context.get("date", "Unknown")

    home_formation = context.get("home_formation", "Unknown")
    away_formation = context.get("away_formation", "Unknown")
    lineups_confirmed = context.get("lineups_confirmed", False)

    home_stats = context.get("home_stats", {})
    away_stats = context.get("away_stats", {})
    narrative_hints = context.get("narrative_hints", [])

    home_players = context.get("home_players", [])
    away_players = context.get("away_players", [])

    events_text = context.get("events_text", "No events data available.")

    # --- Build stats block ---
    # Only include stats that actually exist in both sides
    stats_lines = []
    all_stat_keys = set(home_stats.keys()) | set(away_stats.keys())
    for key in sorted(all_stat_keys):
        h_val = home_stats.get(key, "N/A")
        a_val = away_stats.get(key, "N/A")
        # Format key from snake_case to Title Case for readability
        label = key.replace("_", " ").title()
        stats_lines.append(f"  {label}: {h_val} vs {a_val}")

    stats_block = "\n".join(stats_lines) if stats_lines else "  No stats available."

    # --- Build narrative hints block ---
    hints_block = "\n".join(
        f"  - {hint}" for hint in narrative_hints
    ) if narrative_hints else "  None."

    # --- Build lineup blocks ---
    def format_players(players: list) -> str:
        if not players:
            return "  Not available."
        lines = []
        for p in players:
            name = p.get("name", "Unknown")
            role = p.get("role", "")
            if role:
                lines.append(f"  - {name} ({role})")
            else:
                lines.append(f"  - {name}")
        return "\n".join(lines)

    home_lineup_block = format_players(home_players)
    away_lineup_block = format_players(away_players)
    lineup_status = "confirmed" if lineups_confirmed else "unconfirmed"

    # --- Assemble full prompt ---
    prompt = f"""MATCH: {home} {home_score} - {away_score} {away}
COMPETITION: {competition} — Matchday {matchday}
DATE: {date}

FORMATIONS ({lineup_status}):
  {home}: {home_formation}
  {away}: {away_formation}

MATCH EVENTS (source of truth — only reference these incidents):
{events_text}

STATISTICS ({home} vs {away}):
{stats_block}

NARRATIVE HINTS FROM DATA:
{hints_block}

{home.upper()} LINEUP:
{home_lineup_block}

{away.upper()} LINEUP:
{away_lineup_block}

Write the full match analysis following the four-section format. Ground every claim in the events and stats provided above."""

    return prompt


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def summarize_match(context: dict) -> str:
    """
    Generates a creator-quality match analysis using the Groq API.

    Called by backend/main.py step_summarize() with a context dict
    built by build_match_context() in cleaner.py.

    HOW THE GROQ API CALL WORKS:
        client.chat.completions.create() sends a request to Groq's
        inference API. It follows the OpenAI Chat Completions format —
        a list of messages with 'role' (system/user/assistant) and 'content'.

        The response object has:
            response.choices[0].message.content — the generated text
            response.usage.total_tokens — how many tokens were used

        Groq's free tier has rate limits (requests/minute, tokens/minute).
        For a single pipeline run this is never an issue.

    Args:
        context: Match context dict from build_match_context()

    Returns:
        Generated summary string with four ## sections.

    Raises:
        Exception if Groq API call fails — caller handles gracefully.
    """
    client = _get_client()

    system_prompt = _build_system_prompt()
    user_prompt = _build_user_prompt(context)

    # Temperature controls randomness:
    # 0.0 = deterministic, always same output
    # 1.0 = very creative/random
    # 0.7 = good balance for analytical writing — some variation
    # but stays factual and structured
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=1500,
    )

    summary = response.choices[0].message.content

    # Basic post-processing — strip leading/trailing whitespace
    # The model sometimes adds preamble before the first ## header
    # We trim anything before the first ## to enforce clean output
    if "##" in summary:
        first_header = summary.index("##")
        summary = summary[first_header:].strip()

    return summary
