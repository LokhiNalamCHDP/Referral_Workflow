import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

type AuthContextValue = {
  session: Session | null
  isLoading: boolean
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    void (async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!isMounted) return
      if (error) {
        setSession(null)
        setIsLoading(false)
        return
      }
      setSession(data.session)
      setIsLoading(false)
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    return {
      session,
      isLoading,
      async signInWithPassword(email: string, password: string) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error ? { error: error.message } : {}
      },
      async signOut() {
        await supabase.auth.signOut()
      },
    }
  }, [isLoading, session])

  return React.createElement(AuthContext.Provider, { value }, children)
}

export function useSupabaseAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider')
  return ctx
}
