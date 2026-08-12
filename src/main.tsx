import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The display face, self-hosted through @fontsource (OFL-1.1) rather than a CDN link: itch builds
// have to work with no network, and Vite fingerprints the woff2 into dist as a normal asset.
//
// Latin only, and two weights: 600 for section straps, 700 for scores and headings. The unscoped
// entrypoints pull cyrillic, greek and vietnamese subsets too -- the browser would never fetch them
// (they are unicode-range gated) but they still ship in the itch zip, and the game generates its
// names from a Latin pool. Body text stays system-ui; see --font-display in index.css.
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
