// src/components/MatchCard.jsx
//
// Intercepts card click to fetch events + summary, determine animation type,
// then calls onMatchClick to let MatchesPage show the transition overlay.
//
// Click flow:
//   1. User clicks card
//   2. handleClick fires — shows loading spinner on card
//   3. Parallel fetch: /events + /summary for this match
//   4. determineAnimation(match, events, summary) picks animation
//   5. onMatchClick(match, animationType) → MatchesPage shows overlay
//
// We do NOT navigate here. Navigation is owned by MatchesPage after
// the overlay's onDone callback fires.

import { useState } from 'react'
import apiClient from '../api/client'
import { determineAnimation } from '../hooks/useMatchAnimation'

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function MatchCard({ match, onMatchClick }) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (loading) return
    setLoading(true)
    try {
      const [eventsRes, summaryRes] = await Promise.all([
        apiClient.get(`/api/matches/${match.id}/events`).catch(() => ({ data: { events: [] } })),
        apiClient.get(`/api/matches/${match.id}/summary`).catch(() => ({ data: {} })),
      ])
      const events       = eventsRes.data.events || []
      const summaryText  = summaryRes.data.content || ''
      const animationType = determineAnimation(match, events, summaryText)
      onMatchClick(match, animationType)
    } catch (err) {
      // Fallback — still navigate but with corner animation
      onMatchClick(match, 'corner')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`bg-surface p-6 cursor-pointer group relative overflow-hidden hover:bg-surface2 transition-colors duration-150 ${loading ? 'opacity-60 pointer-events-none' : ''}`}
    >
      {/* Hover accent bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-fkgreenbright scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left"/>

      {/* Loading spinner */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/70 z-10">
          <span className="w-5 h-5 border-2 border-fkgreenbright border-t-transparent rounded-full animate-spin"/>
        </div>
      )}

      {/* Competition + date row */}
      <div className="flex items-center justify-between mb-4">
        <span className="font-condensed text-xs font-bold tracking-widest uppercase text-fkgreenbright">
          {match.competition || ''}
        </span>
        <span className="font-condensed text-xs text-textmuted">
          {formatDate(match.date)}
        </span>
      </div>

      {/* Score row */}
      <div className="grid items-center gap-3 mb-4" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
        <div className="text-right">
          <span className="font-condensed text-sm font-semibold text-textprimary leading-tight">
            {match.home_team}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-display text-5xl text-textprimary leading-none">
            {match.home_score ?? '-'}
          </span>
          <span className="font-display text-2xl text-bdrlt mx-1">–</span>
          <span className="font-display text-5xl text-textprimary leading-none">
            {match.away_score ?? '-'}
          </span>
        </div>
        <div className="text-left">
          <span className="font-condensed text-sm font-semibold text-textprimary leading-tight">
            {match.away_team}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-bdr">
        <span className="font-condensed text-xs text-textmuted tracking-wider uppercase">
          {match.matchday ? `MD ${match.matchday}` : ''}
        </span>
        {match.has_summary ? (
          <span className="font-condensed text-xs font-bold tracking-widest uppercase text-fkgreenbright flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-fkgreenbright inline-block"/>
            Analysis Ready
          </span>
        ) : (
          <span className="font-condensed text-xs text-textmuted tracking-wider uppercase">
            No Analysis Yet
          </span>
        )}
      </div>
    </div>
  )
}
