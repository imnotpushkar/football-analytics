// src/components/PipelineButton.jsx
//
// Triggers the ETL + AI summarization pipeline for a specific competition
// and shows live progress while it runs.
//
// POLLING PATTERN:
//   After clicking Run, we POST to /api/pipeline/run which returns
//   { "status": "started" } immediately — the pipeline runs in a background
//   thread on the server. We then poll GET /api/pipeline/status every
//   1.5 seconds to get the current state and display it.
//
//   Polling is implemented with setInterval inside a useEffect.
//   The interval is stored in a useRef so we can clear it from anywhere
//   in the component (when complete, on error, on unmount).
//
//   WHY useRef FOR THE INTERVAL:
//     setInterval returns a numeric ID. We need to call clearInterval(id)
//     to stop it. If we stored the ID in useState, updating it would
//     trigger a re-render every time — wasteful and unnecessary.
//     useRef stores the ID as a mutable value that persists across renders
//     without causing re-renders. This is the correct pattern for any
//     value that "needs to be remembered but doesn't affect the UI directly."
//
//   WHY 1.5 SECONDS:
//     Fast enough to feel responsive. Slow enough not to flood the server.
//     Each status request is a simple dict read — essentially free.
//
// STATES:
//   idle        — button shows "▶ Run {label}"
//   running     — spinner + "match X/Y: Team A vs Team B"
//   up_to_date  — green message "Fetching matchups... seems up-to-date"
//   complete    — green message "{N} matches analysed" (auto-clears 5s)
//   error       — red message "Pipeline failed" (auto-clears 5s)

import { useState, useEffect, useRef } from 'react'
import apiClient from '../api/client'

export default function PipelineButton({ competition = 'PL', label = 'Premier League' }) {
  const [uiState, setUiState]   = useState('idle')   // idle | running | complete | up_to_date | error
  const [progress, setProgress] = useState(null)     // progress object from status endpoint
  const intervalRef             = useRef(null)       // holds the setInterval ID

  // Stop polling — clears the interval and resets the ref
  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  // Start polling the status endpoint
  function startPolling() {
    stopPolling() // clear any existing interval first

    intervalRef.current = setInterval(async () => {
      try {
        const res = await apiClient.get('/api/pipeline/status')
        const data = res.data
        setProgress(data)

        if (data.state === 'complete') {
          stopPolling()
          setUiState('complete')
          setTimeout(() => { setUiState('idle'); setProgress(null) }, 5000)
        } else if (data.state === 'up_to_date') {
          stopPolling()
          setUiState('up_to_date')
          setTimeout(() => { setUiState('idle'); setProgress(null) }, 4000)
        } else if (data.state === 'error') {
          stopPolling()
          setUiState('error')
          setTimeout(() => { setUiState('idle'); setProgress(null) }, 5000)
        }
        // state === 'running' → keep polling
      } catch (err) {
        console.error('Status poll failed:', err)
        stopPolling()
        setUiState('error')
        setTimeout(() => setUiState('idle'), 5000)
      }
    }, 1500)
  }

  // Cleanup on unmount — stop interval if component disappears while running.
  // Without this, the interval keeps firing after the component is gone,
  // causing "setState on unmounted component" warnings in the console.
  useEffect(() => {
    return () => stopPolling()
  }, [])

  const handleRun = async () => {
    if (uiState === 'running') return

    setUiState('running')
    setProgress({ state: 'running', current: 'Starting...', index: 0, total: 0 })

    try {
      await apiClient.post('/api/pipeline/run', { competition })
      startPolling()
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to start pipeline'
      console.error('Pipeline start failed:', err)
      setUiState('error')
      setProgress({ state: 'error', error: msg })
      setTimeout(() => { setUiState('idle'); setProgress(null) }, 5000)
    }
  }

  // ── Status line rendered below button while not idle ─────────────────────

  function renderStatusLine() {
    if (!progress) return null

    if (uiState === 'running') {
      const { current, index, total } = progress
      const matchLabel = index > 0 && total > 0
        ? `[${index}/${total}] ${current}`
        : current || 'Fetching match list...'
      return (
        <span className="font-condensed text-xs text-fk-textsecondary tracking-wide">
          {matchLabel}
        </span>
      )
    }

    if (uiState === 'up_to_date') {
      return (
        <span className="font-condensed text-xs text-fk-greenbright tracking-wide">
          {progress.current || 'Fetching matchups... seems up-to-date'}
        </span>
      )
    }

    if (uiState === 'complete') {
      const ok     = progress.ok     ?? 0
      const failed = progress.failed ?? 0
      return (
        <span className="font-condensed text-xs text-fk-greenbright tracking-wide">
          ✓ {ok} match{ok !== 1 ? 'es' : ''} analysed
          {failed > 0 && ` · ${failed} failed`}
        </span>
      )
    }

    if (uiState === 'error') {
      return (
        <span className="font-condensed text-xs text-fk-red tracking-wide">
          ✗ {progress.error || 'Pipeline failed'}
        </span>
      )
    }

    return null
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const isRunning = uiState === 'running'

  return (
    <div className="flex flex-col items-end gap-1">

      <button
        onClick={handleRun}
        disabled={isRunning}
        className={[
          'px-5 py-2 text-xs font-condensed font-bold tracking-widest uppercase',
          'transition-all duration-200',
          isRunning
            ? 'bg-fk-surface3 text-fk-textmuted cursor-not-allowed'
            : 'bg-fk-green text-white hover:bg-fk-greenmid cursor-pointer',
        ].join(' ')}
      >
        {isRunning ? (
          <span className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-fk-textmuted border-t-transparent rounded-full animate-spin" />
            Running...
          </span>
        ) : (
          `▶ Run ${label}`
        )}
      </button>

      {uiState !== 'idle' && (
        <div className="max-w-xs text-right">
          {renderStatusLine()}
        </div>
      )}

    </div>
  )
}
