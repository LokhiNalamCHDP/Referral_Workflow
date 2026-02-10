import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../components/AppHeader'
import { supabase } from '../lib/supabaseClient'

type UpdateRow = {
  id: string
  patientName: string
  referralProvider: string
  referralProviderId: string
  location: string
  status: string
  statusUpdatedAt: string
}

type ProviderEmail = {
  id: number
  referral_provider: string | null
  contact_email: string | null
}

const STATUS_FILTER = [
  'APPT_SCHEDULED',
  'NO_RESPONSE_3_ATTEMPTS',
  'NOT_INTERESTED',
  'CANCELLED',
  'NO_SHOW',
  'CANCELLED/ NO_SHOW',
] as const

function statusLabel(value: string) {
  switch (value) {
    case 'APPT_SCHEDULED':
      return 'Appt scheduled'
    case 'NO_RESPONSE_3_ATTEMPTS':
      return 'No response (3 attempts)'
    case 'NOT_INTERESTED':
      return 'Not interested'
    case 'CANCELLED':
      return 'Cancelled'
    case 'NO_SHOW':
      return 'No show'
    case 'CANCELLED/ NO_SHOW':
      return 'Cancelled / No show'
    default:
      return value
  }
}

function formatDateTimeDisplay(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function toIsoStartOfDay(dateOnly: string) {
  const d = new Date(dateOnly)
  if (Number.isNaN(d.getTime())) return null
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function toDateOnlyInputValue(d: Date) {
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function startOfWeekLocal(d: Date) {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  const day = out.getDay() // 0=Sun
  const diff = (day + 6) % 7 // Monday=0
  out.setDate(out.getDate() - diff)
  return out
}

function computePracticeName(patients: UpdateRow[]) {
  const locations = new Set(
    patients
      .map((p) => String(p.location ?? '').trim())
      .filter((v) => v),
  )
  if (locations.size === 0) return 'Convergence Health'
  if (locations.size === 1) return Array.from(locations)[0]
  return 'Convergence Health'
}

function buildEmailForStatus(args: {
  status: string
  providerName: string
  practiceName: string
  patientNames: string[]
}) {
  const { status, providerName, practiceName, patientNames } = args

  const greeting = `Hello ${providerName || '{{Referral Provider Name}}'},\n\n`
  const signature = `\n\nBest regards,\n${practiceName || '{{Practice / Location Name}}'}\nConvergence Health\n`

  const list = patientNames.length
    ? patientNames.map((n) => `* ${n}`).join('\n')
    : '* (No patients)'

  if (status === 'APPT_SCHEDULED') {
    return {
      subject: 'Patient referral update - Appointment scheduled',
      body:
        greeting +
        'We are writing to share an update regarding patients you referred to our practice.\n\n' +
        'The following patient(s) have been **successfully scheduled for an appointment**:\n\n' +
        `${list}\n\n` +
        'If you have any questions or need additional information, please feel free to reach out to our team.\n\n' +
        'Thank you for continuing to refer your patients to us.' +
        signature,
    }
  }

  if (status === 'NOT_INTERESTED') {
    return {
      subject: 'Patient referral update - Not interested',
      body:
        greeting +
        'We wanted to provide an update regarding patients you referred to our practice.\n\n' +
        'After outreach attempts, the following patient(s) have indicated they are **not interested in scheduling at this time**:\n\n' +
        `${list}\n\n` +
        'Please let us know if circumstances change or if a new referral is needed in the future.\n\n' +
        'Thank you for your continued collaboration.' +
        signature,
    }
  }

  if (status === 'CANCELLED' || status === 'NO_SHOW' || status === 'CANCELLED/ NO_SHOW') {
    return {
      subject: 'Patient referral update - Cancelled / No show',
      body:
        greeting +
        'We are reaching out with an update regarding patients you referred to our practice.\n\n' +
        'The following patient(s) had an appointment that was **cancelled or resulted in a no-show**:\n\n' +
        `${list}\n\n` +
        'Our team will follow internal protocols based on these outcomes. Please feel free to contact us if you would like to discuss next steps.\n\n' +
        'Thank you for referring your patients to our practice.' +
        signature,
    }
  }

  return {
    subject: `Patient referral update - ${statusLabel(status)}`,
    body:
      greeting +
      'We wanted to provide an update regarding patients you referred to our practice.\n\n' +
      `${list}` +
      signature,
  }
}

export default function ReferralProviderUpdatesPage() {
  const [weekStart, setWeekStart] = useState(() => toDateOnlyInputValue(startOfWeekLocal(new Date())))
  const [rows, setRows] = useState<UpdateRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [providerById, setProviderById] = useState<Record<string, { name: string; email: string }>>({})
  const [emailModalStatus, setEmailModalStatus] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState('')

  const range = useMemo(() => {
    const startIso = toIsoStartOfDay(weekStart)
    if (!startIso) return null
    const endIso = addDaysIso(startIso, 7)
    if (!endIso) return null
    return { startIso, endIso }
  }, [weekStart])

  useEffect(() => {
    if (!range) return

    let isMounted = true
    setLoading(true)
    setError(null)

    void (async () => {
      const statuses = STATUS_FILTER as unknown as string[]

      const colonoscopyRes = await supabase
        .from('referrals_colonoscopy_egd')
        .select(
          'id, patient_name, referral_provider, referral_provider_id, location, status, status_updated_at',
        )
        .eq('record_status', 'active')
        .in('status', statuses)
        .gte('status_updated_at', range.startIso)
        .lt('status_updated_at', range.endIso)

      const providerRes = await supabase
        .from('referral_providers')
        .select('id, referral_provider, contact_email')
        .eq('is_active', true)

      if (!isMounted) return

      if (colonoscopyRes.error) {
        setRows([])
        setError(colonoscopyRes.error.message)
        setLoading(false)
        return
      }

      if (providerRes.error) {
        setProviderById({})
      } else {
        const nextProviders: Record<string, { name: string; email: string }> = {}
        for (const p of (providerRes.data ?? []) as ProviderEmail[]) {
          const id = (p as any).id
          const idStr = id != null ? String(id) : ''
          const name = String((p as any).referral_provider ?? '').trim()
          const email = String((p as any).contact_email ?? '').trim()
          if (!idStr || !email) continue
          if (!(idStr in nextProviders)) nextProviders[idStr] = { name, email }
        }
        setProviderById(nextProviders)
      }

      const next: UpdateRow[] = []

      for (const r of (colonoscopyRes.data ?? []) as any[]) {
        next.push({
          id: String(r.id ?? ''),
          patientName: String(r.patient_name ?? ''),
          referralProvider: String(r.referral_provider ?? ''),
          referralProviderId: r.referral_provider_id != null ? String(r.referral_provider_id) : '',
          location: String(r.location ?? ''),
          status: String(r.status ?? ''),
          statusUpdatedAt: String(r.status_updated_at ?? ''),
        })
      }

      next.sort((a, b) => {
        const at = new Date(a.statusUpdatedAt).getTime()
        const bt = new Date(b.statusUpdatedAt).getTime()
        return bt - at
      })

      setRows(next)
      setLoading(false)
    })()

    return () => {
      isMounted = false
    }
  }, [range])

  const grouped = useMemo(() => {
    const out: Record<string, UpdateRow[]> = {}
    for (const r of rows) {
      const k = r.status || ''
      if (!out[k]) out[k] = []
      out[k].push(r)
    }
    return out
  }, [rows])

  const emailModalData = useMemo(() => {
    if (!emailModalStatus) return null
    const statusRows = grouped[emailModalStatus] ?? []
    const byProviderId: Record<string, UpdateRow[]> = {}
    for (const r of statusRows) {
      const providerId = String(r.referralProviderId ?? '').trim()
      const k = providerId || '(No referral provider)'
      if (!byProviderId[k]) byProviderId[k] = []
      byProviderId[k].push(r)
    }

    const providers = Object.keys(byProviderId).sort((a, b) => a.localeCompare(b))
    for (const p of providers) {
      byProviderId[p].sort((a, b) => {
        const an = (a.patientName ?? '').toLowerCase()
        const bn = (b.patientName ?? '').toLowerCase()
        return an.localeCompare(bn)
      })
    }
    return { status: emailModalStatus, providers, byProviderId }
  }, [emailModalStatus, grouped])

  const emailDraftByProviderId = useMemo(() => {
    if (!emailModalData) return {}
    const out: Record<string, { to: string; subject: string; body: string }> = {}
    for (const providerId of emailModalData.providers) {
      const providerInfo = providerById[providerId]
      const patients = emailModalData.byProviderId[providerId] ?? []
      const providerName =
        providerId === '(No referral provider)'
          ? '(No referral provider)'
          : providerInfo?.name || '(Unknown provider)'
      const practiceName = computePracticeName(patients)
      const patientNames = patients.map((p) => p.patientName).filter((v) => v)
      const email = providerInfo?.email ?? ''
      const draft = buildEmailForStatus({
        status: emailModalData.status,
        providerName,
        practiceName,
        patientNames,
      })
      out[providerId] = { to: email, subject: draft.subject, body: draft.body }
    }
    return out
  }, [emailModalData, providerById])

  const orderedStatuses = useMemo(() => {
    const preferred = STATUS_FILTER as unknown as string[]
    const present = Object.keys(grouped)
    const inPreferred = preferred.filter((s) => present.includes(s))
    const extras = present.filter((s) => !preferred.includes(s)).sort((a, b) => a.localeCompare(b))
    return [...inPreferred, ...extras]
  }, [grouped])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader title="Referral Provider Updates" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="grid gap-4">
          <div className="rounded-lg border bg-white p-4">
            <div className="grid gap-2">
              <div className="text-sm font-semibold text-slate-800">Week</div>
              <div className="flex items-end gap-3">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-slate-700">Week start</span>
                  <input
                    type="date"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                    className="w-[220px] rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                  />
                </label>
                <div className="pb-2 text-xs text-slate-500">Select the Monday of the week</div>
              </div>
              <div className="text-xs text-slate-600">
                Showing statuses:
                {' '}
                {STATUS_FILTER.map(statusLabel).join(', ')}
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-white">
            <div className="border-b px-4 py-3 text-sm font-semibold text-slate-800">
              Updates
            </div>

            {error ? (
              <div className="px-4 py-4 text-sm text-red-700">{error}</div>
            ) : loading ? (
              <div className="px-4 py-4 text-sm text-slate-600">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-600">No updates found for this week.</div>
            ) : (
              <div className="grid gap-6 p-4">
                {orderedStatuses.map((status) => (
                  <section key={status} className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-slate-700">
                        {statusLabel(status)}
                        {' '}
                        <span className="text-slate-500">({grouped[status]?.length ?? 0})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEmailModalStatus(status)}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Send email update
                      </button>
                    </div>
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full table-auto">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                              Patient Name
                            </th>
                            <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                              Referral Provider
                            </th>
                            <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                              Location
                            </th>
                            <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                              Status
                            </th>
                            <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                              Status Updated Date
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(grouped[status] ?? []).map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50">
                              <td className="border-b px-3 py-2 text-sm text-slate-800">
                                {r.patientName}
                              </td>
                              <td className="border-b px-3 py-2 text-sm text-slate-800">
                                {r.referralProvider}
                              </td>
                              <td className="border-b px-3 py-2 text-sm text-slate-800">
                                {r.location}
                              </td>
                              <td className="border-b px-3 py-2 text-sm text-slate-800">
                                {statusLabel(r.status)}
                              </td>
                              <td className="border-b px-3 py-2 text-sm text-slate-800 whitespace-nowrap">
                                {formatDateTimeDisplay(r.statusUpdatedAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {emailModalData ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setEmailModalStatus(null)}
          />
          <div className="absolute left-1/2 top-1/2 w-[min(920px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="text-sm font-semibold text-slate-800">
                Email update: {statusLabel(emailModalData.status)}
              </div>
              <button
                type="button"
                onClick={() => {
                  setEmailModalStatus(null)
                  setCopyFeedback('')
                }}
                className="rounded px-2 py-1 text-sm hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-4">
              <div className="grid gap-4">
                {emailModalData.providers.map((provider) => {
                  const providerId = provider
                  const providerInfo = providerById[providerId]
                  const email = providerInfo?.email ?? ''
                  const providerName =
                    providerId === '(No referral provider)'
                      ? '(No referral provider)'
                      : providerInfo?.name || '(Unknown provider)'
                  const patients = emailModalData.byProviderId[providerId] ?? []
                  const draft = emailDraftByProviderId[providerId]
                  return (
                    <section key={providerId} className="rounded-md border">
                      <div className="grid gap-1 border-b bg-slate-50 px-3 py-2">
                        <div className="text-sm font-semibold text-slate-800">
                          {providerName}
                          {providerId === '(No referral provider)' ? null : (
                            <span className="text-xs font-medium text-slate-500">{' '}(ID: {providerId})</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600">
                          Email:
                          {' '}
                          <span className={email ? 'text-slate-800' : 'text-red-700'}>
                            {email || '(missing)'}
                          </span>
                        </div>
                        <div>
                          <button
                            type="button"
                            disabled={!email}
                            onClick={() => {
                              if (!email) return
                              const payload = {
                                to: draft?.to ?? email,
                                subject: draft?.subject ?? '',
                                body: draft?.body ?? '',
                              }
                              console.log(payload)
                            }}
                            className={
                              email
                                ? 'inline-flex rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100'
                                : 'inline-flex cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400'
                            }
                          >
                            Confirm sent update
                          </button>
                          <button
                            type="button"
                            disabled={!draft?.body}
                            onClick={() => {
                              const text = `To: ${draft?.to ?? ''}\nSubject: ${draft?.subject ?? ''}\n\n${draft?.body ?? ''}`
                              void navigator.clipboard
                                .writeText(text)
                                .then(() => {
                                  setCopyFeedback('Copied')
                                  window.setTimeout(() => setCopyFeedback(''), 1500)
                                })
                                .catch(() => {
                                  setCopyFeedback('Copy failed')
                                  window.setTimeout(() => setCopyFeedback(''), 1500)
                                })
                            }}
                            className={
                              draft?.body
                                ? 'ml-2 inline-flex rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100'
                                : 'ml-2 inline-flex cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400'
                            }
                          >
                            Copy email
                          </button>
                          {copyFeedback ? (
                            <span className="ml-2 text-xs text-slate-600">{copyFeedback}</span>
                          ) : null}
                        </div>
                      </div>
                      {draft ? (
                        <div className="grid gap-2 p-3">
                          <div className="text-xs text-slate-600">
                            Subject:
                            {' '}
                            <span className="text-slate-800">{draft.subject}</span>
                          </div>
                          <textarea
                            value={draft.body}
                            readOnly
                            className="h-44 w-full resize-none rounded-md border bg-white p-2 text-xs text-slate-800 outline-none"
                          />
                        </div>
                      ) : null}
                      <div className="overflow-x-auto">
                        <table className="w-full table-auto">
                          <thead>
                            <tr>
                              <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                                Patient Name
                              </th>
                              <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                                Location
                              </th>
                              <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                                Status Updated Date
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {patients.map((p) => (
                              <tr key={p.id} className="hover:bg-white">
                                <td className="border-b px-3 py-2 text-sm text-slate-800">{p.patientName}</td>
                                <td className="border-b px-3 py-2 text-sm text-slate-800">{p.location}</td>
                                <td className="border-b px-3 py-2 text-sm text-slate-800 whitespace-nowrap">
                                  {formatDateTimeDisplay(p.statusUpdatedAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
