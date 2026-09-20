import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

/* Tag the view before the first paint. A Chrome popup sizes itself to its
   content, and this page declared no size at all — so the popup was whatever
   height the content happened to settle at, which is what cut the bottom off
   buttons and clipped the footer. index.css gives the popup fixed dimensions
   and lets the side panel and the expanded tab fill their container instead. */
document.documentElement.dataset.view =
  new URLSearchParams(window.location.search).get('view') || 'popup'

import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
)
