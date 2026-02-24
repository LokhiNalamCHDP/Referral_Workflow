import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { UserAccess } from './accessTypes'
import { fetchUserAccess } from './access'
import { supabase } from './supabaseClient'

type AccessState = {
  access: UserAccess | null
  loading: boolean
  refresh: () => Promise<void>
}

const AccessContext = createContext<AccessState | null>(null)

export function AccessProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<UserAccess | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    setLoading(true)
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData.session) {
      setAccess(null)
      setLoading(false)
      return
    }

    const ua = await fetchUserAccess()
    if (!ua || ua.status === 'disabled') {
      const reason = !ua ? 'no_access' : 'disabled'
      await supabase.auth.signOut()
      window.location.replace(`/?reason=${encodeURIComponent(reason)}`)
      return
    }

    setAccess(ua)
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refresh()
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AccessState>(() => {
    return { access, loading, refresh }
  }, [access, loading])

  return React.createElement(AccessContext.Provider, { value }, children)
}

export function useAccess() {
  const ctx = useContext(AccessContext)
  if (!ctx) throw new Error('useAccess must be used within AccessProvider')
  return ctx
}
