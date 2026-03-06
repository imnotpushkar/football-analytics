function EventIcon({ eventType, detailType }) {
  if (eventType === 'goal') {
    if (detailType === 'penalty')  return <span>⚽ P</span>
    if (detailType === 'own_goal') return <span>⚽ OG</span>
    return <span>⚽</span>
  }
  if (eventType === 'card') {
    if (detailType === 'yellow')    return <span>🟨</span>
    if (detailType === 'yellowRed') return <span>🟨🟥</span>
    if (detailType === 'red')       return <span>🟥</span>
    return <span>🃏</span>
  }
  if (eventType === 'substitution') return <span>🔄</span>
  return <span>·</span>
}

function eventLabel(eventType, detailType) {
  if (eventType === 'goal') {
    if (detailType === 'penalty')  return 'Penalty'
    if (detailType === 'own_goal') return 'Own Goal'
    return 'Goal'
  }
  if (eventType === 'card') {
    if (detailType === 'yellow')    return 'Yellow Card'
    if (detailType === 'yellowRed') return '2nd Yellow / Red'
    if (detailType === 'red')       return 'Red Card'
    return 'Card'
  }
  if (eventType === 'substitution') return 'Substitution'
  return eventType
}

function minuteColor(eventType, detailType) {
  if (eventType === 'goal') return 'text-fkgreenbright'
  if (eventType === 'card') {
    if (detailType === 'red' || detailType === 'yellowRed') return 'text-fkred'
    return 'text-fkamberbright'
  }
  return 'text-textmuted'
}

function labelColor(eventType, detailType) {
  if (eventType === 'goal') return 'text-fkgreenbright'
  if (eventType === 'card') {
    if (detailType === 'red' || detailType === 'yellowRed') return 'text-fkred'
    return 'text-fkamberbright'
  }
  return 'text-textmuted'
}

function EventsTimeline({ events }) {
  if (!events || events.length === 0) {
    return (
      <div className="bg-surface border border-bdr">
        <div className="bg-fkgreenpx-6 py-3">
          <h3 className="font-condensed text-xs font-bold tracking-widest uppercase text-white/85">
            Match Events
          </h3>
        </div>
        <p className="text-textmuted text-sm p-6 font-condensed tracking-wide">
          No events recorded.
        </p>
      </div>
    )
  }

  const sorted = [...events].sort((a, b) => (a.minute || 0) - (b.minute || 0))

  return (
    <div className="bg-surface border border-bdr">
      {/* Column header — green like prototype */}
      <div className="bg-fkgreenpx-6 py-3">
        <h3 className="font-condensed text-xs font-bold tracking-widest uppercase text-white/85">
          Match Events
        </h3>
      </div>

      <div>
        {sorted.map((event, index) => (
          <div
            key={index}
            className="grid border-b border-bdr last:border-b-0 hover:bg-surface2 transition-colors duration-100"
            style={{ gridTemplateColumns: '44px 22px 1fr', gap: '8px', padding: '12px 20px', alignItems: 'start' }}
          >
            {/* Minute */}
            <span className={`font-display text-xl text-right leading-tight ${minuteColor(event.type, event.detail)}`}>
              {event.minute}'
            </span>

            {/* Icon */}
            <span className="text-sm pt-0.5">
              <EventIcon eventType={event.type} detailType={event.detail} />
            </span>

            {/* Details */}
            <div>
              <p className={`font-condensed text-xs font-bold tracking-widest uppercase leading-none ${labelColor(event.type, event.detail)}`}>
                {eventLabel(event.type, event.detail)}
              </p>
              <p className="font-condensed text-sm font-semibold text-textprimary leading-tight mt-0.5">
                {event.player || 'Unknown'}
              </p>
              {event.type === 'goal' && event.secondary_player && (
                <p className="text-xs text-textmuted italic mt-0.5">
                  Assist: {event.secondary_player}
                </p>
              )}
              {event.type === 'substitution' && event.secondary_player && (
                <p className="text-xs text-textmuted italic mt-0.5">
                  On: {event.secondary_player}
                </p>
              )}
              {event.type === 'card' && event.reason && (
                <p className="text-xs text-textmuted italic mt-0.5">
                  {event.reason}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default EventsTimeline