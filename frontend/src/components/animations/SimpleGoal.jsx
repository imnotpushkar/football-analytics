// src/components/animations/SimpleGoal.jsx
// Trigger: any goal event (generic fallback for goals)
// Duration: ~1.8s total — ball travels into goal, GOAL! burst appears

import { useEffect, useRef } from 'react'

function lerp(a, b, t) { return a + (b - a) * t }
function easeOut(x) { return 1 - Math.pow(1 - x, 3) }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }

// WHY useRef + direct setAttribute instead of useState?
// Animations run at 60fps. useState triggers a React re-render on every
// frame — that's 60 virtual DOM diffs per second just for position values.
// Direct SVG attribute mutation bypasses React entirely and is the correct
// pattern for any requestAnimationFrame-based animation. React owns the
// structure (JSX), the animation loop owns the values (setAttribute).

export default function SimpleGoal({ onComplete }) {
  const svgRef = useRef(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const ball  = svg.querySelector('#sg-ball')
    const trail = svg.querySelector('#sg-trail')
    const txt   = svg.querySelector('#sg-text')
    const ring1 = svg.querySelector('#sg-ring1')
    const ring2 = svg.querySelector('#sg-ring2')

    const set = (el, attrs) => {
      if (!el) return
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
    }

    let pts = []
    let phase = 0
    let phaseStart = null
    let raf = null

    function tick(now) {
      if (!phaseStart) phaseStart = now
      const t = Math.min((now - phaseStart) / 900, 1)

      if (phase === 0) {
        // Ball travels bottom-left into top-right of goal
        const e = easeOut(t)
        const x = lerp(30, 295, e)
        const y = lerp(142, 48, e) - Math.sin(t * Math.PI) * 20
        set(ball, { cx: x, cy: y })
        pts.push([x, y])
        if (pts.length > 1) {
          trail.setAttribute('d', 'M' + pts.map(p => p.join(',')).join(' L'))
        }
        if (t >= 1) { phase = 1; phaseStart = now }

      } else {
        // Burst rings expand and GOAL! text grows
        const e = easeOut(t)
        set(txt,   { 'font-size': lerp(0, 58, e), opacity: 1 })
        set(ring1, { r: lerp(0, 72, e), opacity: clamp(1 - t, 0, 1) })
        set(ring2, { r: lerp(0, 48, easeOut(clamp(t * 1.5 - 0.1, 0, 1))), opacity: clamp(1 - t * 0.8, 0, 1) })
        if (t >= 1) { if (onComplete) onComplete(); return }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [])

  return (
    <svg ref={svgRef} viewBox="0 0 380 180" fill="none" width="380" height="180">
      {/* Goalposts */}
      <line x1="40"  y1="28" x2="40"  y2="158" stroke="rgba(237,232,224,0.2)" strokeWidth="3"/>
      <line x1="340" y1="28" x2="340" y2="158" stroke="rgba(237,232,224,0.2)" strokeWidth="3"/>
      <line x1="40"  y1="28" x2="340" y2="28"  stroke="rgba(237,232,224,0.2)" strokeWidth="3"/>
      {/* Net verticals */}
      {[100, 160, 220, 280].map(x => (
        <line key={x} x1={x} y1="28" x2={x} y2="158" stroke="rgba(237,232,224,0.04)" strokeWidth="1"/>
      ))}
      {/* Net horizontals */}
      {[68, 108, 148].map(y => (
        <line key={y} x1="40" y1={y} x2="340" y2={y} stroke="rgba(237,232,224,0.04)" strokeWidth="1"/>
      ))}
      {/* Ground line */}
      <line x1="0" y1="168" x2="380" y2="168" stroke="rgba(69,196,102,0.15)" strokeWidth="1"/>
      {/* Ball trail */}
      <path id="sg-trail" d="" stroke="rgba(232,150,14,0.2)" strokeWidth="1.5" strokeDasharray="4,5" fill="none"/>
      {/* Ball */}
      <circle id="sg-ball" cx="30" cy="142" r="12" stroke="#e8960e" strokeWidth="2" fill="rgba(232,150,14,0.1)"/>
      {/* Burst rings — start at r=0, expand on goal */}
      <circle id="sg-ring1" cx="190" cy="90" r="0" fill="rgba(69,196,102,0.12)"/>
      <circle id="sg-ring2" cx="190" cy="90" r="0" fill="rgba(232,150,14,0.1)"/>
      {/* GOAL! text */}
      <text id="sg-text" x="190" y="112" textAnchor="middle"
        fontFamily="'Bebas Neue', sans-serif" fontSize="0"
        fill="#45c466" letterSpacing="8" opacity="0">
        GOAL!
      </text>
    </svg>
  )
}
