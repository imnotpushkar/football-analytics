// src/components/animations/Penalty.jsx
// Trigger: penalty goal AND the scoring team won the match
// Duration: ~2.6s — player runs up, shoots, ball goes to corner, net bulges

import { useEffect, useRef } from 'react'

function lerp(a, b, t) { return a + (b - a) * t }
function easeOut(x) { return 1 - Math.pow(1 - x, 3) }
function easeIn(x) { return x * x * x }
function easeInOut(x) { return x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x+2, 3)/2 }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }

export default function Penalty({ onComplete }) {
  const svgRef = useRef(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const shooter    = svg.querySelector('#pen-shooter')
    const ball       = svg.querySelector('#pen-ball')
    const ballShadow = svg.querySelector('#pen-bshadow')
    const trail      = svg.querySelector('#pen-trail')
    const gk         = svg.querySelector('#pen-gk')
    const gkShadow   = svg.querySelector('#pen-gkshadow')
    const txt        = svg.querySelector('#pen-text')
    const netBulge   = svg.querySelector('#pen-net')

    const set = (el, attrs) => {
      if (!el) return
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
    }

    // Shooter starts at penalty spot (x=260, y=165)
    // GK starts centred on goal line (x=260, y=80)
    // Ball goes bottom-right corner (x=445, y=155)
    // GK dives wrong way (left)

    let phase = 0, ps = null, trailPts = [], raf = null

    function tick(now) {
      if (!ps) ps = now
      const elapsed = now - ps

      if (phase === 0) {
        // Shooter runs up (moves from y=165 toward y=148)
        const t = Math.min(elapsed / 600, 1)
        const e = easeIn(t)
        const sy = lerp(165, 145, e)
        set(shooter, { transform: `translate(0, ${lerp(0, -20, e)})` })
        if (t >= 1) { phase = 1; ps = now }

      } else if (phase === 1) {
        // Kick — ball leaves spot toward bottom-right corner
        const t = Math.min(elapsed / 560, 1)
        const e = easeOut(t)
        const bx = lerp(260, 446, e)
        const by = lerp(158, 32, e) + Math.sin(t * Math.PI * 0.4) * 8
        set(ball, { cx: bx, cy: by })
        set(ballShadow, { cx: bx, ry: lerp(3, 0.5, t) })
        trailPts.push([bx, by])
        if (trailPts.length > 1) {
          trail.setAttribute('d', 'M' + trailPts.map(p => p.join(',')).join(' L'))
        }

        // GK dives left (wrong way) — starts diving at t=0.3
        if (t > 0.3) {
          const gt = clamp((t - 0.3) / 0.7, 0, 1)
          const ge = easeOut(gt)
          const gdx = lerp(0, -90, ge)
          const gdy = lerp(0, 28, ge)
          const grot = lerp(0, -50, ge)
          gk.setAttribute('transform', `translate(${260 + gdx}, ${gdy}) rotate(${grot}, 0, 60)`)
          set(gkShadow, { cx: lerp(260, 178, ge), rx: lerp(22, 42, ge) })
        }
        if (t >= 1) { phase = 2; ps = now }

      } else if (phase === 2) {
        // Net bulges — ball in goal — PENALTY SCORED text
        const t = Math.min(elapsed / 420, 1)
        set(netBulge, { opacity: easeOut(t) })
        set(txt, { 'font-size': lerp(0, 44, easeOut(t)), opacity: 1 })
        if (elapsed >= 680) { if (onComplete) onComplete(); return }
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
      {[90,150,210,270,330,390,430].map(x => (
        <line key={x} x1={x} y1="18" x2={x} y2="170" stroke="rgba(237,232,224,0.05)" strokeWidth="1"/>
      ))}
      {[58,98,138].map(y => (
        <line key={y} x1="30" y1={y} x2="490" y2={y} stroke="rgba(237,232,224,0.05)" strokeWidth="1"/>
      ))}
      {/* Goal line */}
      <line x1="30" y1="170" x2="490" y2="170" stroke="rgba(69,196,102,0.38)" strokeWidth="2"/>
      {/* Ground */}
      <line x1="0" y1="188" x2="520" y2="188" stroke="rgba(69,196,102,0.15)" strokeWidth="1"/>
      {/* Penalty spot */}
      <circle cx="260" cy="160" r="3" fill="rgba(237,232,224,0.25)"/>
      {/* Penalty arc */}
      <path d="M200 170 Q260 128 320 170" stroke="rgba(69,196,102,0.1)" strokeWidth="1" fill="none"/>

      {/* Net bulge — visible after goal */}
      <path id="pen-net"
        d="M430 20 Q460 55 460 100 Q460 145 490 170 L490 20 Z"
        fill="rgba(69,196,102,0.06)" stroke="rgba(69,196,102,0.15)" strokeWidth="1"
        opacity="0"/>

      {/* GK shadows */}
      <ellipse id="pen-gkshadow" cx="260" cy="186" rx="22" ry="3.5" fill="rgba(0,0,0,0.25)"/>
      <ellipse id="pen-bshadow"  cx="260" cy="188" rx="8"  ry="3"   fill="rgba(232,150,14,0.15)"/>

      {/* GK — amber jersey */}
      <g id="pen-gk" transform="translate(260, 0)">
        <circle cx="0" cy="46" r="16" stroke="#ede8e0" strokeWidth="2" fill="none"/>
        <path d="M-14 40 Q0 33 14 40" stroke="#e8960e" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M-15 62 Q-23 68 -27 78 L-20 80 Q-18 90 -16 100 L16 100 Q18 90 20 80 L27 78 Q23 68 15 62 Z"
          stroke="#e8960e" strokeWidth="2" fill="rgba(232,150,14,0.07)"/>
        <circle cx="-30" cy="82" r="7" stroke="#ede8e0" strokeWidth="2" fill="rgba(237,232,224,0.07)"/>
        <circle cx="30"  cy="82" r="7" stroke="#ede8e0" strokeWidth="2" fill="rgba(237,232,224,0.07)"/>
        <path d="M-16 68 Q-28 74 -36 84" stroke="#c8a87a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M16  68 Q28  74 36  84" stroke="#c8a87a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M-16 100 L-18 118 L-2 120 L0 112 L2 120 L18 118 L16 100 Z"
          stroke="#e8960e" strokeWidth="2" fill="rgba(200,120,10,0.08)"/>
        <path d="M-10 120 Q-14 138 -17 154" stroke="#c8a87a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M10  120 Q14  138 17  154" stroke="#c8a87a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      </g>

      {/* Shooter stick figure — at penalty spot */}
      <g id="pen-shooter">
        <circle cx="260" cy="138" r="13" stroke="#ede8e0" strokeWidth="2" fill="none"/>
        <line x1="260" y1="151" x2="260" y2="190" stroke="#ede8e0" strokeWidth="2.5"/>
        <line x1="260" y1="163" x2="242" y2="175" stroke="#ede8e0" strokeWidth="2.5"/>
        {/* Kicking arm raised */}
        <line x1="260" y1="163" x2="276" y2="155" stroke="#ede8e0" strokeWidth="2.5"/>
        <line x1="260" y1="190" x2="246" y2="200" stroke="#ede8e0" strokeWidth="2.5"/>
        {/* Kicking leg raised */}
        <line x1="260" y1="190" x2="276" y2="182" stroke="#ede8e0" strokeWidth="2.5"/>
      </g>

      {/* Ball trail + ball */}
      <path id="pen-trail" d="" stroke="rgba(232,150,14,0.22)" strokeWidth="1.5" strokeDasharray="4,6" fill="none"/>
      <circle id="pen-ball" cx="260" cy="158" r="13"
        stroke="#e8960e" strokeWidth="2.5" fill="rgba(232,150,14,0.09)"/>

      {/* PENALTY SCORED text */}
      <text id="pen-text" x="260" y="112" textAnchor="middle"
        fontFamily="'Bebas Neue', sans-serif" fontSize="0"
        fill="#45c466" letterSpacing="5" opacity="0">
        PENALTY SCORED
      </text>
    </svg>
  )
}
