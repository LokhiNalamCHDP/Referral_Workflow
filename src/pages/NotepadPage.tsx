import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../components/AppHeader'
import { useAccess } from '../lib/AccessProvider'
import { canAdmin } from '../lib/permissions'
import type { Location } from '../lib/accessTypes'
import { supabase } from '../lib/supabaseClient'

export default function NotepadPage() {
  const { access } = useAccess()
  const isAdmin = canAdmin(access?.role)
  const locations = useMemo<Location[]>(() => ['CH_Elko', 'CH_LakeHavasu', 'CH_Pahrump'], [])

  function NotepadEditor({ location, title }: { location: Location; title?: string }) {
    const [text, setText] = useState('')
    const [loadedText, setLoadedText] = useState('')
    const [history, setHistory] = useState<any[]>([])
    const [copied, setCopied] = useState(false)
    const [savedTick, setSavedTick] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
      let cancelled = false
      void (async () => {
        setIsLoading(true)
        setError(null)

        const { data, error: e } = await supabase
          .from('location_notepad')
          .select('note_body, edit_history')
          .eq('location', location)
          .maybeSingle()

        if (cancelled) return

        if (e) {
          setError(e.message)
          setText('')
          setLoadedText('')
          setHistory([])
          setIsLoading(false)
          return
        }

        const nextBody = String((data as any)?.note_body ?? '')
        const rawHistory = (data as any)?.edit_history
        const nextHistory = Array.isArray(rawHistory) ? rawHistory : []
        setText(nextBody)
        setLoadedText(nextBody)
        setHistory(nextHistory)
        setIsLoading(false)
      })()

      return () => {
        cancelled = true
      }
    }, [location])

    async function copyToClipboard() {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      } catch {
        setCopied(false)
      }
    }

    function saveNote() {
      void (async () => {
        setIsSaving(true)
        setError(null)

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        const userId = String(sessionData?.session?.user?.id ?? '').trim()
        if (sessionError || !userId) {
          setError('Not authenticated')
          setIsSaving(false)
          return
        }

        const before = loadedText
        const after = text
        const changed = before !== after
        const nextHistory = changed
          ? [
              ...history,
              {
                ts: new Date().toISOString(),
                by: userId,
                before,
                after,
              },
            ]
          : history

        const { error: e } = await supabase
          .from('location_notepad')
          .upsert({ location, note_body: after, edit_history: nextHistory } as any, { onConflict: 'location' })

        if (e) {
          setError(e.message)
          setIsSaving(false)
          return
        }

        setSavedTick(true)
        setTimeout(() => setSavedTick(false), 3000)
        setLoadedText(after)
        setHistory(nextHistory)
        setIsSaving(false)
      })()
    }

    function clearAll() {
      const ok = window.confirm('Clear all notes?')
      if (!ok) return
      setText('')
      void (async () => {
        setIsSaving(true)
        setError(null)

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        const userId = String(sessionData?.session?.user?.id ?? '').trim()
        if (sessionError || !userId) {
          setError('Not authenticated')
          setIsSaving(false)
          return
        }

        const before = loadedText
        const after = ''
        const changed = before !== after
        const nextHistory = changed
          ? [
              ...history,
              {
                ts: new Date().toISOString(),
                by: userId,
                before,
                after,
              },
            ]
          : history

        const { error: e } = await supabase
          .from('location_notepad')
          .upsert({ location, note_body: after, edit_history: nextHistory } as any, { onConflict: 'location' })

        if (e) {
          setError(e.message)
          setIsSaving(false)
          return
        }

        setSavedTick(true)
        setTimeout(() => setSavedTick(false), 3000)
        setLoadedText(after)
        setHistory(nextHistory)
        setIsSaving(false)
      })()
    }

    return (
      <div className="rounded-lg border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">{title ?? 'Notepad'}</div>
          <div className="flex items-center gap-2">
            {savedTick ? (
              <div className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                Saved
              </div>
            ) : null}
            <button
              type="button"
              onClick={clearAll}
              disabled={isLoading || isSaving}
              className="rounded-md border bg-white px-3 py-2 text-sm text-slate-900 hover:bg-slate-50"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={saveNote}
              disabled={isLoading || isSaving}
              className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90"
            >
              {isSaving ? 'Saving…' : savedTick ? 'Saved' : 'Save'}
            </button>
            <button
              type="button"
              onClick={copyToClipboard}
              disabled={isLoading}
              className="rounded-md border bg-white px-3 py-2 text-sm text-slate-900 hover:bg-slate-50"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        {error ? <div className="border-b px-4 py-2 text-sm text-red-700">{error}</div> : null}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          disabled={isLoading}
          className="w-full resize-y rounded-b-lg bg-white p-4 text-sm outline-none"
          placeholder="Write notes here..."
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader title="Notepad" subtitle={isAdmin ? 'Admin: notes by location.' : 'Use Save to store notes.'} />

      <main className="mx-auto px-4 py-6">
        {isAdmin ? (
          <div className="mx-auto grid max-w-5xl gap-4">
            {locations.map((loc) => (
              <NotepadEditor key={loc} location={loc} title={loc} />
            ))}
          </div>
        ) : (
          <div className="mx-auto max-w-5xl">
            {access?.location ? (
              <NotepadEditor location={access.location} title={access.location} />
            ) : (
              <div className="rounded-lg border bg-white p-4 text-sm text-slate-700">
                No location is assigned to your account.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
