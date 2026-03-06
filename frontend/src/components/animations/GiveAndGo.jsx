// src/components/animations/GiveAndGo.jsx
// HOME PAGE ONLY — Freekick trademark animation, loops indefinitely
// No onComplete prop — this never finishes, it loops
// Two players execute a give-and-go / one-two combination

import { useEffect, useRef } from 'react'

function lerp(a, b, t) { return a + (b - a) * t }
function easeOut(x) { return 1 - Math.pow(1 - x, 3) }
function easeInOut(x) { return x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x+2, 3)/2 }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }

// Animation phases (total loop = 2800ms):
// 0.00 – 0.30  P1 passes to P2 (ball travels right)
// 0.30 – 0.52  P1 makes overlapping run (arrow draws)
// 0.52 – 0.80  P2 lays ball off to overlapping P1
// 0.80 – 0.95  P1 shoots, label fades in
// 0.95 – 1.00  brief hold then loop resets

const LOOP_MS = 2800

export default function GiveAndGo() {
  const svgRef = useRef(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const ball   = svg.querySelector('#gg-ball')
    const p1legL = svg.querySelector('#gg-p1legL')
    const p1legR = svg.querySelector('#gg-p1legR')
    const p2legL = svg.querySelector('#gg-p2legL')
    const p2legR = svg.querySelector('#gg-p2legR')
    const runArr = svg.querySelector('#gg-run')
    const label  = svg.querySelector('#gg-label')

    const set = (el, attrs) => {
      if (!el) return
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
    }

    let startTime = null
    let raf = null

    function tick(now) {
      if (!startTime) startTime = now
      const t = ((now - startTime) % LOOP_MS) / LOOP_MS // 0 → 1, loops

      // ── Ball position ──
      let bx, by
      if (t < 0.30) {
        // P1 (x=85) passes to P2 (x=318)
        const pt = t / 0.30
        const e  = easeOut(pt)
        bx = lerp(85,  318, e)
        by = lerp(124, 124, e) - Math.sin(pt * Math.PI) * 20
      } else if (t < 0.52) {
        // Ball resting at P2
        bx = 318; by = 132
      } else if (t < 0.80) {
        // P2 lays off to overlapping P1 (now at x=344)
        const pt = (t - 0.52) / 0.28
        const e  = easeOut(pt)
        bx = lerp(318, 368, e)
        by = lerp(132, 108, e) - Math.sin(pt * Math.PI) * 14
      } else {
        // Ball traveling into net
        const pt = (t - 0.80) / 0.20
        bx = lerp(368, 415, easeOut(pt))
        by = lerp(108, 98, easeOut(pt))
      }
      set(ball, { cx: bx, cy: by })

      // ── Overlap run arrow ──
      const RUN_LEN = 115
      if (t > 0.28 && t < 0.78) {
        const pt = clamp((t - 0.28) / 0.38, 0, 1)
        set(runArr, {
          'stroke-dashoffset': lerp(RUN_LEN, 0, easeInOut(pt)),
          opacity: 1,
        })
      } else {
        set(runArr, { 'stroke-dashoffset': RUN_LEN, opacity: 0 })
      }

      // ── P2 legs walking (while they have the ball) ──
      const p2swing = Math.sin(t * Math.PI * 9) * 11
      set(p2legL, { x2: 308 + p2swing })
      set(p2legR, { x2: 328 - p2swing })

      // ── P1 legs sprinting on overlap run ──
      if (t > 0.28) {
        const p1swing = Math.sin(t * Math.PI * 11) * 15
        set(p1legL, { x2: 74 + p1swing })
        set(p1legR, { x2: 96 - p1swing })
      } else {
        set(p1legL, { x2: 74 })
        set(p1legR, { x2: 96 })
      }

      // ── GIVE · AND · GO label ──
      if (t > 0.84) {
        const lt = (t - 0.84) / 0.14
        set(label, { opacity: easeOut(lt), 'font-size': lerp(0, 13, easeOut(lt)) })
      } else {
        set(label, { opacity: 0, 'font-size': 0 })
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [])

  return (
    <svg ref={svgRef} viewBox="0 0 480 160" fill="none" width="480" height="160">
      {/* Pitch lines */}
      <line x1="0"   y1="152" x2="480" y2="152" stroke="rgba(69,196,102,0.15)" strokeWidth="1"/>
      {/* Goal area top-right */}
      <line x1="382" y1="38"  x2="480" y2="38"  stroke="rgba(69,196,102,0.1)"  strokeWidth="1"/>
      <line x1="382" y1="38"  x2="382" y2="152" stroke="rgba(69,196,102,0.1)"  strokeWidth="1"/>

      {/* Player 1 — left, white */}
      <g>
        <circle cx="85" cy="94" r="14" stroke="#ede8e0" strokeWidth="2" fill="none"/>
        <line x1="85" y1="108" x2="85" y2="150" stroke="#ede8e0" strokeWidth="2"/>
        <line x1="85" y1="120" x2="66" y2="134" stroke="#ede8e0" strokeWidth="2"/>
        <line x1="85" y1="120" x2="104" y2="130" stroke="#ede8e0" strokeWidth="2"/>
        <line id="gg-p1legL" x1="85" y1="150" x2="74" y2="175" stroke="#ede8e0" strokeWidth="2"/>
        <line id="gg-p1legR" x1="85" y1="150" x2="96" y2="175" stroke="#ede8e0" strokeWidth="2"/>
      </g>

      {/* Player 2 — right, green (teammate) */}
      <g>
        <circle cx="318" cy="94" r="14" stroke="#45c466" strokeWidth="2" fill="none"/>
        <line x1="318" y1="108" x2="318" y2="150" stroke="#45c466" strokeWidth="2"/>
        <line x1="318" y1="120" x2="300" y2="134" stroke="#45c466" strokeWidth="2"/>
        <line x1="318" y1="120" x2="336" y2="130" stroke="#45c466" strokeWidth="2"/>
        <line id="gg-p2legL" x1="318" y1="150" x2="308" y2="175" stroke="#45c466" strokeWidth="2"/>
        <line id="gg-p2legR" x1="318" y1="150" x2="328" y2="175" stroke="#45c466" strokeWidth="2"/>
      </g>

      {/* Overlap run arrow — P1 runs from behind P2 into space */}
      <defs>
        <marker id="gg-arrowhead" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
          <path d="M0,0 L5,2.5 L0,5 Z" fill="rgba(237,232,224,0.45)"/>
        </marker>
      </defs>
      <path id="gg-run"
        d="M85 108 Q188 58 338 92"
        stroke="rgba(237,232,224,0.28)" strokeWidth="1.5"
        strokeDasharray="115" strokeDashoffset="115"
        fill="none" markerEnd="url(#gg-arrowhead)"
        opacity="0"
      />

      {/* Ball */}
      <circle id="gg-ball" cx="85" cy="124" r="10"
        stroke="#e8960e" strokeWidth="2" fill="rgba(232,150,14,0.1)"/>

      {/* GIVE · AND · GO label */}
      <text id="gg-label" x="240" y="144" textAnchor="middle"
        fontFamily="'Barlow Condensed', sans-serif" fontSize="0"
        fill="#5a5040" letterSpacing="6" opacity="0">
        GIVE · AND · GO
      </text>
    </svg>
  )
}
