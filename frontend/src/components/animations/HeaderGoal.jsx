// src/components/animations/HeaderGoal.jsx
// Trigger: goal event with detail containing 'head' or 'aerial'
// Duration: ~2.8s — cross comes in, player jumps, headed ball flies into goal

import { useEffect, useRef } from 'react'

function lerp(a, b, t) { return a + (b - a) * t }
function easeOut(x) { return 1 - Math.pow(1 - x, 3) }

export default function HeaderGoal({ onComplete }) {
  const svgRef = useRef(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const crossBall  = svg.querySelector('#hg-crossball')
    const headBall   = svg.querySelector('#hg-headball')
    const playerHead = svg.querySelector('#hg-head')
    const playerBody = svg.querySelector('#hg-body')
    const trail      = svg.querySelector('#hg-trail')
    const txt        = svg.querySelector('#hg-text')

    const set = (el, attrs) => {
      if (!el) return
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
    }

    let phase = 0
    let phaseStart = null
    let trailPts = []
    let raf = null

    function tick(now) {
      if (!phaseStart) phaseStart = now
      const elapsed = now - phaseStart

      if (phase === 0) {
        // Cross ball floats in from left side
        const t = Math.min(elapsed / 800, 1)
        const e = easeOut(t)
        set(crossBall, {
          cx: lerp(10, 80, e),
          cy: lerp(55, 118, e) - Math.sin(t * Math.PI) * 42,
        })
        if (t >= 1) { phase = 1; phaseStart = now }

      } else if (phase === 1) {
        // Player jumps — head rises then falls
        const t = Math.min(elapsed / 380, 1)
        set(crossBall, { opacity: 0 })
        set(headBall, { opacity: 1 })
        const jump = Math.sin(t * Math.PI) * 28
        set(playerHead, { cy: 128 - jump })
        set(playerBody, { y1: (128 - jump) + 15, y2: 178 })
        if (t >= 1) { phase = 2; phaseStart = now }

      } else if (phase === 2) {
        // Headed ball flies into goal top corner
        const t = Math.min(elapsed / 650, 1)
        const e = easeOut(t)
        const x = lerp(80, 295, e)
        const y = lerp(118, 38, e) + Math.sin(t * Math.PI * 0.5) * 18
        set(headBall, { cx: x, cy: y })
        trailPts.push([x, y])
        if (trailPts.length > 1) {
          trail.setAttribute('d', 'M' + trailPts.map(p => p.join(',')).join(' L'))
        }
        if (t >= 1) { phase = 3; phaseStart = now }

      } else {
        // HEADER! text flash
        const t = Math.min(elapsed / 420, 1)
        set(txt, { 'font-size': lerp(0, 46, easeOut(t)), opacity: 1 })
        if (elapsed >= 650) { if (onComplete) onComplete(); return }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [])

  return (
    <svg ref={svgRef} viewBox="0 0 380 205" fill="none" width="380" height="205">
      {/* Goalposts — offset right so player fits on left */}
      <line x1="118" y1="28" x2="118" y2="162" stroke="rgba(237,232,224,0.2)" strokeWidth="3"/>
      <line x1="342" y1="28" x2="342" y2="162" stroke="rgba(237,232,224,0.2)" strokeWidth="3"/>
      <line x1="118" y1="28" x2="342" y2="28"  stroke="rgba(237,232,224,0.2)" strokeWidth="3"/>
      {[174, 230, 286].map(x => (
        <line key={x} x1={x} y1="28" x2={x} y2="162" stroke="rgba(237,232,224,0.04)" strokeWidth="1"/>
      ))}
      {[78, 122].map(y => (
        <line key={y} x1="118" y1={y} x2="342" y2={y} stroke="rgba(237,232,224,0.04)" strokeWidth="1"/>
      ))}
      <line x1="0" y1="178" x2="380" y2="178" stroke="rgba(69,196,102,0.15)" strokeWidth="1"/>

      {/* Cross ball — travels from left */}
      <circle id="hg-crossball" cx="10" cy="55" r="11"
        stroke="#e8960e" strokeWidth="2" fill="rgba(232,150,14,0.1)"/>

      {/* Player stick figure — stands left of goal */}
      <circle id="hg-head" cx="80" cy="128" r="14" stroke="#ede8e0" strokeWidth="2" fill="none"/>
      <line id="hg-body" x1="80" y1="142" x2="80" y2="178" stroke="#ede8e0" strokeWidth="2"/>
      <line x1="80" y1="154" x2="62" y2="166" stroke="#ede8e0" strokeWidth="2"/>
      <line x1="80" y1="154" x2="98" y2="166" stroke="#ede8e0" strokeWidth="2"/>
      <line x1="80" y1="178" x2="66" y2="196" stroke="#ede8e0" strokeWidth="2"/>
      <line x1="80" y1="178" x2="94" y2="196" stroke="#ede8e0" strokeWidth="2"/>

      {/* Headed ball trail + ball */}
      <path id="hg-trail" d="" stroke="rgba(69,196,102,0.28)" strokeWidth="1.5" strokeDasharray="3,5" fill="none"/>
      <circle id="hg-headball" cx="80" cy="118" r="11"
        stroke="#45c466" strokeWidth="2" fill="rgba(69,196,102,0.1)" opacity="0"/>

      {/* HEADER! text */}
      <text id="hg-text" x="230" y="112" textAnchor="middle"
        fontFamily="'Bebas Neue', sans-serif" fontSize="0"
        fill="#45c466" letterSpacing="6" opacity="0">
        HEADER!
      </text>
    </svg>
  )
}
