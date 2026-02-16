import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSupabaseAuth } from '../lib/useSupabaseAuth'
import SignInPage from '../pages/SignInPage'

export default function AuthGate({ children }: { children: ReactNode }) {
  const { session, isLoading } = useSupabaseAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const allowUnauthed =
    location.pathname === '/auth/callback' ||
    location.pathname === '/auth_callback' ||
    location.pathname === '/set-password'

  useEffect(() => {
    const url = new URL(window.location.href)

    const hash = (window.location.hash ?? '').replace(/^#/, '')
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    const code = url.searchParams.get('code')
    const tokenHash = url.searchParams.get('token_hash')
    const token = url.searchParams.get('token')
    const typeParam = url.searchParams.get('type')

    const hasRecoveryHashTokens = Boolean(accessToken && refreshToken)
    const hasRecoveryQueryParams = Boolean(code || ((tokenHash || token) && typeParam))

    if (!hasRecoveryHashTokens && !hasRecoveryQueryParams) return

    if (location.pathname === '/set-password') return

    if (location.pathname === '/auth/callback' || location.pathname === '/auth_callback') return

    {
      navigate(`/auth/callback${url.search}${window.location.hash}`, { replace: true })
    }
  }, [location.pathname, navigate])

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
