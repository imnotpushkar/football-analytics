"""
backend/processors/formation_roles.py

Maps SofaScore lineup data + formation string to tactical role labels.
Used by the AI summarizer to generate technically precise analysis
using proper football terminology.

ARCHITECTURE:
    There are two layers of role assignment:

    Layer 1 — Static (available now):
        FORMATION_ROLES dict maps player index → default tactical role.
        Based on formation string and positional ordering from SofaScore.
        You can manually edit this dict to set roles you know are correct
        (e.g. "I know André plays as the pivot, not box-to-box").

    Layer 2 — Dynamic (future, requires per-player stats):
        resolve_dynamic_role() will override the static role based on
        individual stat thresholds when per-player data is available.
        e.g. if player has >5 key passes → "Deep-Lying Playmaker"
             if player has >70 touches + low key passes → "Pivot"
        Currently returns None (no override) until stats are available.

SUPPORTED FORMATIONS:
    Back three: 3-4-3, 3-5-2, 3-5-1-1, 3-4-2-1, 3-1-4-2, 3-4-1-2
    Back four:  4-3-3, 4-2-3-1, 4-4-2, 4-1-4-1, 4-3-2-1, 4-2-2-2, 4-1-2-3
    Back five:  5-3-2, 5-4-1, 5-2-3

HOW TO ADD A NEW FORMATION:
    1. Add a new key to FORMATION_ROLES with the formation string
    2. Add exactly 11 role names in positional order:
       [GK, DEF x N, MID x N, FWD x N]
    3. Use the tactical vocabulary defined in TACTICAL_ROLES_VOCABULARY

TACTICAL VOCABULARY (use these terms consistently):
    Goalkeepers:    "Goalkeeper", "Sweeper Keeper"
    Defenders:      "Right Back", "Left Back", "Right Centre-Back",
                    "Centre-Back", "Left Centre-Back",
                    "Right Wingback", "Left Wingback"
    Midfielders:    "Single Pivot", "Pivot", "Double Pivot (Right/Left)",
                    "Deep-Lying Playmaker", "Box-to-Box Midfielder",
                    "Number 10 / Zone 14 Operator", "Right/Left Halfspace Midfielder",
                    "Right/Left Attacking Midfielder", "Right/Left Midfielder"
    Forwards:       "Centre Forward", "False 9", "Pressing Forward",
                    "Second Striker", "Shadow Striker",
                    "Right/Left Halfspace Winger", "Right/Left Winger",
                    "Right/Left Inverted Winger"
"""

from typing import Optional


# -------------------------------------------------------------------------
# Formation role maps
# -------------------------------------------------------------------------
# HOW TO READ THIS:
#   Each list has exactly 11 entries — one per player.
#   Order matches SofaScore's player ordering:
#     [0]      = Goalkeeper
#     [1..N]   = Defenders (left to right)
#     [N+1..M] = Midfielders (left to right or by role depth)
#     [M+1..10]= Forwards (left to right)
#
# HOW TO CUSTOMIZE:
#   Change any role string to whatever you know is correct for that team.
#   The AI will use exactly these strings when writing analysis.
#   Example: change "Box-to-Box Midfielder" to "Deep-Lying Playmaker"
#   at index 6 if you know that player drops deep to receive and distribute.
# -------------------------------------------------------------------------

FORMATION_ROLES: dict[str, list[str]] = {

    # ------------------------------------------------------------------
    # BACK THREE SYSTEMS
    # ------------------------------------------------------------------

    "3-5-2": [
        "Goalkeeper",           # 0
        "Right Centre-Back",    # 1
        "Centre-Back",          # 2
        "Left Centre-Back",     # 3
        "Right Wingback",       # 4  — attacking width on right
        "Attacking Midfielder", # 5  — could be Deep-Lying Playmaker
        "Pivot",                # 6  — single pivot shields back three
        "Box-to-Box Midfielder",# 7  — could be Deep-Lying Playmaker
        "Left Wingback",        # 8  — attacking width on left
        "Centre Forward",       # 9
        "Second Striker",       # 10 — drops between lines
    ],

    "3-5-1-1": [
        "Goalkeeper",                    # 0
        "Right Centre-Back",             # 1
        "Centre-Back",                   # 2
        "Left Centre-Back",              # 3
        "Right Wingback",                # 4
        "Box-to-Box Midfielder",         # 5  — could be Deep-Lying Playmaker
        "Pivot",                         # 6  — single pivot
        "Box-to-Box Midfielder",         # 7  — could be Deep-Lying Playmaker
        "Left Wingback",                 # 8
        "Number 10 / Zone 14 Operator",  # 9  — operates between lines
        "Centre Forward",                # 10
    ],

    "3-4-3": [
        "Goalkeeper",               # 0
        "Right Centre-Back",        # 1
        "Centre-Back",              # 2
        "Left Centre-Back",         # 3
        "Right Midfielder",         # 4
        "Double Pivot (Right)",     # 5
        "Double Pivot (Left)",      # 6
        "Left Midfielder",          # 7
        "Right Halfspace Winger",   # 8  — cuts inside from right
        "Centre Forward",           # 9
        "Left Halfspace Winger",    # 10 — cuts inside from left
    ],

    "3-4-2-1": [
        "Goalkeeper",                        # 0
        "Right Centre-Back",                 # 1
        "Centre-Back",                       # 2
        "Left Centre-Back",                  # 3
        "Right Wingback",                    # 4
        "Double Pivot (Right)",              # 5
        "Double Pivot (Left)",               # 6
        "Left Wingback",                     # 7
        "Right Halfspace / Shadow Striker",  # 8
        "Left Halfspace / Shadow Striker",   # 9
        "Centre Forward",                    # 10
    ],

    "3-1-4-2": [
        "Goalkeeper",                   # 0
        "Right Centre-Back",            # 1
        "Centre-Back",                  # 2
        "Left Centre-Back",             # 3
        "Single Pivot",                 # 4  — sole DM
        "Box-to-Box Midfielder",        # 5
        "Box-to-Box Midfielder",        # 6
        "Left Central Midfielder",      # 7
        "Left Halfspace Midfielder",    # 8
        "Centre Forward",               # 9
        "Second Striker",               # 10
    ],

    "3-4-1-2": [
        "Goalkeeper",                    # 0
        "Right Centre-Back",             # 1
        "Centre-Back",                   # 2
        "Left Centre-Back",              # 3
        "Right Wingback",                # 4
        "Double Pivot (Right)",          # 5
        "Double Pivot (Left)",           # 6
        "Left Wingback",                 # 7
        "Number 10 / Zone 14 Operator",  # 8
        "Centre Forward",                # 9
        "Second Striker",                # 10
    ],

    # ------------------------------------------------------------------
    # BACK FOUR SYSTEMS
    # ------------------------------------------------------------------

    "4-3-3": [
        "Goalkeeper",               # 0
        "Right Back",               # 1  — could be Inverted Right Back
        "Right Centre-Back",        # 2
        "Left Centre-Back",         # 3
        "Left Back",                # 4  — could be Inverted Left Back
        "Single Pivot",             # 5
        "Right Central Midfielder", # 6  — could be Box-to-Box
        "Left Central Midfielder",  # 7  — could be Box-to-Box
        "Right Winger",             # 8
        "Centre Forward",           # 9  — could be False 9
        "Left Halfspace Winger",    # 10
    ],

    "4-2-3-1": [
        "Goalkeeper",                    # 0
        "Right Back",                    # 1
        "Right Centre-Back",             # 2
        "Left Centre-Back",              # 3
        "Left Back",                     # 4
        "Double Pivot (Right)",          # 5
        "Double Pivot (Left)",           # 6
        "Right Winger",                  # 7  — halfspace right
        "Number 10 / Zone 14 Operator",  # 8  — central AM
        "Left Winger",                   # 9  — halfspace left
        "Centre Forward",                # 10
    ],

    "4-3-2-1": [
        "Goalkeeper",                        # 0
        "Right Back",                        # 1
        "Right Centre-Back",                 # 2
        "Left Centre-Back",                  # 3
        "Left Back",                         # 4
        "Single Pivot",                      # 5
        "Box-to-Box Midfielder",             # 6
        "Left Central Midfielder",           # 7
        "Right Halfspace / Shadow Striker",  # 8
        "Left Halfspace / Shadow Striker",   # 9
        "Centre Forward",                    # 10
    ],

    "4-4-2": [
        "Goalkeeper",               # 0
        "Right Back",               # 1
        "Right Centre-Back",        # 2
        "Left Centre-Back",         # 3
        "Left Back",                # 4
        "Right Midfielder",         # 5
        "Right Central Midfielder", # 6  — could be Box-to-Box
        "Left Central Midfielder",  # 7  — could be Deep-Lying Playmaker
        "Left Midfielder",          # 8
        "Centre Forward",           # 9
        "Second Striker",           # 10
    ],

    "4-4-2 (Diamond)": [
        "Goalkeeper",                    # 0
        "Right Back",                    # 1
        "Right Centre-Back",             # 2
        "Left Centre-Back",              # 3
        "Left Back",                     # 4
        "Defensive Midfielder / Pivot",  # 5
        "Right Central Midfielder",      # 6
        "Left Central Midfielder",       # 7
        "Number 10 / Zone 14 Operator",  # 8
        "Centre Forward",                # 9
        "Second Striker",                # 10
    ],

    "4-1-4-1": [
        "Goalkeeper",               # 0
        "Right Back",               # 1
        "Right Centre-Back",        # 2
        "Left Centre-Back",         # 3
        "Left Back",                # 4
        "Single Pivot",             # 5
        "Right Midfielder",         # 6
        "Right Central Midfielder", # 7
        "Left Central Midfielder",  # 8
        "Left Midfielder",          # 9
        "Centre Forward / False 9", # 10
    ],

    "4-2-2-2": [
        "Goalkeeper",                   # 0
        "Right Back",                   # 1
        "Right Centre-Back",            # 2
        "Left Centre-Back",             # 3
        "Left Back",                    # 4
        "Double Pivot (Right)",         # 5
        "Double Pivot (Left)",          # 6
        "Right Halfspace Midfielder",   # 7
        "Left Halfspace Midfielder",    # 8
        "Right Centre Forward",         # 9
        "Left Centre Forward",          # 10
    ],

    "4-1-2-3": [
        "Goalkeeper",               # 0
        "Right Back",               # 1
        "Right Centre-Back",        # 2
        "Left Centre-Back",         # 3
        "Left Back",                # 4
        "Single Pivot",             # 5
        "Right Central Midfielder", # 6
        "Left Central Midfielder",  # 7
        "Right Winger",             # 8
        "Centre Forward",           # 9
        "Left Winger",              # 10
    ],

    # ------------------------------------------------------------------
    # BACK FIVE SYSTEMS
    # ------------------------------------------------------------------

    "5-3-2": [
        "Goalkeeper",               # 0
        "Right Wingback",           # 1
        "Right Centre-Back",        # 2
        "Centre-Back",              # 3
        "Left Centre-Back",         # 4
        "Left Wingback",            # 5
        "Right Central Midfielder", # 6  — could be Box-to-Box
        "Pivot",                    # 7
        "Left Central Midfielder",  # 8  — could be Box-to-Box
        "Centre Forward",           # 9
        "Second Striker",           # 10
    ],

    "5-4-1": [
        "Goalkeeper",                   # 0
        "Right Wingback",               # 1
        "Right Centre-Back",            # 2
        "Centre-Back",                  # 3
        "Left Centre-Back",             # 4
        "Left Wingback",                # 5
        "Right Midfielder",             # 6
        "Right Central Midfielder",     # 7
        "Left Central Midfielder",      # 8
        "Left Midfielder",              # 9
        "Centre Forward / Pressing Forward", # 10
    ],

    "5-2-3": [
        "Goalkeeper",               # 0
        "Right Wingback",           # 1
        "Right Centre-Back",        # 2
        "Centre-Back",              # 3
        "Left Centre-Back",         # 4
        "Left Wingback",            # 5
        "Double Pivot (Right)",     # 6
        "Double Pivot (Left)",      # 7
        "Right Halfspace Winger",   # 8
        "Centre Forward",           # 9
        "Left Halfspace Winger",    # 10
    ],
}


# -------------------------------------------------------------------------
# Fallback role names by SofaScore position tag
# Used when formation is not in FORMATION_ROLES
# -------------------------------------------------------------------------

POSITION_FALLBACKS: dict[str, str] = {
    "G": "Goalkeeper",
    "D": "Defender",
    "M": "Midfielder",
    "F": "Forward",
    "GK": "Goalkeeper",
    "CB": "Centre-Back",
    "LB": "Left Back",
    "RB": "Right Back",
    "WB": "Wingback",
    "DM": "Defensive Midfielder / Pivot",
    "CM": "Central Midfielder",
    "AM": "Attacking Midfielder",
    "LM": "Left Midfielder",
    "RM": "Right Midfielder",
    "LW": "Left Winger",
    "RW": "Right Winger",
    "SS": "Shadow / Second Striker",
    "CF": "Centre Forward",
    "ST": "Striker",
}


# -------------------------------------------------------------------------
# Dynamic role resolver (future — requires per-player stats)
# -------------------------------------------------------------------------

def resolve_dynamic_role(
    static_role: str,
    player_stats: Optional[dict] = None
) -> Optional[str]:
    """
    Overrides the static formation role based on individual player stats.

    CURRENTLY RETURNS None (no override) because our SofaScore free tier
    does not provide per-player statistics. The endpoints
    match/player-statistics and match/player-ratings both return 404.

    When per-player stats become available (via a paid API tier or a
    different data source), implement the logic below:

    Planned thresholds (subject to refinement with real data):
        touches > 70 AND key_passes < 2          → "Pivot"
        key_passes >= 3 AND prog_passes > 5      → "Deep-Lying Playmaker"
        final_third_entries > 8                  → "Box-to-Box Midfielder"
        dribbles > 3 AND halfspace_touches > 10  → "Halfspace Winger"
        pressing_duels > 6                       → "Pressing Forward"
        aerial_duels_won > 5                     → "Target Man"

    Args:
        static_role: The role assigned by FORMATION_ROLES dict
        player_stats: Dict of individual player stats (not yet available)

    Returns:
        Overriding role string, or None to keep the static role.
    """
    if not player_stats:
        return None

    # --- FUTURE IMPLEMENTATION ---
    # touches = player_stats.get("touches", 0)
    # key_passes = player_stats.get("key_passes", 0)
    # prog_passes = player_stats.get("progressive_passes", 0)
    # final_third = player_stats.get("final_third_entries", 0)
    # dribbles = player_stats.get("dribbles_completed", 0)
    
    # if "Midfielder" in static_role or "Pivot" in static_role:
    #     if touches > 70 and key_passes < 2:
    #         return "Pivot"
    #     if key_passes >= 3 and prog_passes > 5:
    #         return "Deep-Lying Playmaker"
    #     if final_third > 8:
    #         return "Box-to-Box Midfielder"
    # -----------------------------

    return None


# -------------------------------------------------------------------------
# Core mapper
# -------------------------------------------------------------------------

def map_tactical_roles(
    players: list[dict],
    formation: str,
    player_stats_map: Optional[dict] = None
) -> list[dict]:
    """
    Assigns tactical role labels to each player based on formation.
    Optionally overrides static roles with dynamic ones from per-player stats.

    Args:
        players: List of player dicts from clean_sofascore_lineups().
                 Each dict has: name, short_name, position, jersey_number
        formation: Formation string e.g. "3-5-1-1", "4-2-3-1"
        player_stats_map: Optional dict mapping player_id → stats dict.
                          Pass None (default) until per-player stats available.

    Returns:
        Same list with "tactical_role" added to each player dict.
    """
    role_list = FORMATION_ROLES.get(formation)

    enriched = []
    for i, player in enumerate(players):
        enriched_player = dict(player)

        # Layer 1: static role from formation dict
        if role_list and i < len(role_list):
            static_role = role_list[i]
        else:
            position_tag = player.get("position", "")
            first_letter = position_tag[0].upper() if position_tag else "M"
            static_role = POSITION_FALLBACKS.get(
                first_letter,
                position_tag or "Unknown Role"
            )

        # Layer 2: dynamic override from per-player stats (future)
        player_id = player.get("id")
        player_stats = (
            player_stats_map.get(player_id)
            if player_stats_map and player_id
            else None
        )
        dynamic_role = resolve_dynamic_role(static_role, player_stats)

        enriched_player["tactical_role"] = dynamic_role or static_role
        enriched.append(enriched_player)

    return enriched


def get_supported_formations() -> list[str]:
    """Returns list of all formations with defined role mappings."""
    return list(FORMATION_ROLES.keys())


def formation_is_supported(formation: str) -> bool:
    """Checks whether a formation has a defined role mapping."""
    return formation in FORMATION_ROLES


# -------------------------------------------------------------------------
# Quick test
# -------------------------------------------------------------------------

if __name__ == "__main__":
    wolves_players = [
        {"name": "José Sá", "position": "Goalkeeper", "jersey_number": "1"},
        {"name": "Matt Doherty", "position": "Defender", "jersey_number": "2"},
        {"name": "Santiago Bueno", "position": "Defender", "jersey_number": "4"},
        {"name": "Ladislav Krejčí", "position": "Defender", "jersey_number": "37"},
        {"name": "Jackson Tchatchoua", "position": "Midfielder", "jersey_number": "38"},
        {"name": "Mateus Mane", "position": "Midfielder", "jersey_number": "11"},
        {"name": "André", "position": "Midfielder", "jersey_number": "8"},
        {"name": "João Gomes", "position": "Midfielder", "jersey_number": "6"},
        {"name": "David Møller Wolfe", "position": "Midfielder", "jersey_number": "19"},
        {"name": "Angel Gomes", "position": "Forward", "jersey_number": "10"},
        {"name": "Adam Armstrong", "position": "Forward", "jersey_number": "9"},
    ]

    liverpool_players = [
        {"name": "Alisson", "position": "Goalkeeper", "jersey_number": "1"},
        {"name": "Jeremie Frimpong", "position": "Midfielder", "jersey_number": "30"},
        {"name": "Ibrahima Konaté", "position": "Defender", "jersey_number": "5"},
        {"name": "Virgil van Dijk", "position": "Defender", "jersey_number": "4"},
        {"name": "Miloš Kerkez", "position": "Defender", "jersey_number": "6"},
        {"name": "Ryan Gravenberch", "position": "Midfielder", "jersey_number": "38"},
        {"name": "Alexis Mac Allister", "position": "Midfielder", "jersey_number": "10"},
        {"name": "Mohamed Salah", "position": "Forward", "jersey_number": "11"},
        {"name": "Dominik Szoboszlai", "position": "Midfielder", "jersey_number": "8"},
        {"name": "Cody Gakpo", "position": "Forward", "jersey_number": "18"},
        {"name": "Hugo Ekitike", "position": "Forward", "jersey_number": "9"},
    ]

    print("=== Wolves 3-5-1-1 Tactical Roles ===")
    wolves_roles = map_tactical_roles(wolves_players, "3-5-1-1")
    for p in wolves_roles:
        print(f"  {p['name']:25} → {p['tactical_role']}")

    print("\n=== Liverpool 4-2-3-1 Tactical Roles ===")
    liverpool_roles = map_tactical_roles(liverpool_players, "4-2-3-1")
    for p in liverpool_roles:
        print(f"  {p['name']:25} → {p['tactical_role']}")

    print(f"\nSupported formations: {len(get_supported_formations())}")

    print("\n=== Fallback test (unknown formation) ===")
    fallback_roles = map_tactical_roles(wolves_players[:3], "4-6-0")
    for p in fallback_roles:
        print(f"  {p['name']:25} → {p['tactical_role']}")