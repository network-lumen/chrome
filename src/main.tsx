import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

/* Tag the view before the first paint. A Chrome popup sizes itself to its
   content, and this page declared no size at all — so the popup was whatever
   height the content happened to settle at, which is what cut the bottom off
   buttons and clipped the footer. index.css gives the popup fixed dimensions
   and lets the side panel and the expanded tab fill their container instead.

   Every surface names itself, and anything unmarked falls back to filling its
   container rather than to the popup. Defaulting to 'popup' meant any URL
   without the marker — this page opened by hand in a tab, or the side panel if
   Chrome drops the query string from default_path — was forced to 400x600
   inside a full-size window, leaving a narrow clipped column. Guessing wrong
   towards "fill" only costs a stretched popup; guessing wrong towards "popup"
   truncates the UI. */
const declaredView = new URLSearchParams(window.location.search).get('view')
document.documentElement.dataset.view =
  declaredView === 'popup' ? 'popup' : (declaredView || 'unknown')

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
