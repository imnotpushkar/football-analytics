// src/App.jsx
//
// ROOT component — wraps the entire React app.
//
// Competition state lives here and is passed down to both Navbar and
// MatchesPage. This is "lifting state up" — the closest common ancestor
// of two components that share data owns that data.
//
// Navbar reads activeCompetition to highlight the active tab, and calls
// onCompetitionChange when the user clicks a different competition.
// MatchesPage reads activeCompetition to know which matches to fetch.

import { useState }         from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar          from './components/Navbar'
import Ticker          from './components/Ticker'
import MatchesPage     from './pages/MatchesPage'
import MatchDetailPage from './pages/MatchDetailPage'

// Single source of truth for all competitions.
// Navbar renders these as buttons. MatchesPage uses the active one for API calls.
// Adding a new competition = one new object here, nothing else.
export const COMPETITIONS = [
  { code: 'PL',  label: 'Premier League'   },
  { code: 'CL',  label: 'Champions League' },
  { code: 'PD',  label: 'La Liga'          },
  { code: 'BL1', label: 'Bundesliga'       },
  { code: 'SA',  label: 'Serie A'          },
]

function App() {
  const [activeCompetition, setActiveCompetition] = useState(COMPETITIONS[0])

  return (
    <BrowserRouter>
      {/*
        Navbar receives:
          competitions       — full list to render buttons
          activeCompetition  — which one is currently highlighted
          onCompetitionChange — callback to update state when user clicks
      */}
      <Navbar
        competitions={COMPETITIONS}
        activeCompetition={activeCompetition}
        onCompetitionChange={setActiveCompetition}
      />

      <div className="pt-16 min-h-screen bg-fk-bg flex flex-col">
        <Ticker />
        <main className="flex-1">
          <Routes>
            <Route
              path="/"
              element={<MatchesPage competition={activeCompetition} />}
            />
            <Route path="/matches/:id" element={<MatchDetailPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
