import { Link } from 'react-router-dom'

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function MatchCard({ match }) {
  const homeTeam  = match.home_team  || 'Home'
  const awayTeam  = match.away_team  || 'Away'
  const homeScore = match.home_score ?? '-'
  const awayScore = match.away_score ?? '-'
  const competition = match.competition || ''
  const matchday  = match.matchday ? `MD ${match.matchday}` : ''
  const date      = formatDate(match.date)
  const hasSummary = match.has_summary

  return (
    <Link to={`/matches/${match.id}`} className="block group">
      <div className="
        bg-surface border border-bdr p-6
        hover:bg-surface2 transition-colors duration-150
        relative overflow-hidden
      ">
        {/* Green top accent on hover */}
        <div className="
          absolute top-0 left-0 right-0 h-0.5
          bg-fkgreenbrightscale-x-0 group-hover:scale-x-100
          transition-transform duration-200 origin-left
        " />

        {/* Competition + date */}
        <div className="flex items-center justify-between mb-4">
          <span className="font-condensed text-xs font-bold tracking-widest uppercase text-fkgreenbright">
            {competition}
          </span>
          <span className="font-condensed text-xs text-textmuted">{date}</span>
        </div>

        {/* Score row */}
        <div className="grid grid-cols-3 items-center gap-3 mb-4">
          <div className="text-right">
            <span className="font-condensed text-sm font-semibold text-textprimary leading-tight">
              {homeTeam}
            </span>
          </div>

          <div className="flex items-center justify-center gap-1">
            <span className="font-display text-5xl text-textprimary leading-none">
              {homeScore}
            </span>
            <span className="font-display text-2xl text-bdrlt mx-1">–</span>
            <span className="font-display text-5xl text-textprimary leading-none">
              {awayScore}
            </span>
          </div>

          <div className="text-left">
            <span className="font-condensed text-sm font-semibold text-textprimary leading-tight">
              {awayTeam}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-bdr">
          <span className="font-condensed text-xs text-textmuted tracking-wider uppercase">
            {matchday}
          </span>
          {hasSummary ? (
            <span className="font-condensed text-xs font-bold tracking-widest uppercase text-fkgreenbrightflex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-fkgreenbrightinline-block" />
              Analysis Ready
            </span>
          ) : (
            <span className="font-condensed text-xs text-textmuted tracking-wider uppercase">
              No Analysis Yet
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

export default MatchCard