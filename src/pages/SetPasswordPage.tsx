import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import { supabase } from '../lib/supabaseClient'
import { useSupabaseAuth } from '../lib/useSupabaseAuth'

export default function SetPasswordPage() {
  const { session, isLoading } = useSupabaseAuth()
  const navigate = useNavigate()

  const email = useMemo(() => session?.user?.email ?? '', [session?.user?.email])

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function onSubmit() {
    setError(null)
    setSuccess(null)

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError(error.message)
        return
      }
      setSuccess('Password updated successfully. Redirecting…')
      window.setTimeout(() => {
        navigate('/', { replace: true })
      }, 800)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader title="ReferralTracker" subtitle="Set password" />

      <main className="mx-auto flex max-w-[520px] flex-col gap-4 px-4 py-10">
        <div className="rounded-lg border bg-white p-5">
          <div className="text-sm font-semibold text-slate-900">Set your password</div>
          <div className="mt-1 text-xs text-slate-600">
            {email ? `Signed in as ${email}.` : 'Signed in.'}
          </div>

          {!session ? (
            <div className="mt-4 text-sm text-slate-700">You need to be signed in to set a password.</div>
          ) : (
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-700">New password</span>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-700">Confirm password</span>
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                />
              </label>

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  {success}
                </div>
              ) : null}

              <button
                type="button"
                onClick={onSubmit}
                disabled={!session || isSubmitting || isLoading}
                className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Saving…' : 'Set password'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
