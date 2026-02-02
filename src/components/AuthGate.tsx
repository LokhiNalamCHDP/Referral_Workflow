import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useSupabaseAuth } from '../lib/useSupabaseAuth'
import SignInPage from '../pages/SignInPage'

export default function AuthGate({ children }: { children: ReactNode }) {
  const { session, isLoading } = useSupabaseAuth()
  const location = useLocation()

  const allowUnauthed = location.pathname === '/auth/callback'

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-[520px] px-4 py-10 text-sm text-slate-700">
          Loading…
        </div>
      </div>
    )
  }

  if (!session) {
    if (allowUnauthed) return <>{children}</>
    return <SignInPage />
  }

  return <>{children}</>
}
