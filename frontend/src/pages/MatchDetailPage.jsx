/**
 * MatchDetailPage.jsx
 *
 * Full match detail view.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BACK NAVIGATION FIX
 * ─────────────────────────────────────────────────────────────────────────────
 * React Router's navigate() accepts a second argument: { state: {...} }.
 * This state is attached to the history entry — it travels with the URL
 * but is NOT visible in the URL bar. It's read via useLocation().state.
 *
 * MatchesPage passes: navigate(`/matches/${id}`, { state: { from: '/la-liga' } })
 * Here we read: const backPath = location.state?.from || '/'
 * If state is missing (direct URL access, bookmark), we fall back to '/'.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CARD DRAWER
 * ─────────────────────────────────────────────────────────────────────────────
 * Three tab-cards below the hero: Analysis, Events, Stats.
 * One is always active. Clicking a tab switches the content area below it.
 *
 * WHY key={activeCard} ON THE CONTENT DIV:
 *   key forces React to fully unmount and remount the child component when
 *   it changes. Without it, React reuses the existing DOM node — meaning
 *   StatBar's useEffect wouldn't re-fire when you switch back to Stats,
 *   and EventsTimeline's scroll position would be preserved incorrectly.
 *   key is the idiomatic React way to say "treat this as a fresh component".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HERO BANNER — TWO-DIV SPLIT (Session 15)
 * ─────────────────────────────────────────────────────────────────────────────
 * See previous session notes. Each team gets an independent absolutely-
 * positioned half-div with their own color/stripe background.
 */

import { useState, useEffect } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import apiClient from '../api/client'
import SummaryPanel from '../components/SummaryPanel'
import EventsTimeline from '../components/EventsTimeline'
import StatBar from '../components/StatBar'
import TEAM_COLORS from '../data/teamColors'

const STRIPE_SOLID = 18
const STRIPE_BLUR  = 10

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '')
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean
  const r = parseInt(full.substring(0, 2), 16)
  const g = parseInt(full.substring(2, 4), 16)
  const b = parseInt(full.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function buildHalfBackground(teamData, fallback, side) {
  const ALPHA = 0.65
  const fadeOverlay = side === 'left'
    ? `linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,1) 100%)`
    : `linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0) 70%, rgba(0,0,0,0) 100%)`

  let colorLayer
  if (teamData?.stripe) {
    const { type, colors } = teamData.stripe
    const angle = type === 'horizontal' ? '0deg' : '90deg'
    const a = hexToRgba(colors[0], ALPHA)
    const b = hexToRgba(colors[1], ALPHA)
    const s = STRIPE_SOLID
    const bl = STRIPE_BLUR
    const cycle = (s + bl) * 2
    colorLayer = (
      `repeating-linear-gradient(${angle}, ` +
      `${a} 0px, ${a} ${s}px, ` +
      `${b} ${s + bl}px, ${b} ${s + bl + s}px, ` +
      `${a} ${cycle}px)`
    )
  } else {
    const primary = teamData?.primary || fallback
    colorLayer = hexToRgba(primary, ALPHA)
  }
  return `${fadeOverlay}, ${colorLayer}`
}

// ─── Card drawer config ───────────────────────────────────────────────────────
// Adding a new tab = one object here + one case in renderCardContent(). Nothing else.
const CARDS = [
  { id: 'analysis', label: 'Analysis', icon: '📝' },
  { id: 'events',   label: 'Events',   icon: '⚡' },
  { id: 'stats',    label: 'Stats',    icon: '📊' },
]

function MatchDetailPage() {
  const { id }   = useParams()
  const location = useLocation()

  // Read the competition path stored by MatchesPage in router navigate() state.
  // Optional chaining (?.) handles the case where state is null (direct URL visit).
  const backPath = location.state?.from || '/'

  const [match,      setMatch]      = useState(null)
  const [summary,    setSummary]    = useState(null)
  const [events,     setEvents]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [activeCard, setActiveCard] = useState('analysis')

  useEffect(() => {
    const fetchMatchData = async () => {
      try {
        const [matchRes, summaryRes, eventsRes] = await Promise.all([
          apiClient.get(`/api/matches/${id}`),
          apiClient.get(`/api/matches/${id}/summary`).catch(() => ({ data: {} })),
          apiClient.get(`/api/matches/${id}/events`).catch(() => ({ data: { events: [] } })),
        ])
        setMatch(matchRes.data)
        setSummary(summaryRes.data.content || null)
        setEvents(eventsRes.data.events || [])
      } catch (err) {
        console.error('Failed to load match:', err)
        setError('Could not load match data.')
      } finally {
        setLoading(false)
      }
    }
    fetchMatchData()
  }, [id])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12 flex items-center gap-3 text-fk-textmuted">
        <span className="w-4 h-4 border-2 border-fk-textmuted border-t-transparent rounded-full animate-spin inline-block" />
        <span className="font-condensed tracking-widest uppercase text-xs">Loading match...</span>
      </div>
    )
  }

  if (error || !match) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="border border-fk-red/30 bg-fk-red/5 p-6 rounded-sm">
          <p className="text-fk-red font-condensed">{error || 'Match not found.'}</p>
          <Link to={backPath} className="text-fk-greenbright text-sm mt-2 block font-condensed hover:underline">
            ← Back to matches
          </Link>
        </div>
      </div>
    )
  }

  const homeBackground = buildHalfBackground(TEAM_COLORS[match.home_team], '#1a5c35', 'left')
  const awayBackground = buildHalfBackground(TEAM_COLORS[match.away_team], '#c8780a', 'right')

  function renderCardContent() {
    if (activeCard === 'analysis') return <SummaryPanel summary={summary} showHeadline={true} />
    if (activeCard === 'events')   return <EventsTimeline events={events} />
    if (activeCard === 'stats')    return <StatBar matchId={parseInt(id, 10)} />
    return null
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      {/* Back link — dynamically points to whichever competition the user came from */}
      <Link
        to={backPath}
        className="font-condensed text-xs text-fk-textmuted hover:text-fk-greenbright transition-colors tracking-widest uppercase mb-6 block"
      >
        ← All Matches
      </Link>

      {/* ── Hero scoreboard ───────────────────────────────────────────────── */}
      <div className="border border-fk-bdr relative overflow-hidden mb-8 rounded-sm">

        <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '50%', background: homeBackground }} />
        <div aria-hidden="true" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '50%', background: awayBackground }} />

        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: 'linear-gradient(90deg, #1a5c35 0%, #2da050 40%, #e8960e 70%, #c8102e 100%)', zIndex: 11 }}
        />

        <div className="p-8 pt-9" style={{ position: 'relative', zIndex: 10 }}>

          <div className="flex items-center justify-between mb-8">
            <span className="font-condensed text-xs font-bold tracking-widest uppercase text-fk-greenbright">
              {match.competition}
              {match.matchday && <span className="text-fk-textmuted"> · MD {match.matchday}</span>}
            </span>
            <span className="font-condensed text-xs text-fk-textmuted">{formatDate(match.date)}</span>
          </div>

          {/*
            SCORELINE REDESIGN:
            grid: 1fr auto 1fr — score column takes only what it needs,
            team name columns split the rest equally.

            Team names: font-display (Bebas Neue) at clamp(24px → 42px).
            clamp(min, preferred, max) picks the middle value if it fits,
            otherwise clamps to min or max. This gives responsive sizing
            without media queries.

            Score numbers: clamp(80px → 120px) — the dominant visual element.
            "Home" / "Away" labels moved above the team name for hierarchy.
          */}
          <div className="grid items-center" style={{ gridTemplateColumns: '1fr auto 1fr', gap: '2rem' }}>

            <div className="text-right">
              <p className="font-condensed text-xs font-bold tracking-widest uppercase text-fk-textmuted mb-1">
                Home
              </p>
              <p
                className="font-display text-fk-textprimary leading-none"
                style={{ fontSize: 'clamp(22px, 3vw, 40px)', letterSpacing: 1 }}
              >
                {match.home_team}
              </p>
            </div>

            <div className="text-center" style={{ minWidth: 220 }}>
              <div className="flex items-center justify-center gap-3">
                <span className="font-display text-fk-textprimary leading-none" style={{ fontSize: 'clamp(80px, 10vw, 120px)' }}>
                  {match.home_score ?? '-'}
                </span>
                <span className="font-display text-fk-bdrlt leading-none" style={{ fontSize: 'clamp(40px, 5vw, 64px)' }}>
                  –
                </span>
                <span className="font-display text-fk-textprimary leading-none" style={{ fontSize: 'clamp(80px, 10vw, 120px)' }}>
                  {match.away_score ?? '-'}
                </span>
              </div>
              <p className="font-condensed text-xs text-fk-textmuted tracking-widest uppercase mt-1">
                Full Time
              </p>
            </div>

            <div className="text-left">
              <p className="font-condensed text-xs font-bold tracking-widest uppercase text-fk-textmuted mb-1">
                Away
              </p>
              <p
                className="font-display text-fk-textprimary leading-none"
                style={{ fontSize: 'clamp(22px, 3vw, 40px)', letterSpacing: 1 }}
              >
                {match.away_team}
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* ── CARD DRAWER ───────────────────────────────────────────────────── */}
      <div>

        {/* Tab row — three tabs, one per content section */}
        <div className="flex border-b border-fk-bdr">
          {CARDS.map(card => {
            const isActive = activeCard === card.id
            return (
              <button
                key={card.id}
                onClick={() => setActiveCard(card.id)}
                className={[
                  'flex items-center gap-2 px-6 py-3 font-condensed text-xs font-bold',
                  'tracking-widest uppercase transition-colors duration-150',
                  'border-b-2 -mb-px',
                  isActive
                    ? 'text-fk-greenbright border-fk-greenbright bg-fk-surface'
                    : 'text-fk-textmuted border-transparent hover:text-fk-textsecondary hover:border-fk-bdrlt',
                ].join(' ')}
              >
                <span>{card.icon}</span>
                <span>{card.label}</span>
              </button>
            )
          })}
        </div>

        {/* Content area — key forces full remount on card switch */}
        <div key={activeCard} className="pt-4">
          {renderCardContent()}
        </div>

      </div>

    </div>
  )
}

export default MatchDetailPage
