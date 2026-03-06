// src/components/MatchTransition.jsx
//
// Full-screen overlay that plays the contextual animation before
// navigating to the match detail page.
//
// Mount/unmount lifecycle:
//   1. Parent (MatchesPage) sets transitionState → this component mounts
//   2. Overlay fades IN (CSS transition, 200ms)
//   3. Animation component plays and calls onComplete()
//   4. Overlay fades OUT (CSS transition, 300ms)
//   5. Parent navigates to /matches/:id, component unmounts
//
// The overlay sits at z-50 (above navbar z-40 and ticker z-30).
// Background is bg-bg (#100e0b) — matches app background exactly.
// Animations render SVG only (transparent bg) so they sit on the dark surface.

import { useState, useEffect } from 'react'
import SimpleGoal       from './animations/SimpleGoal'
import HeaderGoal       from './animations/HeaderGoal'
import RedCard          from './animations/RedCard'
import HatTrick         from './animations/HatTrick'
import LastMinuteWinner from './animations/LastMinuteWinner'
import Penalty          from './animations/Penalty'
import GKDive           from './animations/GKDive'
import CornerKick       from './animations/CornerKick'
import TacticalArrows   from './animations/TacticalArrows'

// Map animation type strings → components
const ANIMATION_MAP = {
  simplegoal:  SimpleGoal,
  header:      HeaderGoal,
  redcard:     RedCard,
  hattrick:    HatTrick,
  lastminute:  LastMinuteWinner,
  penalty:     Penalty,
  gkdive:      GKDive,
  corner:      CornerKick,
  tactical:    TacticalArrows,
}

// Label shown above animation — contextual flavour text
const ANIMATION_LABELS = {
  simplegoal:  'Goal',
  header:      'Header Goal',
  redcard:     'Red Card',
  hattrick:    'Hat-Trick',
  lastminute:  'Last Minute Winner',
  penalty:     'Penalty Goal',
  gkdive:      'Goalkeeper Masterclass',
  corner:      'Set Piece',
  tactical:    'Tactical Battle',
}

export default function MatchTransition({ animationType, matchData, onDone }) {
  const [visible, setVisible] = useState(false)

  // Fade in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  const handleAnimationComplete = () => {
    // Start fade out
    setVisible(false)
    // After CSS transition completes, tell parent to navigate
    setTimeout(onDone, 320)
  }

  const AnimationComponent = ANIMATION_MAP[animationType] || CornerKick
  const label = ANIMATION_LABELS[animationType] || 'Match Analysis'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        backgroundColor: '#100e0b',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease-in',
      }}
    >
      {/* Top — competition + match context */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <p style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 10,
          letterSpacing: 5,
          color: '#45c466',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 6,
        }}>
          {label}
        </p>
        <p style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 18,
          letterSpacing: 2,
          color: '#ede8e0',
          fontWeight: 600,
        }}>
          {matchData?.home_team} {matchData?.home_score ?? '–'} – {matchData?.away_score ?? '–'} {matchData?.away_team}
        </p>
        {matchData?.competition && (
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11,
            letterSpacing: 3,
            color: '#5a5040',
            textTransform: 'uppercase',
            marginTop: 4,
          }}>
            {matchData.competition}{matchData.matchday ? ` · MD ${matchData.matchday}` : ''}
          </p>
        )}
      </div>

      {/* Animation */}
      <AnimationComponent
        onComplete={handleAnimationComplete}
        matchData={matchData}
      />

      {/* Bottom — loading hint */}
      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 10,
        letterSpacing: 5,
        color: '#3d3528',
        textTransform: 'uppercase',
        marginTop: 36,
        animation: 'pulse 2s infinite',
      }}>
        Loading analysis...
      </p>
    </div>
  )
}
