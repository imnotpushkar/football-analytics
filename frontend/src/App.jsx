// src/App.jsx
//
// This is the ROOT component of the entire React app.
// Every React app has one root component that wraps everything else.
//
// REACT ROUTER CONCEPTS:
// BrowserRouter — wraps the app, enables client-side routing.
//   "Client-side" means page changes happen in JavaScript without
//   a real browser navigation request. The URL changes but the
//   page does NOT reload — React just swaps which component renders.
//
// Routes — container that looks at the current URL and renders
//   the first Route whose path matches.
//
// Route — maps a URL path to a component.
//   path="/"            → renders MatchesPage
//   path="/matches/:id" → renders MatchDetailPage
//   :id is a URL parameter — a dynamic segment. If the URL is
//   /matches/123, then :id = "123". The component reads it
//   with the useParams() hook.
//
// Link / Navigate — React Router's way to change URLs without
//   a full page reload. We use these in child components.

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MatchesPage from './pages/MatchesPage'
import MatchDetailPage from './pages/MatchDetailPage'
import Navbar from './components/Navbar'
import Ticker from './components/Ticker'

function App() {
  return (
    <BrowserRouter>
      <Navbar />

      {/* Content pushed down by navbar (64px = pt-16) */}
      <div className="pt-16 min-h-screen bg-bg flex flex-col">
        <Ticker />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<MatchesPage />} />
            <Route path="/matches/:id" element={<MatchDetailPage />} />
          </Routes>
        </main>
      </div>

    </BrowserRouter>
  )
}

export default App
