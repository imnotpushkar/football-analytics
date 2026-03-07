/**
 * MatchDetailPage.jsx
 *
 * Full match detail view. Fetches three endpoints in parallel:
 *   GET /api/matches/<id>          → scoreboard data
 *   GET /api/matches/<id>/summary  → AI analysis text
 *   GET /api/matches/<id>/events   → goals, cards, substitutions
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HERO BANNER ARCHITECTURE — TWO-DIV SPLIT (Session 15)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The previous approach used a single CSS background gradient across the full
 * banner width. This made it impossible to give each team an independent
 * background — stripe patterns would bleed across both sides.
 *
 * The fix uses two absolutely-positioned child divs inside a position:relative
 * container:
 *
 *   [banner — position: relative, overflow: hidden]
 *     ├── [left half  — position: absolute, left:0,  width:50%]  ← home
 *     ├── [right half — position: absolute, right:0, width:50%]  ← away
 *     └── [score content — position: relative, z-index: 10]      ← above both
 *
 * position: absolute means the div is removed from normal document flow and
 * positioned relative to the nearest ancestor with position: relative.
 * The score content uses position: relative + z-index: 10 so it renders
 * on top of the two background divs, not behind them.
 *
 * Each half has its own background (solid color or stripe gradient) plus an
 * inner-edge fade to black, applied as a second CSS background layer:
 *
 *   LEFT HALF:  stripe/solid layer + fade  transparent→black  (left→right)
 *   RIGHT HALF: stripe/solid layer + fade  black→transparent  (left→right)
 *
 * This means each team's identity is fully independent. Barcelona on the left
 * shows blue/red stripes fading to black at center. Any team on the right
 * shows their own colors fading from black at center outward.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STRIPE RENDERING
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Blurred vs hard stripes:
 *   Hard stripes use matching stop positions — the color jumps instantly:
 *     repeating-linear-gradient(90deg, black 0px, black 20px, white 20px, white 40px)
 *
 *   Blurred stripes overlap the stops — each color transitions gradually:
 *     repeating-linear-gradient(90deg, black 0px, white 30px, black 60px)
 *   At 30px, black has fully become white. The 30px ramp is the blur zone.
 *
 *   We use a MIXED approach for recognizability:
 *     Each color holds for a SOLID portion, then transitions over a BLUR portion.
 *     repeating-linear-gradient(90deg,
 *       colorA 0px,
 *       colorA {solid}px,        ← hold solid for this many px
 *       colorB {solid+blur}px,   ← then blend over blur px
 *       colorB {solid+blur+solid}px,
 *       colorA {cycle}px
 *     )
 *   This gives you a readable stripe with soft edges — not a hard cut,
 *   not a complete blur. STRIPE_SOLID and STRIPE_BLUR control the balance.
 */

import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import apiClient from '../api/client'
import SummaryPanel from '../components/SummaryPanel'
import EventsTimeline from '../components/EventsTimeline'
import StatBar from '../components/StatBar'
import TEAM_COLORS from '../data/teamColors'

// ─── Stripe geometry constants ────────────────────────────────────────────────
// STRIPE_SOLID: px each color holds before transitioning. Higher = blockier stripes.
// STRIPE_BLUR:  px of transition zone between colors. Higher = softer edges.
// Total cycle = (STRIPE_SOLID + STRIPE_BLUR) * 2
const STRIPE_SOLID = 18   // px of flat color per stripe
const STRIPE_BLUR  = 10   // px of blend zone at each edge

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

/**
 * hexToRgba
 * Converts a hex color string to a CSS rgba() value.
 * Handles both shorthand (#RGB) and full (#RRGGBB) hex formats.
 *
 * Why we need this: CSS gradients need rgba() to control per-stop opacity.
 * You can't do linear-gradient(90deg, #EF0107 at 0.55 opacity) — you need
 * rgba(239, 1, 7, 0.55) instead.
 *
 * parseInt(str, 16) parses a string as a base-16 (hex) number.
 * substring(0,2) extracts the red channel, (2,4) green, (4,6) blue.
 */
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

/**
 * buildHalfBackground
 *
 * Returns the CSS `background` value for one half of the banner (home or away).
 * Two CSS background layers are comma-separated — first listed = top layer.
 *
 * Layer 1 (top):    an edge-fade overlay
 *   - For the LEFT (home) half:  transparent at left edge → black at right edge
 *   - For the RIGHT (away) half: black at left edge → transparent at right edge
 *   This creates the dark center separation and keeps score text readable.
 *
 * Layer 2 (bottom): the team's color or stripe pattern
 *   - Solid clubs: flat color using rgba at ALPHA opacity
 *   - Stripe clubs: repeating-linear-gradient with solid+blur stripe geometry
 *
 * @param {object} teamData  - entry from TEAM_COLORS (may be undefined for unknown teams)
 * @param {string} fallback  - hex fallback color if team not in TEAM_COLORS
 * @param {"left"|"right"} side - which half of the banner this is
 */
function buildHalfBackground(teamData, fallback, side) {
  const ALPHA = 0.65

  // ── Edge fade overlay ──────────────────────────────────────────────────────
  // Left half: color is most visible at the far left, fades to black toward center.
  // Right half: color is most visible at the far right, fades to black toward center.
  // The fade starts at 30% and reaches full black at 100% (the inner edge).
  // 30% of 50% banner width = color visible for the outer ~15% of total banner width.
  const fadeOverlay = side === 'left'
    ? `linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,1) 100%)`
    : `linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0) 70%, rgba(0,0,0,0) 100%)`

  // ── Team color/stripe layer ────────────────────────────────────────────────
  let colorLayer

  if (teamData?.stripe) {
    const { type, colors } = teamData.stripe
    // Vertical stripes on a half-banner still use 90deg (left→right tiling).
    // Horizontal stripes use 0deg (top→bottom tiling).
    // The angle describes the direction of the gradient axis, which is
    // perpendicular to the direction the stripes visually run.
    // 90deg axis → stripes run vertically. 0deg axis → stripes run horizontally.
    const angle = type === 'horizontal' ? '0deg' : '90deg'

    const a = hexToRgba(colors[0], ALPHA)
    const b = hexToRgba(colors[1], ALPHA)

    // Mixed solid+blur stripe:
    // Each color holds for STRIPE_SOLID px, then blends over STRIPE_BLUR px.
    const s = STRIPE_SOLID
    const bl = STRIPE_BLUR
    const cycle = (s + bl) * 2  // total px for one full A→B→A cycle

    colorLayer = (
      `repeating-linear-gradient(${angle}, ` +
      `${a} 0px, ` +
      `${a} ${s}px, ` +
      `${b} ${s + bl}px, ` +
      `${b} ${s + bl + s}px, ` +
      `${a} ${cycle}px)`
    )
  } else {
    // Solid club — flat rgba color fills the entire half
    const primary = teamData?.primary || fallback
    colorLayer = hexToRgba(primary, ALPHA)
  }

  // CSS background: first value = top layer, second = bottom layer
  return `${fadeOverlay}, ${colorLayer}`
}

function MatchDetailPage() {
  const { id } = useParams()
  const [match,   setMatch]   = useState(null)
  const [summary, setSummary] = useState(null)
  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

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
          <Link to="/" className="text-fk-greenbright text-sm mt-2 block font-condensed hover:underline">
            ← Back to all matches
          </Link>
        </div>
      </div>
    )
  }

  const homeData = TEAM_COLORS[match.home_team]
  const awayData = TEAM_COLORS[match.away_team]

  const homeBackground = buildHalfBackground(homeData, '#1a5c35', 'left')
  const awayBackground = buildHalfBackground(awayData, '#c8780a', 'right')

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      <Link
        to="/"
        className="font-condensed text-xs text-fk-textmuted hover:text-fk-greenbright transition-colors tracking-widest uppercase mb-6 block"
      >
        ← All Matches
      </Link>

      {/* ── Hero scoreboard ─────────────────────────────────────────────────── */}
      {/*
        position: relative on the container is required so that the absolutely-
        positioned left and right half divs are anchored to THIS element and not
        to the viewport or a higher ancestor.

        overflow: hidden clips the absolute children to the banner's bounds —
        without it the background divs would extend beyond the card edges.
      */}
      <div className="border border-fk-bdr relative overflow-hidden mb-4 rounded-sm">

        {/* Left half — home team background */}
        {/*
          position: absolute + top/left/bottom pins the div to the container edges.
          width: 50% gives it exactly the left half.
          No z-index needed here — it stays behind the score content naturally
          because the score content declares its own z-index: 10.
        */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0, left: 0, bottom: 0,
            width: '50%',
            background: homeBackground,
          }}
        />

        {/* Right half — away team background */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0, right: 0, bottom: 0,
            width: '50%',
            background: awayBackground,
          }}
        />

        {/* Thin palette accent stripe at very top — sits above both halves */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: 'linear-gradient(90deg, #1a5c35 0%, #2da050 40%, #e8960e 70%, #c8102e 100%)', zIndex: 11 }}
        />

        {/*
          Score content — position: relative + z-index: 10
          position: relative is required for z-index to take effect.
          Without it, z-index is ignored on elements in normal flow.
          z-index: 10 puts this above the background divs (which have no z-index,
          meaning they sit at z-index: auto, effectively 0).
        */}
        <div className="p-8 pt-9" style={{ position: 'relative', zIndex: 10 }}>
          <div className="flex items-center justify-between mb-6">
            <span className="font-condensed text-xs font-bold tracking-widest uppercase text-fk-greenbright">
              {match.competition}
              {match.matchday && (
                <span className="text-fk-textmuted"> · MD {match.matchday}</span>
              )}
            </span>
            <span className="font-condensed text-xs text-fk-textmuted">
              {formatDate(match.date)}
            </span>
          </div>

          <div className="grid items-center gap-8" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
            <div className="text-right">
              <p className="font-condensed text-2xl font-bold text-fk-textprimary leading-tight">
                {match.home_team}
              </p>
              <p className="font-condensed text-xs text-fk-textmuted tracking-widest uppercase mt-1">Home</p>
            </div>

            <div className="text-center">
              <div className="flex items-center gap-2">
                <span className="font-display text-8xl text-fk-textprimary leading-none">
                  {match.home_score ?? '-'}
                </span>
                <span className="font-display text-5xl text-fk-bdrlt">–</span>
                <span className="font-display text-8xl text-fk-textprimary leading-none">
                  {match.away_score ?? '-'}
                </span>
              </div>
              <p className="font-condensed text-xs text-fk-textmuted tracking-widest uppercase mt-1">
                Full Time
              </p>
            </div>

            <div className="text-left">
              <p className="font-condensed text-2xl font-bold text-fk-textprimary leading-tight">
                {match.away_team}
              </p>
              <p className="font-condensed text-xs text-fk-textmuted tracking-widest uppercase mt-1">Away</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stat bars */}
      <div className="mb-6">
        <StatBar matchId={parseInt(id, 10)} />
      </div>

      {/* Two-column: events | analysis */}
      <div className="grid gap-0" style={{ gridTemplateColumns: '300px 1fr' }}>
        <EventsTimeline events={events} />
        <div className="border-l border-fk-bdr">
          <SummaryPanel summary={summary} showHeadline={true} />
        </div>
      </div>

    </div>
  )
}

export default MatchDetailPage
