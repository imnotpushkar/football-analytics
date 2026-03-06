function SummaryPanel({ summary, showHeadline = false }) {
  if (!summary) {
    return (
      <div className="bg-surface border border-bdr">
        <div className="bg-surface3 border-l-4 border-fkgreen px-6 py-3">
          <h3 className="font-condensed text-xs font-bold tracking-widest uppercase text-textsecondary">
            Match Analysis
          </h3>
        </div>
        <p className="text-textmuted text-sm p-6 font-condensed tracking-wide">
          No analysis available for this match.
        </p>
      </div>
    )
  }

  const trimmed = summary.trim()
  const rawSections = trimmed.split(/\n?## /).map(s => s.trim()).filter(Boolean)
  const sections = rawSections
    .map(section => {
      const newlineIndex = section.indexOf('\n')
      if (newlineIndex === -1) return { title: section.trim(), body: '' }
      return {
        title: section.slice(0, newlineIndex).trim(),
        body:  section.slice(newlineIndex + 1).trim(),
      }
    })
    .filter(s => s.title.length >= 3)

  // Extract first sentence of story section as editorial headline
  const storySection = sections.find(s =>
    s.title.includes('STORY') || s.title.includes('Story')
  )
  const headline = storySection
    ? storySection.body.split('.')[0].trim() + '.'
    : null

  const eyebrows = {
    'THE STORY OF THE MATCH':          'The Story of the Match',
    'TACTICAL BREAKDOWN':              'Tactical Breakdown',
    'PLAYERS WHO MADE THE DIFFERENCE': 'Players Who Made the Difference',
    'THE VERDICT':                     'The Verdict',
  }

  function getEyebrow(title) {
    if (eyebrows[title]) return eyebrows[title]
    if (title.includes('STORY'))    return 'The Story of the Match'
    if (title.includes('TACTICAL')) return 'Tactical Breakdown'
    if (title.includes('PLAYER'))   return 'Players Who Made the Difference'
    if (title.includes('VERDICT'))  return 'The Verdict'
    return title
  }

  const isVerdict = (title) => title.includes('VERDICT')

  return (
    <div className="bg-surface border border-bdr">
      <div className="bg-surface3 border-l-4 border-fkgreen px-6 py-3">
        <h3 className="font-condensed text-xs font-bold tracking-widest uppercase text-textsecondary">
          Match Analysis
        </h3>
      </div>

      {/* Editorial headline — Playfair Display, sits at top of analysis */}
      {showHeadline && headline && (
        <div className="px-8 pt-8 pb-4 border-b border-bdr">
          <p className="font-condensed text-xs font-bold tracking-widest uppercase text-fkgreenbright mb-3">
            The Story of the Match
          </p>
          <h2
            style={{ fontFamily: "'Playfair Display', serif" }}
            className="text-2xl font-bold text-textprimary leading-snug"
          >
            {headline}
          </h2>
        </div>
      )}

      <div className="p-8 space-y-8">
        {sections.map((section, index) => (
          isVerdict(section.title) ? (
            <div key={index} className="bg-surface3 border-l-4 border-fkgreen p-6">
              <p className="font-condensed text-xs font-bold tracking-widest uppercase text-fkgreenbright mb-3">
                The Verdict
              </p>
              <p className="text-sm leading-relaxed text-textsecondary font-light whitespace-pre-line">
                {section.body}
              </p>
            </div>
          ) : (
            <div key={index}>
              <div className="flex items-center gap-3 mb-3">
                <span className="font-condensed text-xs font-bold tracking-widest uppercase text-fkgreenbright whitespace-nowrap">
                  {getEyebrow(section.title)}
                </span>
                <div className="flex-1 h-px bg-bdr" />
              </div>
              <div className="text-sm leading-relaxed text-textsecondary font-light whitespace-pre-line">
                {section.body}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  )
}

export default SummaryPanel