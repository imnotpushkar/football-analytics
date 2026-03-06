// src/components/animations/LastMinuteWinner.jsx
// Trigger: winning goal at minute 85+
// Duration: ~2.6s — red clock appears, ball shoots in, WINNER! flashes

import { useState, useEffect, useRef } from 'react'

function lerp(a, b, t) { return a + (b - a) * t }
function easeOut(x) { return 1 - Math.pow(1 - x, 3) }

export default function LastMinuteWinner({ onComplete, matchData }) {
  const svgRef = useRef(null)
  const [clockShow, setClockShow] = useState(false)
  const [flashShow, setFlashShow] = useState(false)

  // Use actual late minute from match data if available
  const minute = matchData?.lateMinute ? `${matchData.lateMinute}'` : "90+3'"

  useEffect(() => {
    // Step 1: clock slams in
    const t1 = setTimeout(() => setClockShow(true), 80)

    // Step 2: ball animation starts after clock settles
    const t2 = setTimeout(() => {
      const svg = svgRef.current
      if (!svg) return

      const ball  = svg.querySelector('#lmw-ball')
      const trail = svg.querySelector('#lmw-trail')
      const burst = svg.querySelector('#lmw-burst')
      const txt   = svg.querySelector('#lmw-text')

      const set = (el, attrs) => {
        if (!el) return
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
      }

      let pts = [], phase = 0, ps = null, raf = null

      function tick(now) {
        if (!ps) ps = now
        const elapsed = now - ps

        if (phase === 0) {
          const t = Math.min(elapsed / 680, 1)
          const e = easeOut(t)
          const x = lerp(22, 288, e)
          const y = lerp(72, 30, e) - Math.sin(t * Math.PI) * 14
          set(ball, { cx: x, cy: y })
          pts.push([x, y])
          if (pts.length > 1) {
            trail.setAttribute('d', 'M' + pts.map(p => p.join(',')).join(' L'))
          }
          if (t >= 1) { phase = 1; ps = now; set(burst, { opacity: 1 }) }

        } else {
          const t = Math.min(elapsed / 520, 1)
          set(txt, { 'font-size': lerp(0, 50, easeOut(t)), opacity: 1 })
          set(burst, { opacity: 1 - easeOut(t) * 0.4 })
          if (elapsed >= 580) setFlashShow(true)
          if (elapsed >= 1100) { if (onComplete) onComplete(); return }
        }

        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, 780)

    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, position: 'relative' }}>

      {/* Minute clock — red, slams in */}
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 58, color: '#c8102e',
        letterSpacing: 2, lineHeight: 1,
        textShadow: '0 0 32px rgba(200,16,46,0.5)',
        opacity:    clockShow ? 1 : 0,
        transform:  clockShow ? 'scale(1)' : 'scale(0.6)',
        transition: 'opacity 0.35s, transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      }}>
        {minute}
      </div>

      {/* Goal SVG */}
      <svg ref={svgRef} viewBox="0 0 380 140" fill="none" width="380" height="140">
        <line x1="58"  y1="18" x2="58"  y2="122" stroke="rgba(237,232,224,0.2)" strokeWidth="3"/>
        <line x1="322" y1="18" x2="322" y2="122" stroke="rgba(237,232,224,0.2)" strokeWidth="3"/>
        <line x1="58"  y1="18" x2="322" y2="18"  stroke="rgba(237,232,224,0.2)" strokeWidth="3"/>
        {[58,90].map(y => <line key={y} x1="58" y1={y} x2="322" y2={y} stroke="rgba(237,232,224,0.04)" strokeWidth="1"/>)}
        {[124,190,256].map(x => <line key={x} x1={x} y1="18" x2={x} y2="122" stroke="rgba(237,232,224,0.04)" strokeWidth="1"/>)}
        <line x1="0" y1="132" x2="380" y2="132" stroke="rgba(69,196,102,0.15)" strokeWidth="1"/>

        <path id="lmw-trail" d="" stroke="rgba(232,150,14,0.2)" strokeWidth="1.5" strokeDasharray="4,5" fill="none"/>
        <circle id="lmw-ball" cx="22" cy="72" r="12" stroke="#e8960e" strokeWidth="2" fill="rgba(232,150,14,0.1)"/>

        {/* Burst lines from impact point */}
        <g id="lmw-burst" opacity="0">
          {[
            [190,72, 190,42], [190,72, 214,50], [190,72, 166,50],
            [190,72, 218,72], [190,72, 162,72],
          ].map(([x1,y1,x2,y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(69,196,102,0.7)" strokeWidth="2.5"/>
          ))}
        </g>

        <text id="lmw-text" x="190" y="88" textAnchor="middle"
          fontFamily="'Bebas Neue', sans-serif" fontSize="0"
          fill="#45c466" letterSpacing="6" opacity="0">
          WINNER!
        </text>
      </svg>

      {/* Big minute flash — overlaid when goal hits */}
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 78, letterSpacing: 6,
        color: '#45c466',
        textShadow: '0 0 64px rgba(69,196,102,0.65)',
        opacity:    flashShow ? 1 : 0,
        transform:  flashShow ? 'scale(1)' : 'scale(0.4)',
        transition: 'opacity 0.3s, transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        position: 'absolute',
        bottom: -48,
        pointerEvents: 'none',
      }}>
        {minute}
      </div>
    </div>
  )
}
