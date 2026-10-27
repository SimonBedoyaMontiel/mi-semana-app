import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/app.css'
import { App } from './App'
import { paintCached } from './lib/appearance'

document.documentElement.dataset.platform = window.api.platform
paintCached()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
