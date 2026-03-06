// src/pages/MatchesPage.jsx
//
// Home page — hero section with GiveAndGo animation above match list.
//
// Layout:
//   [Navbar + Ticker — fixed, handled by App.jsx]
//   [Hero section — full viewport height, GiveAndGo animation centred]
//   [Match list — scrollable below]
//
// The hero section uses 100dvh (dynamic viewport height) minus the
// navbar (56px) and ticker (32px) = 88px total offset. This means
// the hero fills exactly the visible screen on first load, with the
// match list starting just below the fold — user scrolls to see it.
//
// The dot grid + vignette are pure CSS — no JS, no extra components.
// They're layered via ::before and ::after equivalents using divs.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MatchCard from '../components/MatchCard'
import MatchTransition from '../components/MatchTransition'
import GiveAndGo from '../components/animations/GiveAndGo'
import apiClient from '../api/client'

export default function MatchesPage() {
  const [matches, setMatches]                   = useState([])
  const [loading, setLoading]                   = useState(true)
  const [error, setError]                       = useState(null)
  const [transitionState, setTransitionState]   = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    apiClient.get('/api/matches')
      .then(res => setMatches(res.data))
      .catch(() => setError('Could not load matches. Is the Flask API running?'))
      .finally(() => setLoading(false))
  }, [])

  const handleMatchClick = (match, animationType) => {
    setTransitionState({ match, animationType })
  }

  const handleTransitionDone = () => {
    const id = transitionState?.match?.id
    setTransitionState(null)
    if (id) navigate(`/matches/${id}`)
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12 flex items-center gap-3 text-textmuted">
        <span className="w-4 h-4 border-2 border-textmuted border-t-transparent rounded-full animate-spin inline-block"/>
        <span className="font-condensed tracking-widest uppercase text-xs">Loading matches...</span>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="border border-fkred/30 bg-fkred/5 p-6">
          <p className="text-fkred font-condensed">{error}</p>
          <p className="text-textmuted text-sm mt-2 font-condensed">
            Run: <code className="text-fkgreenbright">python -m backend.api.app</code>
          </p>
        </div>
      </div>
    )
  }

  const byCompetition = matches.reduce((acc, match) => {
    const comp = match.competition || 'Other'
    if (!acc[comp]) acc[comp] = []
    acc[comp].push(match)
    return acc
  }, {})

  return (
    <>
      {/* ── Transition overlay — mounts on card click ───────────────────── */}
      {transitionState && (
        <MatchTransition
          animationType={transitionState.animationType}
          matchData={transitionState.match}
          onDone={handleTransitionDone}
        />
      )}

      {/* ── HERO SECTION ────────────────────────────────────────────────── */}
      {/* 
        Height: calc(100dvh - 88px) accounts for navbar (56px) + ticker (32px).
        dvh = dynamic viewport height — handles mobile browser chrome correctly.
        Falls back to 100vh on browsers that don't support dvh.
      */}
      <div
        style={{ height: 'calc(100dvh - 88px)', minHeight: 480 }}
        className="relative flex flex-col items-center justify-center overflow-hidden bg-bg"
      >
        {/* Dot grid background — radial gradient dots */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(69,196,102,0.07) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Vignette — fades dot grid toward edges */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 30%, #100e0b 80%)',
          }}
        />

        {/* Ground line — sits below the animation */}
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: 88,
            left: '15%',
            right: '15%',
            height: 1,
            background: 'linear-gradient(90deg, transparent 0%, rgba(69,196,102,0.25) 30%, rgba(69,196,102,0.5) 50%, rgba(69,196,102,0.25) 70%, transparent 100%)',
          }}
        />
        {/* Ground glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 200,
            height: 18,
            background: 'radial-gradient(ellipse, rgba(69,196,102,0.12), transparent)',
          }}
        />

        {/* Hero content — centred */}
        <div className="relative z-10 flex flex-col items-center text-center">

          {/* Eyebrow */}
          <p className="font-condensed text-xs font-bold tracking-widest uppercase text-fkgreenbright mb-3">
            Premier League · Match Intelligence
          </p>

          {/* Logo wordmark */}
          <h1
            className="font-display text-textprimary leading-none mb-3"
            style={{ fontSize: 'clamp(72px, 12vw, 120px)', letterSpacing: 6 }}
          >
            FREE<span className="text-fkgreenbright" style={{ textShadow: '0 0 60px rgba(69,196,102,0.35)' }}>KICK</span>
          </h1>

          {/* Subtitle */}
          <p className="font-condensed text-xs tracking-widest uppercase text-textsecondary mb-10">
            Creator-quality tactical analysis
          </p>

          {/* GiveAndGo animation — trademark home page loop */}
          <GiveAndGo />

        </div>

        {/* Scroll hint — blinks at bottom */}
        <p
          className="absolute bottom-6 font-condensed text-xs tracking-widest uppercase text-textmuted"
          style={{ animation: 'fk-blink 2.2s ease-in-out infinite' }}
        >
          ↓ Scroll to view matches
        </p>
      </div>

      {/* ── MATCH LIST ──────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Section header */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-4xl text-textprimary tracking-wider">
              MATCH ANALYSIS
            </h2>
            <p className="font-condensed text-xs text-textmuted tracking-widest uppercase mt-1">
              {matches.length} matches · click any match to read
            </p>
          </div>
        </div>

        {matches.length === 0 ? (
          <div className="bg-surface border border-bdr p-8 text-center">
            <p className="text-textmuted font-condensed">
              No matches found. Run the pipeline to fetch data.
            </p>
          </div>
        ) : (
          Object.entries(byCompetition).map(([competition, compMatches]) => (
            <div key={competition} className="mb-10">
              {/* Competition header */}
              <div className="bg-surface3 border-l-4 border-fkgreen border-b border-bdr px-6 py-2.5 flex items-center gap-4">
                <span className="font-condensed text-xs font-bold tracking-widest uppercase text-textprimary">
                  {competition}
                </span>
                <div className="flex-1 h-px bg-bdr"/>
                <span className="font-condensed text-xs text-fkgreenbright tracking-wider">
                  {compMatches.length} matches
                </span>
              </div>
              {/* Flush newspaper card grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-l border-t border-bdr">
                {compMatches.map(match => (
                  <div key={match.id} className="border-r border-b border-bdr">
                    <MatchCard match={match} onMatchClick={handleMatchClick}/>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
