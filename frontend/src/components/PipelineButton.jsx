import { useState } from 'react'
import apiClient from '../api/client'

function PipelineButton() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)

  const runPipeline = async () => {
    if (loading) return
    setLoading(true)
    setStatus(null)
    try {
      await apiClient.post('/api/pipeline/run')
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
      {status === 'success' && (
        <span className="text-fkgreenbrighttext-sm font-condensed tracking-wider">Pipeline complete ✓</span>
      )}
      {status === 'error' && (
        <span className="text-fkred text-sm font-condensed tracking-wider">Pipeline failed ✗</span>
      )}

      <button
        onClick={runPipeline}
        disabled={loading}
        className={`
          px-5 py-2 text-xs font-condensed font-bold tracking-widest uppercase
          transition-all duration-200
          ${loading
            ? 'bg-surface3 text-textmuted cursor-not-allowed'
            : 'bg-fkgreentext-white hover:bg-fkgreenmidcursor-pointer'
          }
        `}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-textmuted border-t-transparent rounded-full animate-spin" />
            Running...
          </span>
        ) : (
          '▶ Run Pipeline'
        )}
      </button>
    </div>
  )
}

export default PipelineButton