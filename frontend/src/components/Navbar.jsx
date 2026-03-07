// src/components/Navbar.jsx
//
// Fixed top navigation bar.
//
// SOLID BACKGROUND:
//   Inline style backgroundColor instead of Tailwind bg-fk-surface.
//   Inline styles always win specificity — guaranteed solid coverage
//   when content scrolls behind a fixed element.
//
// NAVIGATE TO / WITH STATE:
//   When a competition button is clicked, we call navigate('/', { state: { fromNav: true } })
//   The `fromNav: true` state flag tells MatchesPage that this navigation
//   came from the navbar — meaning the user wants to see the match list,
//   not just the hero. MatchesPage reads this flag to decide whether to
//   auto-scroll to the match list after loading.
//
//   WHY PASS STATE THROUGH navigate():
//   React Router's navigate() accepts a second argument { state: {} }.
//   This state is attached to the history entry — it travels with the
//   navigation and is readable in the destination component via useLocation().
//   It is NOT stored in localStorage or sessionStorage — it only lives
//   for that single navigation. This is the correct pattern for passing
//   "why did we navigate here" context between pages.
//
//   Two cases this handles:
//   1. User on / switching competition → MatchesPage stays mounted,
//      competition prop changes, scroll happens via the loading effect
//   2. User on /matches/:id clicking navbar → MatchesPage remounts,
//      location.state.fromNav is true, scroll happens after load

import { Link, useNavigate } from 'react-router-dom'
import PipelineButton from './PipelineButton'

// ── Competition badge SVGs ─────────────────────────────────────────────────

function PLBadge() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" fill="#3d195b" stroke="#7b2d8b" strokeWidth="1.5"/>
      <polygon points="10,4 15.5,7 15.5,13 10,16 4.5,13 4.5,7" fill="none" stroke="#00ff85" strokeWidth="0.8" opacity="0.6"/>
    </svg>
  )
}

function CLBadge() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" fill="#001a4e" stroke="#c9a84c" strokeWidth="1.2"/>
      <polygon points="10,3 11.2,8 16,7 12.5,10.5 16,14 11.2,12 10,17 8.8,12 4,14 7.5,10.5 4,7 8.8,8" fill="#c9a84c" opacity="0.9"/>
    </svg>
  )
}

function LaLigaBadge() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="1" y="1" width="18" height="18" rx="3" fill="#ee8000"/>
      <rect x="4" y="4" width="12" height="12" rx="1.5" fill="none" stroke="#ffffff" strokeWidth="1.2"/>
      <line x1="10" y1="4" x2="10" y2="16" stroke="#ffffff" strokeWidth="1.2" opacity="0.6"/>
    </svg>
  )
}

function BundesligaBadge() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" fill="#d20515" stroke="#ffffff" strokeWidth="1.2"/>
      <circle cx="10" cy="10" r="5" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.7"/>
      <circle cx="10" cy="10" r="2" fill="#ffffff" opacity="0.9"/>
    </svg>
  )
}

function SerieABadge() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 1 L18 4 L18 12 Q18 17 10 19 Q2 17 2 12 L2 4 Z" fill="#1a1a2e" stroke="#003399" strokeWidth="1.2"/>
      <path d="M10 4 L15 6.5 L15 12 Q15 15.5 10 17 Q5 15.5 5 12 L5 6.5 Z" fill="none" stroke="#0066cc" strokeWidth="0.8" opacity="0.7"/>
    </svg>
  )
}

const BADGE_MAP = {
  PL:  PLBadge,
  CL:  CLBadge,
  PD:  LaLigaBadge,
  BL1: BundesligaBadge,
  SA:  SerieABadge,
}

// ── Navbar component ───────────────────────────────────────────────────────

function Navbar({ competitions, activeCompetition, onCompetitionChange }) {
  const navigate = useNavigate()

  function handleCompetitionClick(comp) {
    onCompetitionChange(comp)
    // Pass fromNav: true so MatchesPage knows to scroll to match list
    // after it finishes loading — even on a fresh remount from detail page
    navigate('/', { state: { fromNav: true } })
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-fk-bdr"
      style={{ backgroundColor: '#181410' }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

        {/* Wordmark — resets to Premier League */}
        <Link
          to="/"
          onClick={() => onCompetitionChange(competitions[0])}
          className="flex items-center gap-3 shrink-0"
        >
          <div>
            <span className="font-display text-2xl text-fk-textprimary tracking-wider">
              FREEKICK
            </span>
            <span className="block text-xs text-fk-greenbright -mt-1 tracking-widest uppercase font-condensed">
              Match Intelligence
            </span>
          </div>
        </Link>

        {/* Competition buttons */}
        <div className="hidden md:flex items-center gap-1">
          {competitions.map(comp => {
            const isActive = comp.code === activeCompetition.code
            const Badge = BADGE_MAP[comp.code]

            return (
              <button
                key={comp.code}
                onClick={() => handleCompetitionClick(comp)}
                title={comp.label}
                className={[
                  'flex items-center gap-2 px-3 py-1.5 rounded',
                  'font-condensed text-xs font-bold tracking-widest uppercase',
                  'transition-colors duration-150',
                  isActive
                    ? 'bg-fk-surface3 text-fk-textprimary border border-fk-bdr'
                    : 'text-fk-textsecondary hover:text-fk-textprimary hover:bg-fk-surface2',
                ].join(' ')}
              >
                {Badge && <Badge />}
                <span>{comp.label}</span>
              </button>
            )
          })}
        </div>

        {/* Pipeline button */}
        <div className="shrink-0">
          <PipelineButton
            competition={activeCompetition.code}
            label={activeCompetition.label}
          />
        </div>

      </div>
    </nav>
  )
}

export default Navbar
