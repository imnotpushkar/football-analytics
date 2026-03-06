// src/components/animations/GKDive.jsx
// Trigger: goalkeeper is top player in the summary (parsed from AI text)
// Duration: ~2.4s — GK dives to make a save, SAVE! text flashes
// Ported from prototype-gkdive.html

import { useEffect, useRef } from 'react'

function lerp(a, b, t) { return a + (b - a) * t }
function easeOut(x) { return 1 - Math.pow(1 - x, 3) }
function easeIn(x) { return x * x }
function easeInOut(x) { return x < 0.5 ? 2*x*x : 1 - Math.pow(-2*x+2, 2)/2 }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }

export default function GKDive({ onComplete }) {
  const svgRef = useRef(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const gk         = svg.querySelector('#gk-group')
    const gkShadow   = svg.querySelector('#gk-shadow')
    const ball        = svg.querySelector('#gk-ball')
    const ballShadow  = svg.querySelector('#gk-bshadow')
    const saveText    = svg.querySelector('#gk-save')
    const trail       = svg.querySelector('#gk-trail')

    const set = (el, attrs) => {
      if (!el) return
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
    }

    // Ball travels from right side toward top-left corner of goal
    // GK dives right-to-left to meet it

    let phase = 0, ps = null, trailPts = [], raf = null

    function tick(now) {
      if (!ps) ps = now
      const elapsed = now - ps

      if (phase === 0) {
        // Ball travels toward top-left corner (fast)
        const t = Math.min(elapsed / 750, 1)
        const e = easeIn(t)
        const bx = lerp(458, 68, e)
        const by = lerp(38, 28, e)
        set(ball, { cx: bx, cy: by })
        // Shadow shrinks as ball rises
        set(ballShadow, { cx: bx, ry: lerp(2.5, 1, t) })
        trailPts.push([bx, by])
        if (trailPts.length > 1) {
          trail.setAttribute('d', 'M' + trailPts.map(p => p.join(',')).join(' L'))
        }
        if (t >= 1) { phase = 1; ps = now }

      } else if (phase === 1) {
        // GK dives — translate and rotate
        const t = Math.min(elapsed / 480, 1)
        const e = easeOut(t)
        const dx = lerp(0, -80, e)
        const dy = lerp(0, 30, e)
        const rot = lerp(0, -55, e)
        gk.setAttribute('transform', `translate(${260 + dx}, ${0 + dy}) rotate(${rot}, 0, 80)`)
        // GK shadow stretches
        set(gkShadow, { cx: lerp(260, 188, e), rx: lerp(28, 50, e) })
        if (t >= 1) { phase = 2; ps = now }

      } else if (phase === 2) {
        // SAVE! text expands
        const t = Math.min(elapsed / 420, 1)
        set(saveText, { 'font-size': lerp(0, 44, easeOut(t)), opacity: 1 })
        if (elapsed >= 700) { if (onComplete) onComplete(); return }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [])

  return (
    <svg ref={svgRef} viewBox="0 0 520 200" fill="none" width="520" height="200">
      {/* Goalposts */}
      <line x1="30"  y1="18" x2="30"  y2="170" stroke="rgba(237,232,224,0.2)" strokeWidth="3"/>
      <line x1="490" y1="18" x2="490" y2="170" stroke="rgba(237,232,224,0.2)" strokeWidth="3"/>
      <line x1="30"  y1="18" x2="490" y2="18"  stroke="rgba(237,232,224,0.2)" strokeWidth="3"/>
      {/* Net */}
      {[80,130,180,230,280,330,380,430].map(x => (
        <line key={x} x1={x} y1="18" x2={x} y2="170" stroke="rgba(237,232,224,0.05)" strokeWidth="1"/>
      ))}
      {[58, 98, 138].map(y => (
        <line key={y} x1="30" y1={y} x2="490" y2={y} stroke="rgba(237,232,224,0.05)" strokeWidth="1"/>
      ))}
      {/* Goal line */}
      <line x1="30" y1="170" x2="490" y2="170" stroke="rgba(69,196,102,0.4)" strokeWidth="2"/>
      {/* Ground */}
      <line x1="0" y1="188" x2="520" y2="188" stroke="rgba(69,196,102,0.18)" strokeWidth="1"/>

      {/* Shadows */}
      <ellipse id="gk-shadow" cx="260" cy="186" rx="28" ry="4" fill="rgba(0,0,0,0.3)"/>
      <ellipse id="gk-bshadow" cx="458" cy="188" rx="8" ry="2.5" fill="rgba(232,150,14,0.18)"/>

      {/* GK — amber jersey, centred at x=260 */}
      <g id="gk-group" transform="translate(260, 0)">
        {/* Head */}
        <circle cx="0" cy="48" r="18" stroke="#ede8e0" strokeWidth="2.5" fill="none"/>
        {/* GK cap peak */}
        <path d="M-15 42 Q0 34 15 42" stroke="#e8960e" strokeWidth="2" fill="none" strokeLinecap="round"/>
        {/* Eyes */}
        <circle cx="-6" cy="46" r="2.5" fill="#ede8e0"/>
        <circle cx="6"  cy="46" r="2.5" fill="#ede8e0"/>
        {/* Amber jersey body */}
        <path d="M-17 66 Q-26 72 -30 82 L-22 84 Q-20 94 -18 106 L18 106 Q20 94 22 84 L30 82 Q26 72 17 66 Z"
          stroke="#e8960e" strokeWidth="2.5" fill="rgba(232,150,14,0.08)"/>
        {/* Chest stripe */}
        <path d="M-8 66 L0 74 L8 66" stroke="#e8960e" strokeWidth="2" fill="none" strokeLinecap="round"/>
        {/* Gloves */}
        <circle cx="-32" cy="86" r="8" stroke="#ede8e0" strokeWidth="2" fill="rgba(237,232,224,0.08)"/>
        <circle cx="32"  cy="86" r="8" stroke="#ede8e0" strokeWidth="2" fill="rgba(237,232,224,0.08)"/>
        {/* Arms */}
        <path d="M-18 72 Q-32 78 -40 90" stroke="#c8a87a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M18  72 Q32  78 40  90" stroke="#c8a87a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        {/* Shorts */}
        <path d="M-18 106 L-20 126 L-2 128 L0 118 L2 128 L20 126 L18 106 Z"
          stroke="#e8960e" strokeWidth="2" fill="rgba(200,120,10,0.1)"/>
        {/* Legs */}
        <path d="M-12 128 Q-16 148 -20 166" stroke="#c8a87a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M12  128 Q16  148 20  166" stroke="#c8a87a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        {/* Boots */}
        <path d="M-26 164 Q-18 172 -8 168 Q-6 162 -12 159 L-24 163 Z" stroke="#ede8e0" strokeWidth="1.5" fill="rgba(237,232,224,0.04)"/>
        <path d="M14  164 Q22  172 32  168 Q34  162 28  159 L16  163 Z"  stroke="#ede8e0" strokeWidth="1.5" fill="rgba(237,232,224,0.04)"/>
      </g>

      {/* Ball trail */}
      <path id="gk-trail" d="" stroke="rgba(232,150,14,0.22)" strokeWidth="1.5" strokeDasharray="4,6" fill="none"/>

      {/* Ball */}
      <g id="gk-ball-group">
        <circle id="gk-ball" cx="458" cy="38" r="16"
          stroke="#e8960e" strokeWidth="2.5" fill="rgba(232,150,14,0.09)"/>
        {/* Ball seams */}
        <path d="M444 38 Q458 32 472 38" stroke="#e8960e" strokeWidth="1.5" strokeDasharray="2,3" fill="none"/>
        <path d="M458 22 Q464 38 458 54" stroke="#e8960e" strokeWidth="1.5" strokeDasharray="2,3" fill="none"/>
      </g>

      {/* SAVE! text */}
      <text id="gk-save" x="260" y="112" textAnchor="middle"
        fontFamily="'Bebas Neue', sans-serif" fontSize="0"
        fill="#45c466" letterSpacing="6" opacity="0">
        SAVE!
      </text>
    </svg>
  )
}
