import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import apiClient from '../api/client'
import SummaryPanel from '../components/SummaryPanel'
import EventsTimeline from '../components/EventsTimeline'

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function MatchDetailPage() {
  const { id } = useParams()
  const [match,   setMatch]   = useState(null)
  const [summary, setSummary] = useState(null)
  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    const fetchMatchData = async () => {
      try {
        const [matchRes, summaryRes, eventsRes] = await Promise.all([
          apiClient.get(`/api/matches/${id}`),
          apiClient.get(`/api/matches/${id}/summary`).catch(() => ({ data: {} })),
          apiClient.get(`/api/matches/${id}/events`).catch(() => ({ data: { events: [] } })),
        ])
        setMatch(matchRes.data)
        setSummary(summaryRes.data.content || null)
        setEvents(eventsRes.data.events || [])
      } catch (err) {
        console.error('Failed to load match:', err)
        setError('Could not load match data.')
      } finally {
        setLoading(false)
      }
    }
    fetchMatchData()
  }, [id])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12 flex items-center gap-3 text-textmuted">
        <span className="w-4 h-4 border-2 border-textmuted border-t-transparent rounded-full animate-spin inline-block" />
        <span className="font-condensed tracking-widest uppercase text-xs">Loading match...</span>
      </div>
    )
  }

  if (error || !match) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="border border-red/30 bg-fkred/5 p-6">
          <p className="text-fkred font-condensed">{error || 'Match not found.'}</p>
          <Link to="/" className="text-fkgreenbrighttext-sm mt-2 block font-condensed hover:underline">
            ← Back to all matches
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      <Link to="/" className="font-condensed text-xs text-textmuted hover:text-fkgreenbrighttransition-colors tracking-widest uppercase mb-6 block">
        ← All Matches
      </Link>

      {/* Hero scoreboard */}
      <div className="bg-surface border border-bdr relative overflow-hidden mb-0">
        {/* Gradient accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1"
          style={{ background: 'linear-gradient(90deg, #1a5c35 0%, #2da050 40%, #e8960e 70%, #c8102e 100%)' }}
        />

        <div className="p-8 pt-9">
          {/* Competition + date */}
          <div className="flex items-center justify-between mb-6">
            <span className="font-condensed text-xs font-bold tracking-widest uppercase text-fkgreenbright">
              {match.competition}
              {match.matchday && (
                <span className="text-textmuted"> · MD {match.matchday}</span>
              )}
            </span>
            <span className="font-condensed text-xs text-textmuted">
              {formatDate(match.date)}
            </span>
          </div>

          {/* Score */}
          <div className="grid items-center gap-8" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
            <div className="text-right">
              <p className="font-condensed text-2xl font-bold text-textprimary leading-tight">
                {match.home_team}
              </p>
              <p className="font-condensed text-xs text-textmuted tracking-widest uppercase mt-1">Home</p>
            </div>

            <div className="text-center">
              <div className="flex items-center gap-2">
                <span className="font-display text-8xl text-textprimary leading-none">
                  {match.home_score ?? '-'}
                </span>
                <span className="font-display text-5xl text-bdrlt">–</span>
                <span className="font-display text-8xl text-textprimary leading-none">
                  {match.away_score ?? '-'}
                </span>
              </div>
              <p className="font-condensed text-xs text-textmuted tracking-widest uppercase mt-1">
                Full Time
              </p>
            </div>

            <div className="text-left">
              <p className="font-condensed text-2xl font-bold text-textprimary leading-tight">
                {match.away_team}
              </p>
              <p className="font-condensed text-xs text-textmuted tracking-widest uppercase mt-1">Away</p>
            </div>
          </div>
        </div>
      </div>

      {/* Two column layout — events narrow, analysis wide */}
      <div className="grid gap-0 mt-6" style={{ gridTemplateColumns: '300px 1fr' }}>
        <EventsTimeline events={events} />
        <div className="border-l border-bdr">
          <SummaryPanel summary={summary} showHeadline={true} />
        </div>
      </div>

    </div>
  )
}

export default MatchDetailPage