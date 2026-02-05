import AppHeader from '../components/AppHeader'

export default function TableSettingsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader title="Table settings" subtitle="Admin only" />
      <main className="mx-auto px-4 py-6">
        <div className="rounded-lg border bg-white p-4 text-sm text-slate-700">
          Table settings
        </div>
      </main>
    </div>
  )
}
