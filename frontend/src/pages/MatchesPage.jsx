import { useState, useEffect } from 'react'
import MatchCard from '../components/MatchCard'
import apiClient from '../api/client'

function MatchesPage() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const response = await apiClient.get('/api/matches?limit=50')
        setMatches(response.data)
      } catch (err) {
        console.error('Failed to fetch matches:', err)
        setError('Could not load matches. Is the Flask API running?')
      } finally {
        setLoading(false)
      }
    }
    fetchMatches()
  }, [])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12 flex items-center gap-3 text-textmuted">
        <span className="w-4 h-4 border-2 border-textmuted border-t-transparent rounded-full animate-spin inline-block" />
        <span className="font-condensed tracking-widest uppercase text-xs">Loading matches...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="border border-red/30 bg-fkred/5 p-6">
          <p className="text-fkred font-condensed tracking-wide">{error}</p>
          <p className="text-textmuted text-sm mt-2 font-condensed">
            Make sure Flask is running: <code className="text-fkgreenbright">python -m backend.api.app</code>
          </p>
        </div>
      </div>
    )
  }

  const byCompetition = matches.reduce((acc, match) => {
    const comp = match.competition || 'Other'
    if (!acc[comp]) acc[comp] = []
    acc[comp].push(match)
    return acc
  }, {})

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-display text-5xl text-textprimary tracking-wider">
          MATCH ANALYSIS
        </h1>
        <p className="font-condensed text-xs text-textmuted tracking-widest uppercase mt-1">
          {matches.length} matches · click any match to read the full analysis
        </p>
      </div>

      {matches.length === 0 ? (
        <div className="bg-surface border border-bdr p-8 text-center">
          <p className="text-textmuted font-condensed tracking-wide">
            No matches found. Run the pipeline to fetch data.
          </p>
        </div>
      ) : (
        Object.entries(byCompetition).map(([competition, compMatches]) => (
          <div key={competition} className="mb-10">

            {/* Competition header — V3C section header style */}
            <div className="bg-surface3 border-l-4 border-fkgreen border-b border-bdr px-6 py-2.5 flex items-center gap-4 mb-0">
              <span className="font-condensed text-xs font-bold tracking-widest uppercase text-textprimary">
                {competition}
              </span>
              <div className="flex-1 h-px bg-border" />
              <span className="font-condensed text-xs text-fkgreenbrighttracking-wider">
                {compMatches.length} matches
              </span>
            </div>

            {/* Cards grid — flush borders like the prototype */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-l border-t border-bdr">
              {compMatches.map(match => (
                <div key={match.id} className="border-r border-b border-bdr">
                  <MatchCard match={match} />
                </div>
              ))}
            </div>

          </div>
        ))
      )}
    </div>
  )
}

export default MatchesPage