import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import './index.css'
import App from './App.jsx'

// Android back button: go back inside the app, close the app from Home
if (Capacitor.isNativePlatform()) {
  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    const atHome = window.location.pathname === '/'

    if (atHome || !canGoBack) {
      CapacitorApp.exitApp()
    } else {
      window.history.back()
    }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)