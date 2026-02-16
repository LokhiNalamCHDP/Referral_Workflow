import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import { supabase } from '../lib/supabaseClient'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  function userFriendlyAuthError(message: string) {
    const m = (message ?? '').toLowerCase()
    if (m.includes('expired') || m.includes('invalid') || m.includes('token')) {
      return 'This link is invalid or has expired. Please request a new password reset email.'
    }
    return message
  }

  useEffect(() => {
    let isMounted = true

    void (async () => {
      try {
        const url = new URL(window.location.href)

        const hash = (url.hash ?? '').replace(/^#/, '')
        const hashParams = new URLSearchParams(hash)
        const linkTypeFromHash = hashParams.get('type')
        const linkTypeFromQuery = url.searchParams.get('type')
        const linkType = linkTypeFromHash || linkTypeFromQuery || ''

        const code = url.searchParams.get('code')
        const accessTokenFromHash = hashParams.get('access_token')
        const refreshTokenFromHash = hashParams.get('refresh_token')
        const isRecoveryLink =
          linkType === 'recovery' ||
          (url.pathname === '/auth_callback' && Boolean(accessTokenFromHash && refreshTokenFromHash))

        if (import.meta.env.DEV) {
          console.log('AuthCallbackPage: url', {
            pathname: url.pathname,
            search: url.search,
            hash: url.hash,
          })
          console.log('AuthCallbackPage: params', {
            linkTypeFromHash,
            linkTypeFromQuery,
            linkType,
            isRecoveryLink,
            hasCode: Boolean(code),
            hasAccessTokenHash: Boolean(accessTokenFromHash),
            hasRefreshTokenHash: Boolean(refreshTokenFromHash),
          })
        }

        const tokenHash = url.searchParams.get('token_hash')
        const token = url.searchParams.get('token')
        const typeParam = url.searchParams.get('type')

        const existingSessionRes = await supabase.auth.getSession()
        if (!isMounted) return
        if (existingSessionRes.data.session && isRecoveryLink) {
          navigate('/set-password', { replace: true })
          return
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)
          if (!isMounted) return
          if (error) {
            setError(userFriendlyAuthError(error.message))
            return
          }
        } else if ((tokenHash || token) && typeParam) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash ?? token ?? '',
            type: typeParam as any,
          })

          if (!isMounted) return

          if (error) {
            setError(userFriendlyAuthError(error.message))
            return
          }

          if (data?.session) {
            const { error: setErrorRes } = await supabase.auth.setSession({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            })
            if (!isMounted) return
            if (setErrorRes) {
              setError(userFriendlyAuthError(setErrorRes.message))
              return
            }
          }
        } else {
          const accessToken = accessTokenFromHash
          const refreshToken = refreshTokenFromHash

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })

            if (!isMounted) return

            if (error) {
              setError(userFriendlyAuthError(error.message))
              return
            }
          }
        }

        const { data: finalSessionData } = await supabase.auth.getSession()
        if (!isMounted) return

        if (finalSessionData.session && isRecoveryLink) {
          navigate('/set-password', { replace: true })
          return
        }

        if (finalSessionData.session) {
          navigate('/', { replace: true })
          return
        }

        setError('This link is invalid or has expired. Please request a new password reset email.')
      } catch (e) {
        if (!isMounted) return
        setError(e instanceof Error ? e.message : 'Auth callback failed')
      }
    })()

    return () => {
      isMounted = false
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader title="ReferralTracker" subtitle="Signing you in" />
      <main className="mx-auto max-w-[520px] px-4 py-10">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        ) : (
          <div className="text-sm text-slate-700">Completing sign-in…</div>
        )}
      </main>
    </div>
  )
}
