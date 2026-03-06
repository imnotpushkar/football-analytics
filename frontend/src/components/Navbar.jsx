import { Link } from 'react-router-dom'
import PipelineButton from './PipelineButton'

function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-surface border-b border-bdr">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

        <Link to="/" className="flex items-center gap-3">
          <div>
            <span className="font-display text-2xl text-textprimary tracking-wider">
              FREEKICK
            </span>
            <span className="block text-xs text-fkgreenbright-mt-1 tracking-widest uppercase font-condensed">
              Match Intelligence
            </span>
          </div>
        </Link>

        <PipelineButton />
      </div>
    </nav>
  )
}

export default Navbar