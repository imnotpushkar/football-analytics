// src/hooks/useMatchAnimation.js
//
// Pure function — determines which animation to show for a given match.
// Called in MatchCard before navigating to the detail page.
//
// Priority order — FIRST match wins:
//   1. hattrick      — same player in 3 goal events
//   2. penalty       — penalty goal AND scoring team won
//   3. lastminute    — winning goal at 85+ mins
//   4. gkdive        — goalkeeper named first in Players section of summary
//   5. redcard       — red card or 2nd yellow event exists
//   6. header        — goal event with aerial/header detail
//   7. simplegoal    — any goal exists (generic fallback)
//   8. tactical      — goalless match (0-0)
//   9. corner        — absolute fallback (should rarely trigger)

export function determineAnimation(match, events = [], summary = '') {
  const goals = events.filter(e => e.type === 'goal')
  const cards = events.filter(e => e.type === 'card')
  const homeScore = match?.home_score ?? 0
  const awayScore = match?.away_score ?? 0

  // ── 1. Hat-trick ──────────────────────────────────────────────────────────
  // Count goals per player name — if any player has 3+ they scored a hat-trick
  const scorerCount = goals.reduce((acc, g) => {
    if (!g.player) return acc
    acc[g.player] = (acc[g.player] || 0) + 1
    return acc
  }, {})
  const hattrickEntry = Object.entries(scorerCount).find(([, count]) => count >= 3)
  if (hattrickEntry) {
    // Attach scorer name so HatTrick component can display it
    match.hattrickScorer = hattrickEntry[0]
    return 'hattrick'
  }

  // ── 2. Penalty winner ─────────────────────────────────────────────────────
  // A penalty goal exists AND the team that scored it won the match
  const penGoals = goals.filter(g =>
    g.detail && g.detail.toLowerCase().includes('penalty')
  )
  if (penGoals.length > 0) {
    const homeWon = homeScore > awayScore
    const awayWon = awayScore > homeScore
    const penDecided = penGoals.some(pg => {
      return (pg.is_home && homeWon) || (!pg.is_home && awayWon)
    })
    if (penDecided) return 'penalty'
  }

  // ── 3. Last minute winner ─────────────────────────────────────────────────
  // A goal was scored at minute 85+ AND it was the winning goal
  if (homeScore !== awayScore) {
    const lateGoals = goals.filter(g => (g.minute || 0) >= 85)
    if (lateGoals.length > 0) {
      const lastGoal = [...lateGoals].sort((a, b) => (b.minute || 0) - (a.minute || 0))[0]
      const homeWon = homeScore > awayScore
      const awayWon = awayScore > homeScore
      if ((lastGoal.is_home && homeWon) || (!lastGoal.is_home && awayWon)) {
        match.lateMinute = lastGoal.minute
        return 'lastminute'
      }
    }
  }

  // ── 4. GK top player ──────────────────────────────────────────────────────
  // Parse the AI summary to find if a goalkeeper is the standout player.
  // We look in the "Players Who Made the Difference" section.
  // This is text parsing — slightly fragile, but acceptable for now.
  if (summary) {
    const playerSectionMatch = summary.match(
      /players who made the difference([\s\S]{0,400}?)(?:\n##|\n\n##|$)/i
    )
    if (playerSectionMatch) {
      const sectionText = playerSectionMatch[1].toLowerCase()
      const gkKeywords = ['goalkeeper', 'keeper', 'gk', 'saves', 'clean sheet', 'glove']
      if (gkKeywords.some(kw => sectionText.includes(kw))) return 'gkdive'
    }
  }

  // ── 5. Red card ───────────────────────────────────────────────────────────
  const hasRedCard = cards.some(c =>
    c.detail === 'red' ||
    c.detail === 'yellowRed' ||
    c.detail?.toLowerCase().includes('red')
  )
  if (hasRedCard) return 'redcard'

  // ── 6. Header goal ────────────────────────────────────────────────────────
  const hasHeader = goals.some(g =>
    g.detail && (
      g.detail.toLowerCase().includes('head') ||
      g.detail.toLowerCase().includes('aerial')
    )
  )
  if (hasHeader) return 'header'

  // ── 7. Any goal ───────────────────────────────────────────────────────────
  if (goals.length > 0) return 'simplegoal'

  // ── 8. Goalless ───────────────────────────────────────────────────────────
  if (homeScore === 0 && awayScore === 0) return 'tactical'

  // ── 9. Corner (absolute fallback) ─────────────────────────────────────────
  return 'corner'
}
