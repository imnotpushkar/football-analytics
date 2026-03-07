// src/components/PipelineButton.jsx
//
// Triggers the ETL + AI summarization pipeline for a specific competition.
//
// PROPS:
//   competition: string — API code e.g. "PL", "CL", "PD"
//                Sent in the POST body to the backend. Never shown to user.
//   label:       string — human display name e.g. "Premier League"
//                Shown on the button and in the status message.
//                Kept separate from competition so the API contract
//                (which expects codes) is never broken by a display change.
//
// WHY TWO SEPARATE PROPS:
//   The backend expects codes ("PD") not names ("La Liga").
//   The user should see names ("La Liga") not codes ("PD").
//   Mixing these into one value would mean either breaking the API call
//   or showing unfriendly codes in the UI. Two props keeps concerns separate.

import { useState } from 'react'
import apiClient from '../api/client'

export default function PipelineButton({ competition = 'PL', label = 'Premier League' }) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus]   = useState(null)  // null | 'success' | 'error'

  const runPipeline = async () => {
    if (loading) return
    setLoading(true)
    setStatus(null)

    try {
      // Send the API code in the POST body — backend expects "PD" not "La Liga"
      await apiClient.post('/api/pipeline/run', { competition })
      setStatus('success')
      setTimeout(() => setStatus(null), 4000)
    } catch (err) {
      console.error('Pipeline failed:', err)
      setStatus('error')
      setTimeout(() => setStatus(null), 4000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">

      {/* Status messages — auto-clear after 4 seconds */}
      {status === 'success' && (
        <span className="text-fkgreenbright text-sm font-condensed tracking-wider">
          {label} pipeline complete ✓
        </span>
      )}
      {status === 'error' && (
        <span className="text-fkred text-sm font-condensed tracking-wider">
          Pipeline failed ✗
        </span>
      )}

      <button
        onClick={runPipeline}
        disabled={loading}
        className={`
          px-5 py-2 text-xs font-condensed font-bold tracking-widest uppercase
          transition-all duration-200
          ${loading
            ? 'bg-surface3 text-textmuted cursor-not-allowed'
            : 'bg-fkgreen text-white hover:bg-fkgreenmid cursor-pointer'
          }
        `}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-textmuted border-t-transparent rounded-full animate-spin" />
            Running...
          </span>
        ) : (
          `▶ Run ${label}`
        )}
      </button>

    </div>
  )
}
