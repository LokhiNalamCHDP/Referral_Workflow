import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import AuthGate from './components/AuthGate'
import { SupabaseAuthProvider } from './lib/useSupabaseAuth'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SupabaseAuthProvider>
      <BrowserRouter>
        <AuthGate>
          <App />
        </AuthGate>
      </BrowserRouter>
    </SupabaseAuthProvider>
  </React.StrictMode>,
)
