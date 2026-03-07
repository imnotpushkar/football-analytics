// src/components/Navbar.jsx
//
// Fixed top navigation bar.
//
// COMPETITION BADGES:
//   Each competition has a custom SVG badge — geometric shapes in
//   that competition's colours. These are NOT copied logos (trademark
//   risk). They are original SVG designs that evoke the competition
//   through colour and shape only.
//
// NAMING:
//   Nav links and the pipeline button show full competition names
//   ("Premier League", "La Liga") not internal API codes ("PL", "PD").
//   API codes are internal identifiers from Football-Data.org — users
//   have no reason to know them. Full names are shown everywhere in the UI.
//   The code field is kept in COMPETITION_LINKS for API calls only.
//
// ACTIVE STATE:
//   useLocation() from React Router returns the current URL path.
//   We compare path to each link's href to apply active styling.
//
// PIPELINE BUTTON + COMPETITION CONTEXT:
//   We derive activeCode and activeLabel from the current pathname
//   and pass both to PipelineButton:
//     competition = API code  → sent in POST body
//     label       = full name → shown on button and status message

import { Link, useLocation } from 'react-router-dom'
import PipelineButton from './PipelineButton'

// ── Competition badge SVGs ────────────────────────────────────────────────

function PLBadge() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <polygon
        points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5"
        fill="#3d195b"
        stroke="#7b2d8b"
        strokeWidth="1.5"
      />
      <polygon
        points="10,4 15.5,7 15.5,13 10,16 4.5,13 4.5,7"
        fill="none"
        stroke="#00ff85"
        strokeWidth="0.8"
        opacity="0.6"
      />
    </svg>
  )
}

function CLBadge() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" fill="#001a4e" stroke="#c9a84c" strokeWidth="1.2"/>
      <polygon
        points="10,3 11.2,8 16,7 12.5,10.5 16,14 11.2,12 10,17 8.8,12 4,14 7.5,10.5 4,7 8.8,8"
        fill="#c9a84c"
        opacity="0.9"
      />
    </svg>
  )
}

function LaLigaBadge() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="1" y="1" width="18" height="18" rx="3" fill="#ee8000" />
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
      <path
        d="M10 1 L18 4 L18 12 Q18 17 10 19 Q2 17 2 12 L2 4 Z"
        fill="#1a1a2e"
        stroke="#003399"
        strokeWidth="1.2"
      />
      <path
        d="M10 4 L15 6.5 L15 12 Q15 15.5 10 17 Q5 15.5 5 12 L5 6.5 Z"
        fill="none"
        stroke="#0066cc"
        strokeWidth="0.8"
        opacity="0.7"
      />
    </svg>
  )
}

// ── Competition nav links config ──────────────────────────────────────────
// code:  API identifier — sent to Football-Data.org and Flask backend.
//        Never shown in the UI. Must not change.
// label: Human-readable name — shown in nav links and pipeline button.
//        Safe to update without touching any backend code.

const COMPETITION_LINKS = [
  { href: '/',                 code: 'PL',  label: 'Premier League',   Badge: PLBadge         },
  { href: '/champions-league', code: 'CL',  label: 'Champions League', Badge: CLBadge         },
  { href: '/la-liga',          code: 'PD',  label: 'La Liga',          Badge: LaLigaBadge     },
  { href: '/bundesliga',       code: 'BL1', label: 'Bundesliga',       Badge: BundesligaBadge },
  { href: '/serie-a',          code: 'SA',  label: 'Serie A',          Badge: SerieABadge     },
]

// ── Navbar component ──────────────────────────────────────────────────────

function Navbar() {
  const { pathname } = useLocation()

  // Derive active competition from current pathname.
  // Used to pass the correct code + label to PipelineButton.
  // Fallback to PL defaults if on a route that isn't a competition page
  // (e.g. /matches/:id detail view — pipeline shouldn't be needed there).
  const activeLink  = COMPETITION_LINKS.find(({ href }) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)
  )
  const activeCode  = activeLink?.code  ?? 'PL'
  const activeLabel = activeLink?.label ?? 'Premier League'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-surface border-b border-bdr">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

        {/* ── Wordmark ── */}
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <div>
            <span className="font-display text-2xl text-textprimary tracking-wider">
              FREEKICK
            </span>
            <span className="block text-xs text-fkgreenbright -mt-1 tracking-widest uppercase font-condensed">
              Match Intelligence
            </span>
          </div>
        </Link>

        {/* ── Competition links — hidden on mobile ── */}
        <div className="hidden md:flex items-center gap-1">
          {COMPETITION_LINKS.map(({ href, code, label, Badge }) => {
            const isActive = href === '/'
              ? pathname === '/'
              : pathname.startsWith(href)

            return (
              <Link
                key={code}
                to={href}
                title={label}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded
                  font-condensed text-xs font-bold tracking-widest uppercase
                  transition-colors duration-150
                  ${isActive
                    ? 'bg-surface3 text-textprimary border border-bdr'
                    : 'text-textsecondary hover:text-textprimary hover:bg-surface2'
                  }
                `}
              >
                <Badge />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>

        {/* ── Pipeline button ── */}
        {/*
          Passes both the API code (competition) and the display name (label).
          PipelineButton sends the code to the backend and shows the label
          to the user — these two concerns are intentionally kept separate.
        */}
        <div className="shrink-0">
          <PipelineButton competition={activeCode} label={activeLabel} />
        </div>

      </div>
    </nav>
  )
}

export default Navbar
