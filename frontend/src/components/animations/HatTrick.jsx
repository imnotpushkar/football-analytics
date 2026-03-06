// src/components/animations/HatTrick.jsx
// Trigger: same player appears in 3 goal events
// Duration: ~2.4s — three balls spin in one by one, HAT-TRICK label rises

// This is the one animation that uses useState instead of direct DOM mutation.
// Reason: the animation is CSS-transition-based (transform + opacity on divs),
// not a continuous per-frame update. CSS transitions are handled by the browser's
// compositor thread — more efficient than JS for discrete state changes.
// We only need 6 timed state flips, not 60fps attribute mutations.

import { useState, useEffect } from 'react'

export default function HatTrick({ onComplete, matchData }) {
  const [b1, setB1] = useState(false)
  const [b2, setB2] = useState(false)
  const [b3, setB3] = useState(false)
  const [showLabel,  setShowLabel]  = useState(false)
  const [showScorer, setShowScorer] = useState(false)

  // Hat-trick scorer name — passed from determineAnimation via matchData
  const scorer = matchData?.hattrickScorer || ''

  useEffect(() => {
    const timers = [
      setTimeout(() => setB1(true),        200),
      setTimeout(() => setB2(true),        560),
      setTimeout(() => setB3(true),        920),
      setTimeout(() => setShowLabel(true), 1320),
      setTimeout(() => setShowScorer(true),1520),
      setTimeout(() => { if (onComplete) onComplete() }, 2400),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  const ballBase = {
    width: 52, height: 52,
    borderRadius: '50%',
    border: '2px solid #e8960e',
    background: 'rgba(232,150,14,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 22, color: '#e8960e',
    transition: 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s, box-shadow 0.3s',
  }

  const ballShown  = { ...ballBase, transform: 'scale(1) rotate(0deg)',     opacity: 1, boxShadow: '0 0 24px rgba(232,150,14,0.3)' }
  const ballHidden = { ...ballBase, transform: 'scale(0) rotate(-180deg)', opacity: 0, boxShadow: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>

      {/* Three numbered balls */}
      <div style={{ display: 'flex', gap: 28 }}>
        <div style={b1 ? ballShown : ballHidden}>1</div>
        <div style={b2 ? ballShown : ballHidden}>2</div>
        <div style={b3 ? ballShown : ballHidden}>3</div>
      </div>

      {/* HAT-TRICK label */}
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 58, letterSpacing: 6, color: '#e8960e', lineHeight: 1,
        textShadow: '0 0 40px rgba(232,150,14,0.45)',
        opacity:    showLabel ? 1 : 0,
        transform:  showLabel ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.5s, transform 0.5s',
      }}>
        HAT-TRICK
      </div>

      {/* Scorer name — only shown if passed in */}
      {scorer && (
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 13, letterSpacing: 4,
          color: '#9c9080', textTransform: 'uppercase',
          opacity:    showScorer ? 1 : 0,
          transition: 'opacity 0.5s 0.2s',
        }}>
          {scorer}
        </div>
      )}
    </div>
  )
}
