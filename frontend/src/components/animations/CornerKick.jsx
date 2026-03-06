// src/components/animations/CornerKick.jsx
// Trigger: final fallback when no other condition matches
// Duration: ~2.5s — players populate box, run arrow draws, ball swings in

import { useEffect, useRef } from 'react'

function lerp(a, b, t) { return a + (b - a) * t }
function easeOut(x) { return 1 - Math.pow(1 - x, 3) }
function easeInOut(x) { return x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x+2, 3)/2 }

export default function CornerKick({ onComplete }) {
  const svgRef = useRef(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const ball  = svg.querySelector('#ck-ball')
    const a1    = svg.querySelector('#ck-a1')
    const a2    = svg.querySelector('#ck-a2')
    const a3    = svg.querySelector('#ck-a3')
    const d1    = svg.querySelector('#ck-d1')
    const d2    = svg.querySelector('#ck-d2')
    const run   = svg.querySelector('#ck-run')
    const txt   = svg.querySelector('#ck-text')

    const set = (el, attrs) => {
      if (!el) return
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
    }

    // Fade in a single element over `duration` ms after `delay` ms
    const fadeIn = (el, delay, duration = 260) => {
      setTimeout(() => {
        let ps = null
        function fade(now) {
          if (!ps) ps = now
          const t = Math.min((now - ps) / duration, 1)
          set(el, { opacity: easeOut(t) })
          if (t < 1) requestAnimationFrame(fade)
        }
        requestAnimationFrame(fade)
      }, delay)
    }

    // Animate a stroke-dashoffset from full length to 0 (draws the path)
    const drawPath = (el, length, delay, duration = 520) => {
      set(el, { 'stroke-dasharray': length, 'stroke-dashoffset': length })
      setTimeout(() => {
        let ps = null
        function draw(now) {
          if (!ps) ps = now
          const t = Math.min((now - ps) / duration, 1)
          set(el, { 'stroke-dashoffset': lerp(length, 0, easeInOut(t)) })
          if (t < 1) requestAnimationFrame(draw)
        }
        requestAnimationFrame(draw)
      }, delay)
    }

    // Players appear staggered
    fadeIn(a1, 0);   fadeIn(a2, 110); fadeIn(a3, 220)
    fadeIn(d1, 150); fadeIn(d2, 280)

    // Run arrow draws after players settle
    drawPath(run, 82, 600)

    // Ball swings in on inswing arc
    setTimeout(() => {
      let ps = null
      function moveBall(now) {
        if (!ps) ps = now
        const t = Math.min((now - ps) / 920, 1)
        const e = easeOut(t)
        // Inswing: starts at corner flag (296,188), curves to near post area (218,74)
        const x = lerp(296, 218, e) + Math.sin(t * Math.PI) * -38
        const y = lerp(188, 74, e)
        set(ball, { cx: x, cy: y })
        if (t < 1) { requestAnimationFrame(moveBall) }
        else {
          // CORNER text
          let ps2 = null
          function showTxt(now) {
            if (!ps2) ps2 = now
            const t2 = Math.min((now - ps2) / 360, 1)
            set(txt, { 'font-size': lerp(0, 40, easeOut(t2)), opacity: 1 })
            if (t2 < 1) requestAnimationFrame(showTxt)
            else setTimeout(() => { if (onComplete) onComplete() }, 380)
          }
          requestAnimationFrame(showTxt)
        }
      }
      requestAnimationFrame(moveBall)
    }, 900)
  }, [])

  return (
    <svg ref={svgRef} viewBox="0 0 380 200" fill="none" width="380" height="200">
      {/* Pitch boundary */}
      <line x1="0"   y1="188" x2="380" y2="188" stroke="rgba(69,196,102,0.22)" strokeWidth="1.5"/>
      <line x1="298" y1="0"   x2="298" y2="188" stroke="rgba(69,196,102,0.16)" strokeWidth="1.5"/>
      {/* Penalty area */}
      <rect x="298" y="58" width="82" height="130" stroke="rgba(69,196,102,0.1)" strokeWidth="1" fill="none"/>
      {/* 6-yard box */}
      <rect x="328" y="88" width="52" height="72" stroke="rgba(69,196,102,0.08)" strokeWidth="1" fill="none"/>
      {/* Corner arc */}
      <path d="M298 188 Q318 168 298 148" stroke="rgba(69,196,102,0.14)" strokeWidth="1" fill="none"/>
      {/* Corner flag */}
      <line x1="298" y1="188" x2="298" y2="168" stroke="rgba(237,232,224,0.3)" strokeWidth="2.5"/>
      <path d="M298 168 L311 174 L298 180 Z" fill="rgba(200,16,46,0.65)"/>

      {/* Attackers */}
      <circle id="ck-a1" cx="218" cy="98"  r="8" stroke="#45c466" strokeWidth="1.5" fill="rgba(69,196,102,0.1)"   opacity="0"/>
      <circle id="ck-a2" cx="238" cy="132" r="8" stroke="#45c466" strokeWidth="1.5" fill="rgba(69,196,102,0.1)"   opacity="0"/>
      <circle id="ck-a3" cx="208" cy="150" r="8" stroke="#45c466" strokeWidth="1.5" fill="rgba(69,196,102,0.1)"   opacity="0"/>
      {/* Defenders */}
      <circle id="ck-d1" cx="232" cy="110" r="8" stroke="#9c9080" strokeWidth="1.5" fill="rgba(156,144,128,0.08)" opacity="0"/>
      <circle id="ck-d2" cx="252" cy="140" r="8" stroke="#9c9080" strokeWidth="1.5" fill="rgba(156,144,128,0.08)" opacity="0"/>

      {/* Run arrow — path drawn via stroke-dashoffset technique */}
      <path id="ck-run" d="M218 98 Q214 86 218 74"
        stroke="#45c466" strokeWidth="1.5" fill="none"/>

      {/* Ball — starts at corner flag position */}
      <circle id="ck-ball" cx="296" cy="188" r="10"
        stroke="#e8960e" strokeWidth="2" fill="rgba(232,150,14,0.1)"/>

      {/* CORNER text */}
      <text id="ck-text" x="188" y="172" textAnchor="middle"
        fontFamily="'Bebas Neue', sans-serif" fontSize="0"
        fill="#45c466" letterSpacing="7" opacity="0">
        CORNER
      </text>
    </svg>
  )
}
