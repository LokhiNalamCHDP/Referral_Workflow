import { useState } from 'react'
import AppHeader from '../components/AppHeader'
import { supabase } from '../lib/supabaseClient'
import { useSupabaseAuth } from '../lib/useSupabaseAuth'

export default function SignInPage() {
  const { signInWithPassword, isLoading } = useSupabaseAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mode, setMode] = useState<'sign_in' | 'forgot'>('sign_in')

  async function onSubmit() {
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)
    try {
      if (mode === 'forgot') {
        const trimmed = email.trim()
        if (!trimmed) {
          setError('Email is required')
          return
        }
        const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
          redirectTo: 'http://localhost:5173/auth/callback',
        })
        if (error) {
          setError(error.message)
          return
        }
        setSuccess('Password reset email sent. Check your inbox.')
        return
      }

      const res = await signInWithPassword(email.trim(), password)
      if (res.error) setError(res.error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader title="ReferralTracker" subtitle="Sign in" />

      <main className="mx-auto flex max-w-[520px] flex-col gap-4 px-4 py-10">
        <div className="rounded-lg border bg-white p-5">
          <div className="text-sm font-semibold text-slate-900">Sign in</div>
          <div className="mt-1 text-xs text-slate-600">
            {mode === 'forgot' ? 'Enter your email to reset your password.' : 'Use your email and password.'}
          </div>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-slate-700">Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
              />
            </label>

            {mode === 'sign_in' ? (
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-700">Password</span>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                />
              </label>
            ) : null}

            {mode === 'sign_in' ? (
              <button
                type="button"
                onClick={() => {
                  setMode('forgot')
                  setError(null)
                  setSuccess(null)
                }}
                className="justify-self-start text-xs font-medium text-slate-700 underline"
              >
                Forgot password?
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode('sign_in')
                  setError(null)
                  setSuccess(null)
                }}
                className="justify-self-start text-xs font-medium text-slate-700 underline"
              >
                Back to sign in
              </button>
            )}

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
              disabled={
                isSubmitting ||
                isLoading ||
                !email.trim() ||
                (mode === 'sign_in' && !password)
              }
              className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mode === 'forgot'
                ? isSubmitting
                  ? 'Sending…'
                  : 'Send reset email'
                : isSubmitting
                  ? 'Signing in…'
                  : 'Sign in'}
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-600">
          If you don’t have an account yet, contact admin:{' '}
          <a
            className="underline"
            href="mailto:lokhi.nalam@covergencehealth.com"
          >
            lokhi.nalam@covergencehealth.com
          </a>
        </div>
      </main>
    </div>
  )
}
