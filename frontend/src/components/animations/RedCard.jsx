// src/components/animations/RedCard.jsx
// Trigger: red card or 2nd yellow (yellowRed) event in match
// Duration: ~2.8s — card rises, pulses red, player walks off → EARLY BATH

import { useEffect, useRef } from 'react'

function lerp(a, b, t) { return a + (b - a) * t }
function easeOut(x) { return 1 - Math.pow(1 - x, 3) }

export default function RedCard({ onComplete }) {
  const svgRef = useRef(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const cardRect = svg.querySelector('#rc-card')
    const cardGlow = svg.querySelector('#rc-glow')
    const player   = svg.querySelector('#rc-player')
    const legL     = svg.querySelector('#rc-legL')
    const legR     = svg.querySelector('#rc-legR')
    const txt      = svg.querySelector('#rc-text')

    const set = (el, attrs) => {
      if (!el) return
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
    }

    let phase = 0
    let phaseStart = null
    let raf = null

    function tick(now) {
      if (!phaseStart) phaseStart = now
      const elapsed = now - phaseStart

      if (phase === 0) {
        // Card scales in with slight rotation snap
        const t = Math.min(elapsed / 480, 1)
        const s = easeOut(t)
        const rot = lerp(-18, 0, s)
        set(cardRect, { transform: `scale(${s}) rotate(${rot})`, 'transform-origin': '14 19' })
        set(cardGlow, { rx: lerp(0, 44, s), ry: lerp(0, 32, s) })
        if (t >= 1) { phase = 1; phaseStart = now }

      } else if (phase === 1) {
        // Card pulses — fills with red
        const pulse = Math.sin(Math.min(elapsed / 320, 1) * Math.PI)
        set(cardRect, { fill: `rgba(200,16,46,${0.12 + pulse * 0.4})` })
        if (elapsed >= 440) {
          phase = 2
          phaseStart = now
          set(player, { opacity: 1 })
        }

      } else if (phase === 2) {
        // Player walks right toward tunnel
        const t = Math.min(elapsed / 1200, 1)
        const x = lerp(0, 58, t * t) // ease-in walk — slow start then pace quickens
        set(player, { transform: `translate(${x}, 0)` })
        // Walking leg swing
        const swing = Math.sin(t * Math.PI * 6) * 13
        set(legL, { x2: 226 + swing })
        set(legR, { x2: 252 - swing })
        if (t >= 1) { phase = 3; phaseStart = now }

      } else {
        // EARLY BATH text
        const t = Math.min(elapsed / 380, 1)
        set(txt, { 'font-size': lerp(0, 38, easeOut(t)), opacity: 1 })
        if (elapsed >= 660) { if (onComplete) onComplete(); return }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [])

  return (
    <svg ref={svgRef} viewBox="0 0 320 200" fill="none" width="320" height="200">
      {/* Referee stick figure */}
      <circle cx="100" cy="48" r="14" stroke="#9c9080" strokeWidth="2" fill="none"/>
      <line x1="100" y1="62"  x2="100" y2="118" stroke="#9c9080" strokeWidth="2.5"/>
      {/* Arm raised holding card */}
      <line x1="100" y1="78"  x2="126" y2="60"  stroke="#9c9080" strokeWidth="2.5"/>
      {/* Other arm */}
      <line x1="100" y1="78"  x2="76"  y2="94"  stroke="#9c9080" strokeWidth="2.5"/>
      <line x1="100" y1="118" x2="87"  y2="154" stroke="#9c9080" strokeWidth="2.5"/>
      <line x1="100" y1="118" x2="113" y2="154" stroke="#9c9080" strokeWidth="2.5"/>

      {/* Card glow ellipse — expands on show */}
      <ellipse id="rc-glow" cx="140" cy="55" rx="0" ry="0" fill="rgba(200,16,46,0.1)"/>

      {/* Red card — lives inside a translate group so transform-origin works in SVG */}
      <g transform="translate(126, 36)">
        <rect id="rc-card"
          width="28" height="38" rx="3"
          fill="rgba(200,16,46,0.12)" stroke="#c8102e" strokeWidth="2.5"
          transform="scale(0) rotate(-18)"
          style={{ transformOrigin: '14px 19px' }}
        />
      </g>

      {/* Player walking off — starts hidden, translates right */}
      <g id="rc-player" opacity="0">
        <circle cx="240" cy="62" r="14" stroke="#ede8e0" strokeWidth="2" fill="none"/>
        {/* Head slightly bowed */}
        <line x1="240" y1="76"  x2="240" y2="124" stroke="#ede8e0" strokeWidth="2.5"/>
        <line x1="240" y1="92"  x2="220" y2="106" stroke="#ede8e0" strokeWidth="2.5"/>
        <line x1="240" y1="92"  x2="256" y2="104" stroke="#ede8e0" strokeWidth="2.5"/>
        <line id="rc-legL" x1="240" y1="124" x2="226" y2="154" stroke="#ede8e0" strokeWidth="2.5"/>
        <line id="rc-legR" x1="240" y1="124" x2="252" y2="154" stroke="#ede8e0" strokeWidth="2.5"/>
      </g>

      {/* EARLY BATH text */}
      <text id="rc-text" x="160" y="185" textAnchor="middle"
        fontFamily="'Bebas Neue', sans-serif" fontSize="0"
        fill="#c8102e" letterSpacing="8" opacity="0">
        EARLY BATH
      </text>
    </svg>
  )
}
