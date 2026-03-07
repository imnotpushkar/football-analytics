// src/pages/MatchesPage.jsx
//
// Single match list page — handles ALL competitions via props.
//
// SCROLL BEHAVIOUR — THREE CASES:
//
//   Case 1: First ever page load
//     hasLoadedOnce.current = false, location.state = null
//     → fetch runs, loading completes, NO scroll. User sees hero.
//
//   Case 2: Competition switch while staying on /
//     MatchesPage never unmounts. competition.code prop changes.
//     → window.scrollTo(0,0) immediately (snap to top, hero visible)
//     → fetch runs, loading completes, scroll to match list
//     hasLoadedOnce.current is already true from Case 1.
//
//   Case 3: Navigate back from /matches/:id via navbar click
//     MatchesPage remounts fresh. hasLoadedOnce.current = false.
//     BUT location.state.fromNav = true (set by Navbar's navigate call).
//     → fetch runs, loading completes, scroll to match list
//     The fromNav flag tells us "user wants to see matches, not hero."
//
// WHY useLocation() FOR THIS:
//   React Router's useLocation() hook returns the current location object,
//   which includes the `state` passed to navigate(). This state is purely
//   in-memory for the duration of that history entry — it's not a URL param,
//   not localStorage, not a prop. It's the correct tool for passing
//   "intent" or "context" from one page navigation to another without
//   polluting the URL or component props.
//
// TWO useEffect SPLIT:
//   Effect 1 watches competition.code — owns "start fetch + snap to top"
//   Effect 2 watches loading — owns "scroll to matches when data arrives"
//   Each effect has one job. This avoids timing complexity from mixing them.

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation }     from 'react-router-dom'
import MatchCard                        from '../components/MatchCard'
import MatchTransition                  from '../components/MatchTransition'
import GiveAndGo                        from '../components/animations/GiveAndGo'
import apiClient                        from '../api/client'

const DEFAULT_COMPETITION = { code: 'PL', label: 'Premier League' }

export default function MatchesPage({ competition = DEFAULT_COMPETITION }) {
  const [matches, setMatches]                 = useState([])
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState(null)
  const [transitionState, setTransitionState] = useState(null)

  const navigate     = useNavigate()
  const location     = useLocation()
  // location.state is set by whoever navigated to this page.
  // Navbar sets { fromNav: true } so we know to scroll after load.
  const fromNav      = location.state?.fromNav === true

  const matchListRef  = useRef(null)
  // hasLoadedOnce: false on mount, true after first fetch completes.
  // Used to distinguish Case 1 (first load) from Case 2 (competition switch).
  const hasLoadedOnce = useRef(false)
  // isFirstMount: true only on the very first render cycle.
  // Used to skip the snap-to-top in Case 1 and Case 3.
  const isFirstMount  = useRef(true)

  // EFFECT 1: Fetch on competition change + snap to top for Case 2
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      // Case 1 or Case 3 — first mount, don't snap to top.
      // Case 3 already snapped to top via window.scrollTo in Navbar's
      // navigate call context. Actually Navbar doesn't do that — but
      // the page mounts at top naturally on navigation anyway.
    } else {
      // Case 2 — competition prop changed while staying on /
      // Snap to top so user sees hero before match list loads
      window.scrollTo({ top: 0, behavior: 'instant' })
    }

    setLoading(true)
    setError(null)
    setMatches([])

    apiClient.get('/api/matches', {
      params: { competition: competition.code, limit: 20 },
    })
      .then(res => setMatches(res.data))
      .catch(() => setError('Could not load matches. Is the Flask API running?'))
      .finally(() => setLoading(false))
  }, [competition.code])

  // EFFECT 2: Scroll to match list when loading finishes
  // Fires on Case 2 (hasLoadedOnce already true) and Case 3 (fromNav true)
  // Skips on Case 1 (first ever load — user should see hero)
  useEffect(() => {
    if (loading) return // still fetching, wait

    const shouldScroll = hasLoadedOnce.current || fromNav
    // hasLoadedOnce.current = true means this is a competition switch (Case 2)
    // fromNav = true means we came back from a detail page (Case 3)

    if (shouldScroll) {
      const timer = setTimeout(() => {
        matchListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
      return () => clearTimeout(timer)
    }

    // Mark first load complete so subsequent competition switches scroll
    hasLoadedOnce.current = true
  }, [loading])
  // Note: fromNav is NOT in the dependency array intentionally.
  // It's read once when the effect fires after the fetch completes.
  // Adding it would cause extra runs. It's stable for the lifetime of
  // this mount since location.state doesn't change after mount.

  const handleMatchClick = (match, animationType) => {
    setTransitionState({ match, animationType })
  }

  const handleTransitionDone = () => {
    const id = transitionState?.match?.id
    setTransitionState(null)
    if (id) {
      navigate(`/matches/${id}`, {
        state: { from: '/', competitionCode: competition.code },
      })
    }
  }

  const byMatchday = matches.reduce((acc, match) => {
    const md = match.matchday || 'Unknown'
    if (!acc[md]) acc[md] = []
    acc[md].push(match)
    return acc
  }, {})

  const sortedMatchdays = Object.keys(byMatchday)
    .map(Number)
    .sort((a, b) => b - a)

  return (
    <>
      {transitionState && (
        <MatchTransition
          animationType={transitionState.animationType}
          matchData={transitionState.match}
          onDone={handleTransitionDone}
        />
      )}

      {/* ── HERO — always rendered, never unmounts ──────────────────────── */}
      <div
        style={{ height: 'calc(100dvh - 88px)', minHeight: 480 }}
        className="relative flex flex-col items-center justify-center overflow-hidden bg-fk-bg"
      >
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, rgba(69,196,102,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}/>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, #100e0b 80%)',
        }}/>
        <div className="absolute pointer-events-none" style={{
          bottom: 88, left: '15%', right: '15%', height: 1,
          background: 'linear-gradient(90deg, transparent 0%, rgba(69,196,102,0.25) 30%, rgba(69,196,102,0.5) 50%, rgba(69,196,102,0.25) 70%, transparent 100%)',
        }}/>
        <div className="absolute pointer-events-none" style={{
          bottom: 80, left: '50%', transform: 'translateX(-50%)',
          width: 200, height: 18,
          background: 'radial-gradient(ellipse, rgba(69,196,102,0.12), transparent)',
        }}/>

        <div className="relative z-10 flex flex-col items-center text-center">
          <p className="font-condensed text-xs font-bold tracking-widest uppercase text-fk-greenbright mb-3">
            {competition.label} · Match Intelligence
          </p>
          <h1
            className="font-display text-fk-textprimary leading-none mb-3"
            style={{ fontSize: 'clamp(72px, 12vw, 120px)', letterSpacing: 6 }}
          >
            FREE<span className="text-fk-greenbright" style={{ textShadow: '0 0 60px rgba(69,196,102,0.35)' }}>KICK</span>
          </h1>
          <p className="font-condensed text-xs tracking-widest uppercase text-fk-textsecondary mb-10">
            Creator-quality tactical analysis
          </p>
          <GiveAndGo />
        </div>

        <p
          className="absolute bottom-6 font-condensed text-xs tracking-widest uppercase text-fk-textmuted"
          style={{ animation: 'fk-blink 2.2s ease-in-out infinite' }}
        >
          ↓ Scroll to view matches
        </p>
      </div>

      {/* ── MATCH LIST ─────────────────────────────────────────────────── */}
      <div ref={matchListRef} className="max-w-6xl mx-auto px-6 py-8">

        <div className="mb-8">
          <h2 className="font-display text-4xl text-fk-textprimary tracking-wider">
            MATCH ANALYSIS
          </h2>
          <p className="font-condensed text-xs text-fk-textmuted tracking-widest uppercase mt-1">
            {competition.label} · {matches.length} matches · click any match to read
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-3 text-fk-textmuted py-12">
            <span className="w-4 h-4 border-2 border-fk-textmuted border-t-transparent rounded-full animate-spin inline-block"/>
            <span className="font-condensed tracking-widest uppercase text-xs">
              Loading {competition.label} matches...
            </span>
          </div>
        )}

        {error && !loading && (
          <div className="border border-fk-red/30 bg-fk-red/5 p-6">
            <p className="text-fk-red font-condensed">{error}</p>
            <p className="text-fk-textmuted text-sm mt-2 font-condensed">
              Run: <code className="text-fk-greenbright">python -m backend.api.app</code>
            </p>
          </div>
        )}

        {!loading && !error && matches.length === 0 && (
          <div className="bg-fk-surface border border-fk-bdr p-8 text-center">
            <p className="text-fk-textmuted font-condensed">
              No {competition.label} matches found. Run the pipeline to fetch data.
            </p>
            <p className="text-fk-textmuted text-xs font-condensed mt-2 opacity-60">
              python -m backend.main --competition {competition.code}
            </p>
          </div>
        )}

        {!loading && !error && sortedMatchdays.map(md => (
          <div key={md} className="mb-10">
            <div className="bg-fk-surface3 border-l-4 border-fk-green border-b border-fk-bdr px-6 py-2.5 flex items-center gap-4">
              <span className="font-condensed text-xs font-bold tracking-widest uppercase text-fk-textprimary">
                Matchday {md}
              </span>
              <div className="flex-1 h-px bg-fk-bdr"/>
              <span className="font-condensed text-xs text-fk-greenbright tracking-wider">
                {byMatchday[md].length} matches
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-l border-t border-fk-bdr">
              {byMatchday[md].map(match => (
                <div key={match.id} className="border-r border-b border-fk-bdr">
                  <MatchCard match={match} onMatchClick={handleMatchClick}/>
                </div>
              ))}
            </div>
          </div>
        ))}

      </div>
    </>
  )
}
