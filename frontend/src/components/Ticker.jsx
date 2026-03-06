// src/components/Ticker.jsx
//
// Scrolling ticker bar showing latest match results.
// Pulls live from GET /api/matches on mount.
//
// CSS animation technique:
// We duplicate the list of items and concatenate them.
// The animation scrolls leftward by exactly 50% of the total width,
// then instantly resets to 0 — because the second half is identical
// to the first, the reset is invisible. This creates a seamless loop
// without JavaScript timers or scroll position tracking.
//
// animation-play-state: paused on hover lets users read a result
// without it scrolling away.

import { useState, useEffect } from 'react'
import apiClient from '../api/client'

function TickerItem({ match }) {
  const home  = match.home_team?.replace(' FC', '').replace(' United', ' Utd') || ''
  const away  = match.away_team?.replace(' FC', '').replace(' United', ' Utd') || ''
  const score = `${match.home_score ?? '?'} – ${match.away_score ?? '?'}`

  return (
    <div className="inline-flex items-center gap-2.5 mr-14 shrink-0">
      <span className="font-condensed text-xs text-textmuted tracking-wider uppercase">
        MD{match.matchday}
      </span>
      <div className="w-1 h-1 rounded-full bg-bdr" />
      <span className="font-condensed text-sm font-semibold text-textsecondary">
        {home}
      </span>
      <span className="font-display text-base text-fkgreenbright tracking-wider">
        {score}
      </span>
      <span className="font-condensed text-sm font-semibold text-textsecondary">
        {away}
      </span>
    </div>
  )
}

function Ticker() {
  const [matches, setMatches] = useState([])

  useEffect(() => {
    apiClient.get('/api/matches?limit=20')
      .then(res => setMatches(res.data))
      .catch(() => {}) // fail silently — ticker is non-critical
  }, [])

  if (matches.length === 0) return null

  return (
    <div className="bg-surface border-b border-bdr h-9 flex items-center overflow-hidden relative">

      {/* LIVE label */}
      <div
        className="bg-fkgreen text-white font-condensed text-xs font-bold tracking-widest uppercase px-4 h-full flex items-center shrink-0 relative z-10"
        style={{
          clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)'
        }}
      >
        Results
      </div>

      {/* Scrolling track */}
      <div className="overflow-hidden flex-1 ml-4">
        <div
          className="flex whitespace-nowrap"
          style={{
            animation: 'ticker-scroll 40s linear infinite',
          }}
          onMouseEnter={e => e.currentTarget.style.animationPlayState = 'paused'}
          onMouseLeave={e => e.currentTarget.style.animationPlayState = 'running'}
        >
          {/* Render twice for seamless loop */}
          {matches.map(m => <TickerItem key={`a-${m.id}`} match={m} />)}
          {matches.map(m => <TickerItem key={`b-${m.id}`} match={m} />)}
        </div>
      </div>

    </div>
  )
}

export default Ticker