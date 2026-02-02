import { useState } from 'react'
import AppHeader from '../components/AppHeader'
import useLocalStorageState from '../lib/useLocalStorageState'

export default function NotepadPage() {
  const [savedText, setSavedText] = useLocalStorageState<string>('notepad_v1', '')
  const [text, setText] = useState(savedText)
  const [copied, setCopied] = useState(false)
  const [savedTick, setSavedTick] = useState(false)

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
    setSavedText(text)
    setSavedTick(true)
    setTimeout(() => setSavedTick(false), 1200)
  }

  function clearAll() {
    const ok = window.confirm('Clear all notes?')
    if (!ok) return
    setText('')
    setSavedText('')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader
        title="Notepad"
        subtitle="Use Save to store notes."
        right={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearAll}
              className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={saveNote}
              className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90"
            >
              {savedTick ? 'Saved' : 'Save'}
            </button>
            <button
              type="button"
              onClick={copyToClipboard}
              className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        }
      />

      <main className="mx-auto px-4 py-6">
        <div className="rounded-lg border bg-white">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={18}
            className="w-full resize-y rounded-lg bg-white p-4 text-sm outline-none"
            placeholder="Write notes here..."
          />
        </div>
      </main>
    </div>
  )
}
