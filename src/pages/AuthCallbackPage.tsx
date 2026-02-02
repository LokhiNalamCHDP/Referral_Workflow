import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import { supabase } from '../lib/supabaseClient'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    void (async () => {
      try {
        const url = new URL(window.location.href)

        const code = url.searchParams.get('code')
        const tokenHash = url.searchParams.get('token_hash')
        const token = url.searchParams.get('token')
        const typeParam = url.searchParams.get('type')

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)
          if (!isMounted) return
          if (error) {
            setError(error.message)
            return
          }
        } else if ((tokenHash || token) && typeParam) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash ?? token ?? '',
            type: typeParam as any,
          })

          if (!isMounted) return

          if (error) {
            setError(error.message)
            return
          }

          if (data?.session) {
            const { error: setErrorRes } = await supabase.auth.setSession({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            })
            if (!isMounted) return
            if (setErrorRes) {
              setError(setErrorRes.message)
              return
            }
          }
        } else {
          const hash = (url.hash ?? '').replace(/^#/, '')
          const hashParams = new URLSearchParams(hash)
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')

          if (!accessToken || !refreshToken) {
            setError(
              'No auth code or recovery tokens found in callback URL. Make sure your Supabase redirect URL points to /auth/callback.'
            )
            return
          }

          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (!isMounted) return

          if (error) {
            setError(error.message)
            return
          }
        }

        if (!isMounted) return
        navigate('/set-password', { replace: true })
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
