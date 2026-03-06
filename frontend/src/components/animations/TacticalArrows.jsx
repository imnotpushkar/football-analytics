// src/components/animations/TacticalArrows.jsx
// Trigger: goalless match (0-0 scoreline)
// Duration: ~3.2s — formation appears, tactical arrows draw themselves

import { useEffect, useRef } from 'react'

function lerp(a, b, t) { return a + (b - a) * t }
function easeOut(x) { return 1 - Math.pow(1 - x, 3) }
function easeInOut(x) { return x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x+2, 3)/2 }

// Formation: 4-3-3
// GK (grey) → 4 defenders (grey) → 3 midfielders (green) → 3 forwards (amber)
const PLAYERS = [
  { id: 'ta-p1',  cx: 28,  cy: 110, color: '#9c9080' }, // GK
  { id: 'ta-p2',  cx: 80,  cy: 58,  color: '#9c9080' }, // RB
  { id: 'ta-p3',  cx: 80,  cy: 86,  color: '#9c9080' }, // RCB
  { id: 'ta-p4',  cx: 80,  cy: 134, color: '#9c9080' }, // LCB
  { id: 'ta-p5',  cx: 80,  cy: 162, color: '#9c9080' }, // LB
  { id: 'ta-p6',  cx: 158, cy: 68,  color: '#45c466' }, // RM
  { id: 'ta-p7',  cx: 158, cy: 110, color: '#45c466' }, // CM
  { id: 'ta-p8',  cx: 158, cy: 152, color: '#45c466' }, // LM
  { id: 'ta-p9',  cx: 272, cy: 62,  color: '#e8960e' }, // RW
  { id: 'ta-p10', cx: 272, cy: 110, color: '#e8960e' }, // CF
  { id: 'ta-p11', cx: 272, cy: 158, color: '#e8960e' }, // LW
]

const ARROWS = [
  { id: 'ta-arr1', color: '#45c466' },  // CM through ball
  { id: 'ta-arr2', color: '#e8960e' },  // RW overlap
  { id: 'ta-arr3', color: '#9c9080' },  // LB push
  { id: 'ta-arr4', color: 'rgba(200,16,46,0.7)' }, // CF press
]

export default function TacticalArrows({ onComplete }) {
  const svgRef = useRef(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const set = (el, attrs) => {
      if (!el) return
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
    }

    // Fade players in staggered
    PLAYERS.forEach(({ id }, i) => {
      setTimeout(() => {
        const el = svg.querySelector(`#${id}`)
        let ps = null
        function fade(now) {
          if (!ps) ps = now
          const t = Math.min((now - ps) / 300, 1)
          set(el, { opacity: easeOut(t) })
          if (t < 1) requestAnimationFrame(fade)
        }
        requestAnimationFrame(fade)
      }, i * 85)
    })

    // Draw arrows after players settle
    const ARROW_DELAY = 1000
    ARROWS.forEach(({ id }, i) => {
      setTimeout(() => {
        const el = svg.querySelector(`#${id}`)
        if (!el) return
        const LEN = 200
        set(el, { 'stroke-dasharray': LEN, 'stroke-dashoffset': LEN })
        let ps = null
        function draw(now) {
          if (!ps) ps = now
          const t = Math.min((now - ps) / 580, 1)
          set(el, { 'stroke-dashoffset': lerp(LEN, 0, easeInOut(t)) })
          if (t < 1) requestAnimationFrame(draw)
        }
        requestAnimationFrame(draw)
      }, ARROW_DELAY + i * 320)
    })

    // Formation label + onComplete
    const totalTime = ARROW_DELAY + ARROWS.length * 320 + 580
    setTimeout(() => {
      const label = svg.querySelector('#ta-label')
      let ps = null
      function showLabel(now) {
        if (!ps) ps = now
        const t = Math.min((now - ps) / 400, 1)
        set(label, { 'font-size': lerp(0, 14, easeOut(t)), opacity: easeOut(t) })
        if (t < 1) requestAnimationFrame(showLabel)
        else setTimeout(() => { if (onComplete) onComplete() }, 380)
      }
      requestAnimationFrame(showLabel)
    }, totalTime)
  }, [])

  return (
    <svg ref={svgRef} viewBox="0 0 420 220" fill="none" width="420" height="220">
      {/* Pitch outline */}
      <rect x="10" y="10" width="400" height="200" rx="2"
        stroke="rgba(69,196,102,0.12)" strokeWidth="1.5" fill="none"/>
      {/* Centre circle */}
      <circle cx="210" cy="110" r="38"
        stroke="rgba(69,196,102,0.08)" strokeWidth="1.5" fill="none"/>
      {/* Halfway line */}
      <line x1="10" y1="110" x2="410" y2="110" stroke="rgba(69,196,102,0.08)" strokeWidth="1.5"/>
      {/* Penalty areas */}
      <rect x="10"  y="54" width="62"  height="112" stroke="rgba(69,196,102,0.08)" strokeWidth="1" fill="none"/>
      <rect x="348" y="54" width="62"  height="112" stroke="rgba(69,196,102,0.08)" strokeWidth="1" fill="none"/>

      {/* Players — start at opacity 0 */}
      {PLAYERS.map(({ id, cx, cy, color }) => (
        <circle key={id} id={id}
          cx={cx} cy={cy} r="7"
          stroke={color} strokeWidth="1.5"
          fill={color + '1a'}
          opacity="0"
        />
      ))}

      {/* Arrow marker definitions */}
      <defs>
        {[
          ['arr-green', '#45c466'],
          ['arr-amber', '#e8960e'],
          ['arr-muted', '#9c9080'],
          ['arr-red',   'rgba(200,16,46,0.8)'],
        ].map(([id, fill]) => (
          <marker key={id} id={id} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={fill}/>
          </marker>
        ))}
      </defs>

      {/* Tactical arrows — drawn via stroke-dashoffset */}
      <path id="ta-arr1" d="M165 110 Q210 94 265 110"
        stroke="#45c466" strokeWidth="1.5" fill="none"
        markerEnd="url(#arr-green)"/>
      <path id="ta-arr2" d="M279 158 Q312 142 332 110"
        stroke="#e8960e" strokeWidth="1.5" fill="none"
        markerEnd="url(#arr-amber)"/>
      <path id="ta-arr3" d="M87 162 Q122 156 150 152"
        stroke="#9c9080" strokeWidth="1.5" fill="none"
        markerEnd="url(#arr-muted)"/>
      <path id="ta-arr4" d="M279 110 Q312 96 356 84"
        stroke="rgba(200,16,46,0.7)" strokeWidth="1.5"
        strokeDasharray="6,4" fill="none"
        markerEnd="url(#arr-red)"/>

      {/* Formation label */}
      <text id="ta-label" x="210" y="208" textAnchor="middle"
        fontFamily="'Barlow Condensed', sans-serif" fontSize="0"
        fill="#5a5040" letterSpacing="5" opacity="0">
        4 — 3 — 3
      </text>
    </svg>
  )
}
