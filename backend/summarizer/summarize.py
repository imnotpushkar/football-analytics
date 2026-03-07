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
    - Explicitly forbidding the model from overriding formation data
    - One-player-per-line format for the Players section enforces specificity

WHY FEW-SHOT EXAMPLES WERE NOT USED:
    Few-shot prompting (including worked examples in the prompt) costs
    300-500 tokens per example on every API call. With a 100k/day budget
    and ~2300 tokens per match, adding two examples would reduce our
    daily match capacity from ~43 to ~30. The formation problem is better
    solved by a stronger constraint instruction (zero token overhead)
    than by examples. Few-shot is appropriate when the output FORMAT
    needs demonstrating — not when the issue is ignoring provided data.
"""

import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()


def _get_client() -> Groq:
    """
    Creates and returns a Groq API client.
    Factory function — fails loudly only when called, not at import time.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError(
            "GROQ_API_KEY not found in environment. "
            "Check your .env file."
        )
    return Groq(api_key=api_key)


def _build_system_prompt() -> str:
    """
    Returns the static system prompt.

    Session 15 change: Added explicit formation authority rule.
    The model was overriding provided formation data with its own
    training knowledge (e.g. writing 4-3-3 for Barcelona when the
    data said 4-2-3-1). The fix is a strong explicit constraint —
    the provided FORMATIONS block is ground truth and must not be
    changed or reinterpreted under any circumstances.
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

CRITICAL RULES — VIOLATION OF ANY OF THESE IS NOT ACCEPTABLE:
- FORMATIONS ARE GROUND TRUTH. The formation strings in the FORMATIONS block (e.g. "4-2-3-1", "4-4-2") are the confirmed tactical setups. You must use them exactly as provided. Never substitute, infer, or correct them based on your training knowledge. If the data says 4-2-3-1, write 4-2-3-1 — not 4-3-3, not 4-1-4-1.
- Never fabricate goals, assists, cards, or stats not provided in the match data
- Only reference players explicitly listed in the lineups — never invent players
- Use the MATCH EVENTS block as the sole source of truth for all match incidents
- If a player name in the events is "Unknown", do not reference that event at all
- Write in confident, declarative sentences — no hedging"""


def _build_user_prompt(context: dict) -> str:
    """
    Builds the dynamic user prompt from the match context dict.

    Args:
        context: Dict with keys from build_match_context() in cleaner.py

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

    # Build stats block
    stats_lines = []
    all_stat_keys = set(home_stats.keys()) | set(away_stats.keys())
    for key in sorted(all_stat_keys):
        h_val = home_stats.get(key, "N/A")
        a_val = away_stats.get(key, "N/A")
        label = key.replace("_", " ").title()
        stats_lines.append(f"  {label}: {h_val} vs {a_val}")

    stats_block = "\n".join(stats_lines) if stats_lines else "  No stats available."

    hints_block = "\n".join(
        f"  - {hint}" for hint in narrative_hints
    ) if narrative_hints else "  None."

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

    # Repeat the formation constraint inline in the user prompt as well.
    # Stating a rule in both the system prompt and the user prompt is a
    # known technique for reducing LLM non-compliance — the model sees
    # the constraint at two points in its context window.
    formation_note = (
        f"  IMPORTANT: These formations are confirmed data. "
        f"Use them exactly. Do not change or reinterpret them."
    )

    prompt = f"""MATCH: {home} {home_score} - {away_score} {away}
COMPETITION: {competition} — Matchday {matchday}
DATE: {date}

FORMATIONS ({lineup_status}):
  {home}: {home_formation}
  {away}: {away_formation}
{formation_note}

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

Write the full match analysis following the four-section format. Ground every claim in the events and stats provided above. Use the formations exactly as given."""

    return prompt


def summarize_match(context: dict) -> str:
    """
    Generates a creator-quality match analysis using the Groq API.

    Temperature 0.7: good balance for analytical writing — some variation
    but stays factual and structured. Lower values (0.3-0.5) would make
    the output more deterministic but more repetitive across matches.

    Args:
        context: Match context dict from build_match_context()

    Returns:
        Generated summary string with four ## sections.
    """
    client = _get_client()

    system_prompt = _build_system_prompt()
    user_prompt = _build_user_prompt(context)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=1500,
    )

    summary = response.choices[0].message.content

    # Strip anything before the first ## header — model sometimes adds preamble
    if "##" in summary:
        first_header = summary.index("##")
        summary = summary[first_header:].strip()

    return summary
