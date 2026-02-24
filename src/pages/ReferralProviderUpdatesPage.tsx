import { useCallback, useEffect, useMemo, useState } from 'react'
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
  apptDateTime: string
  emailSentAt: string
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
  'CANCELLED/ NO_SHOW',
] as const

const STATUS_TABS = [
  { key: 'APPT_SCHEDULED', label: 'Appt scheduled' },
  { key: 'NO_RESPONSE_3_ATTEMPTS', label: 'No response' },
  { key: 'NOT_INTERESTED', label: 'Not interested' },
  { key: 'CANCELLED/ NO_SHOW', label: 'Cancelled / no show' },
] as const

function statusColorClasses(status: string) {
  switch (status) {
    case 'APPT_SCHEDULED':
      return {
        tabActive: 'bg-emerald-600 text-white',
        pill: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      }
    case 'NO_RESPONSE_3_ATTEMPTS':
      return {
        tabActive: 'bg-amber-600 text-white',
        pill: 'bg-amber-50 text-amber-800 border-amber-200',
      }
    case 'NOT_INTERESTED':
      return {
        tabActive: 'bg-slate-700 text-white',
        pill: 'bg-slate-50 text-slate-800 border-slate-200',
      }
    case 'CANCELLED/ NO_SHOW':
      return {
        tabActive: 'bg-rose-600 text-white',
        pill: 'bg-rose-50 text-rose-800 border-rose-200',
      }
    default:
      return {
        tabActive: 'bg-brand text-white',
        pill: 'bg-slate-50 text-slate-800 border-slate-200',
      }
  }
}

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
  patients: Array<{ name: string; apptDateTime?: string; status?: string }>
}) {
  const { status, providerName: _providerName, practiceName: _practiceName, patients } = args

  const greeting = `Hello,\n\n`
  const signature = `\n\nThank you,\nConvergence Health\n`

  const apptLines = patients.length
    ? patients
        .map((p) => {
          const appt = String(p.apptDateTime ?? '').trim()
          const apptDisplay = appt ? formatDateTimeDisplay(appt) : ''
          return `Patient Name: ${p.name}${apptDisplay ? `\nAppointment Date & Time: ${apptDisplay}` : ''}`
        })
        .join('\n\n')
    : 'Patient Name: (No patients)'

  const nameLines = patients.length
    ? patients.map((p) => `Patient Name: ${p.name}`).join('\n\n')
    : 'Patient Name: (No patients)'

  const cancelledLines = patients.length
    ? patients
        .map((p) => {
          const appt = String(p.apptDateTime ?? '').trim()
          const apptDisplay = appt ? formatDateTimeDisplay(appt) : ''
          return `Patient Name: ${p.name}${apptDisplay ? `\nOriginal Appointment Date: ${apptDisplay}` : ''}\nStatus: Cancelled / No Show`
        })
        .join('\n\n')
    : 'Patient Name: (No patients)'

  if (status === 'APPT_SCHEDULED') {
    return {
      subject: 'Patient Update – Appointment Scheduled',
      body:
        greeting +
        'We are writing to inform you that the following patient(s) has been scheduled for an appointment with our office:\n\n' +
        `${apptLines}\n\n` +
        'Please let us know if you need any additional information.' +
        signature,
    }
  }

  if (status === 'NO_RESPONSE_3_ATTEMPTS') {
    return {
      subject: 'Patient Update – No Response After Contact Attempts',
      body:
        greeting +
        'We have made multiple attempts to contact the following patient(s) regarding their referral but have not received a response:\n\n' +
        `${nameLines}\n\n` +
        'At this time, the patient(s) has not scheduled an appointment. If you would like us to continue outreach or have updated contact information, please let us know.' +
        signature,
    }
  }

  if (status === 'NOT_INTERESTED') {
    return {
      subject: 'Patient Update – Not Interested in Scheduling',
      body:
        greeting +
        'We contacted the following patient(s) regarding their referral. The patient(s) has informed us that they are not interested in scheduling an appointment at this time:\n\n' +
        `${nameLines}\n\n` +
        'Please let us know if you would like us to follow up again in the future.' +
        signature,
    }
  }

  if (status === 'CANCELLED/ NO_SHOW') {
    return {
      subject: 'Patient Update – Appointment Cancelled / No Show',
      body:
        greeting +
        'We are writing to inform you that the following patient(s) did not complete their scheduled appointment:\n\n' +
        `${cancelledLines}\n\n` +
        'If you would like us to attempt rescheduling or follow up further, please let us know how you would like us to proceed.' +
        signature,
    }
  }

  return {
    subject: `Patient Update – ${statusLabel(status)}`,
    body: greeting + `${nameLines}` + signature,
  }
}

export default function ReferralProviderUpdatesPage() {
  const [weekStart, setWeekStart] = useState(() => toDateOnlyInputValue(startOfWeekLocal(new Date())))
  const [rows, setRows] = useState<UpdateRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [activeStatusTab, setActiveStatusTab] = useState<(typeof STATUS_TABS)[number]['key']>(
    STATUS_TABS[0].key,
  )

  const [providerById, setProviderById] = useState<Record<string, { name: string; email: string }>>({})
  const [isEmailUpdatesOpen, setIsEmailUpdatesOpen] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState('')
  const [isSendEmailModalOpen, setIsSendEmailModalOpen] = useState(false)
  const [sendEmailTo, setSendEmailTo] = useState('')
  const [sendEmailSubject, setSendEmailSubject] = useState('')
  const [sendEmailBody, setSendEmailBody] = useState('')
  const [sendEmailProviderId, setSendEmailProviderId] = useState<string | null>(null)
  const [confirmEmailSentRowId, setConfirmEmailSentRowId] = useState<string | null>(null)
  const [confirmEmailSentAtInput, setConfirmEmailSentAtInput] = useState('')
  const [confirmEmailSentProviderId, setConfirmEmailSentProviderId] = useState<string | null>(null)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [sendEmailError, setSendEmailError] = useState<string | null>(null)
  const [sendEmailSuccess, setSendEmailSuccess] = useState<string | null>(null)
  const [emailSentAtByRowId, setEmailSentAtByRowId] = useState<Record<string, string>>({})
  const [isMarkingEmailSent, setIsMarkingEmailSent] = useState(false)
  const [markEmailSentError, setMarkEmailSentError] = useState<string | null>(null)
  const [isProviderFilterOpen, setIsProviderFilterOpen] = useState(false)
  const [providerFilterIds, setProviderFilterIds] = useState<Record<string, boolean>>({})
  const [providerFilterAnchor, setProviderFilterAnchor] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const range = useMemo(() => {
    const startIso = toIsoStartOfDay(weekStart)
    if (!startIso) return null
    const endIso = addDaysIso(startIso, 7)
    if (!endIso) return null
    return { startIso, endIso }
  }, [weekStart])

  const reloadRows = useCallback(async () => {
    if (!range) return

    const statuses = STATUS_FILTER as unknown as string[]

    const colonoscopyRes = await supabase
      .from('referrals_colonoscopy_egd')
      .select(
        'id, patient_name, referral_provider, referral_provider_id, location, status, status_updated_at, appt_date_time, email_sent_at',
      )
      .eq('record_status', 'active')
      .in('status', statuses)
      .gte('status_updated_at', range.startIso)
      .lt('status_updated_at', range.endIso)

    const providerRes = await supabase.from('referral_providers').select('id, referral_provider, contact_email')

    if (colonoscopyRes.error) {
      setRows([])
      setError(colonoscopyRes.error.message)
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
        if (!idStr) continue
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
        apptDateTime: String(r.appt_date_time ?? ''),
        emailSentAt: String(r.email_sent_at ?? ''),
      })
    }

    next.sort((a, b) => {
      const at = new Date(a.statusUpdatedAt).getTime()
      const bt = new Date(b.statusUpdatedAt).getTime()
      return bt - at
    })

    setRows(next)
    const nextEmailSentAt: Record<string, string> = {}
    for (const r of next) {
      if (r.emailSentAt) nextEmailSentAt[r.id] = r.emailSentAt
    }
    setEmailSentAtByRowId(nextEmailSentAt)
  }, [range])

  useEffect(() => {
    if (!toastMessage) return
    const t = window.setTimeout(() => setToastMessage(null), 3500)
    return () => window.clearTimeout(t)
  }, [toastMessage])

  useEffect(() => {
    if (!range) return

    let isMounted = true
    setLoading(true)
    setError(null)

    void (async () => {
      await reloadRows()
      if (!isMounted) return
      setLoading(false)
    })()

    return () => {
      isMounted = false
    }
  }, [range, reloadRows])

  const grouped = useMemo(() => {
    const out: Record<string, UpdateRow[]> = {}
    for (const r of rows) {
      const k = r.status || ''
      if (!out[k]) out[k] = []
      out[k].push(r)
    }
    return out
  }, [rows])

  const emailUpdatesData = useMemo(() => {
    if (!isEmailUpdatesOpen) return null
    const statusRows = grouped[activeStatusTab] ?? []
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
    return { status: activeStatusTab, providers, byProviderId }
  }, [activeStatusTab, grouped, isEmailUpdatesOpen])

  const emailDraftByProviderId = useMemo(() => {
    if (!emailUpdatesData) return {}
    const out: Record<string, { to: string; subject: string; body: string }> = {}
    for (const providerId of emailUpdatesData.providers) {
      const providerInfo = providerById[providerId]
      const patients = emailUpdatesData.byProviderId[providerId] ?? []
      const unsentPatients = patients.filter((p) => !String(p.emailSentAt ?? '').trim())
      if (unsentPatients.length === 0) continue
      const providerName =
        providerId === '(No referral provider)'
          ? '(No referral provider)'
          : providerInfo?.name || '(Unknown provider)'
      const practiceName = computePracticeName(unsentPatients)
      const email = providerInfo?.email ?? ''
      const draft = buildEmailForStatus({
        status: emailUpdatesData.status,
        providerName,
        practiceName,
        patients: unsentPatients.map((p) => ({
          name: p.patientName,
          apptDateTime: p.apptDateTime,
          status: p.status,
        })),
      })
      out[providerId] = { to: email, subject: draft.subject, body: draft.body }
    }
    return out
  }, [emailUpdatesData, providerById])

  const activeRows = useMemo(() => grouped[activeStatusTab] ?? [], [activeStatusTab, grouped])

  const providerFilterOptions = useMemo(() => {
    const byId: Record<string, { id: string; label: string }> = {}
    for (const r of activeRows) {
      const id = String(r.referralProviderId ?? '').trim() || '(No referral provider)'
      const label = String(r.referralProvider ?? '').trim() || '(No referral provider)'
      if (!byId[id]) byId[id] = { id, label }
    }
    return Object.values(byId).sort((a, b) => a.label.localeCompare(b.label))
  }, [activeRows])

  const filteredActiveRows = useMemo(() => {
    const selectedIds = Object.keys(providerFilterIds).filter((k) => providerFilterIds[k])
    if (!selectedIds.length) return activeRows
    const selected = new Set(selectedIds)
    return activeRows.filter((r) => {
      const id = String(r.referralProviderId ?? '').trim() || '(No referral provider)'
      return selected.has(id)
    })
  }, [activeRows, providerFilterIds])

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
              <div className="grid gap-4 p-4">
                <div className="flex items-center gap-2 overflow-x-auto">
                  {STATUS_TABS.map((t) => {
                    const isActive = t.key === activeStatusTab
                    const colors = statusColorClasses(t.key)
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setActiveStatusTab(t.key)}
                        className={
                          isActive
                            ? `rounded-md px-3 py-2 text-xs font-semibold shadow-sm ${colors.tabActive}`
                            : 'rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50'
                        }
                      >
                        {t.label}{' '}
                        <span className={isActive ? 'text-white/80' : 'text-slate-500'}>
                          ({grouped[t.key]?.length ?? 0})
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-slate-700">{statusLabel(activeStatusTab)}</div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEmailUpdatesOpen(true)
                      setCopyFeedback('')
                    }}
                    className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand/90"
                  >
                    Send email update
                  </button>
                </div>

                {filteredActiveRows.length === 0 ? (
                  <div className="text-sm text-slate-600">No updates in this status for this week.</div>
                ) : (
                  <div className="rounded-md border overflow-visible">
                    <div className="overflow-x-auto">
                      <table className="w-full table-auto">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                            Patient Name
                          </th>
                          <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                            <div className="relative inline-flex items-center gap-2">
                              <span>Referral Provider</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                                  const desiredLeft = rect.left
                                  const desiredTop = rect.bottom + 8
                                  const maxLeft = Math.max(8, window.innerWidth - 304)
                                  const left = Math.min(Math.max(8, desiredLeft), maxLeft)
                                  const top = Math.max(8, desiredTop)
                                  setProviderFilterAnchor({ left, top })
                                  setIsProviderFilterOpen((v) => !v)
                                }}
                                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                              >
                                Filter
                              </button>
                            </div>
                          </th>
                          <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                            Location
                          </th>
                          <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700 min-w-[180px]">
                            Status
                          </th>
                          <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                            Status Updated Date
                          </th>
                          <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                            Email Sent At
                          </th>
                          <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                            
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredActiveRows.map((r) => (
                          <tr key={r.id} className="odd:bg-slate-50 hover:bg-slate-100">
                            <td className="border-b px-3 py-2 text-sm text-slate-800">{r.patientName}</td>
                            <td className="border-b px-3 py-2 text-sm text-slate-800">{r.referralProvider}</td>
                            <td className="border-b px-3 py-2 text-sm text-slate-800">{r.location}</td>
                            <td className="border-b px-3 py-2 text-sm text-slate-800 min-w-[180px]">
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
                                  statusColorClasses(r.status).pill
                                }`}
                              >
                                {statusLabel(r.status)}
                              </span>
                            </td>
                            <td className="border-b px-3 py-2 text-sm text-slate-800 whitespace-nowrap">
                              {formatDateTimeDisplay(r.statusUpdatedAt)}
                            </td>
                            <td className="border-b px-3 py-2 text-sm text-slate-800 whitespace-nowrap">
                              {formatDateTimeDisplay(emailSentAtByRowId[r.id] || r.emailSentAt) || '—'}
                            </td>
                            <td className="border-b px-3 py-2 text-sm text-slate-800 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setConfirmEmailSentRowId(r.id)}
                                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                Email sent
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {emailUpdatesData &&
                emailUpdatesData.providers.some((providerId) =>
                  (emailUpdatesData.byProviderId?.[providerId] ?? []).some((p) => !String(p.emailSentAt ?? '').trim()),
                ) ? (
                  <div className="mt-4 rounded-md border">
                    <div className="flex items-center justify-between gap-3 border-b bg-slate-50 px-3 py-2">
                      <div className="text-sm font-semibold text-slate-800">
                        Provider email updates: {statusLabel(emailUpdatesData.status)}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEmailUpdatesOpen(false)
                          setCopyFeedback('')
                        }}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Back to list
                      </button>
                    </div>

                    <div className="grid gap-4 p-3">
                      {emailUpdatesData.providers.map((providerId) => {
                        const providerInfo = providerById[providerId]
                        const email = providerInfo?.email ?? ''
                        const providerNameFromRows =
                          providerId === '(No referral provider)'
                            ? '(No referral provider)'
                            : String((emailUpdatesData.byProviderId[providerId]?.[0]?.referralProvider ?? '')).trim()
                        const providerName =
                          providerId === '(No referral provider)'
                            ? '(No referral provider)'
                            : providerInfo?.name || providerNameFromRows || '(Unknown provider)'
                        const patientsAll = emailUpdatesData.byProviderId[providerId] ?? []
                        const patients = patientsAll.filter((p) => !String(p.emailSentAt ?? '').trim())
                        const draft = emailDraftByProviderId[providerId]

                        if (!patients.length || !draft) return null

                        return (
                          <section key={providerId} className="rounded-md border">
                            <div className="grid gap-1 border-b bg-sky-50 px-3 py-2">
                              <div className="text-sm font-semibold text-slate-800">
                                {providerName}
                                {providerId === '(No referral provider)' ? null : (
                                  <span className="text-xs font-medium text-slate-500"> (ID: {providerId})</span>
                                )}
                              </div>
                              <div className="text-xs text-slate-600">
                                Email:{' '}
                                <span className={email ? 'text-slate-800' : 'text-red-700'}>
                                  {email || '(missing)'}
                                </span>
                              </div>
                              <div>
                                <button
                                  type="button"
                                  disabled={!email || !draft?.subject || !draft?.body}
                                  onClick={() => {
                                    if (!email || !draft?.subject || !draft?.body) return
                                    setSendEmailTo(draft?.to ?? email)
                                    setSendEmailSubject(draft.subject)
                                    setSendEmailBody(draft.body)
                                    setSendEmailProviderId(providerId)
                                    setSendEmailError(null)
                                    setSendEmailSuccess(null)
                                    setIsSendEmailModalOpen(true)
                                  }}
                                  className={
                                    email && draft?.subject && draft?.body
                                      ? 'inline-flex rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand/90'
                                      : 'inline-flex cursor-not-allowed rounded-md bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500'
                                  }
                                >
                                  Send email update
                                </button>
                                <button
                                  type="button"
                                  disabled={!email}
                                  onClick={() => {
                                    if (!email) return
                                    setConfirmEmailSentProviderId(providerId)
                                    setConfirmEmailSentRowId(null)
                                    setConfirmEmailSentAtInput('')
                                  }}
                                  className={
                                    email
                                      ? 'ml-2 inline-flex rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700'
                                      : 'ml-2 inline-flex cursor-not-allowed rounded-md bg-emerald-200 px-3 py-1.5 text-xs font-semibold text-white'
                                  }
                                >
                                  Confirm email sent
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
                                  Subject: <span className="text-slate-800">{draft.subject}</span>
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
                ) : null}
              </div>
            )}
          </div>
        </div>
      </main>

      {isSendEmailModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-md bg-white shadow-lg">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="text-sm font-semibold text-slate-800">Send email update</div>
              <button
                type="button"
                onClick={() => {
                  if (isSendingEmail) return
                  setIsSendEmailModalOpen(false)
                }}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="grid gap-3 px-4 py-4">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-slate-700">To</span>
                <input
                  value={sendEmailTo}
                  onChange={(e) => setSendEmailTo(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-slate-700">Subject</span>
                <input
                  value={sendEmailSubject}
                  onChange={(e) => setSendEmailSubject(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-slate-700">Message</span>
                <textarea
                  value={sendEmailBody}
                  onChange={(e) => setSendEmailBody(e.target.value)}
                  className="h-56 w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
                />
              </label>

              {sendEmailError ? <div className="text-sm text-red-700">{sendEmailError}</div> : null}
              {sendEmailSuccess ? <div className="text-sm text-emerald-700">{sendEmailSuccess}</div> : null}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSendingEmail}
                  onClick={() => {
                    if (isSendingEmail) return
                    setIsSendEmailModalOpen(false)
                  }}
                  className={
                    isSendingEmail
                      ? 'rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400'
                      : 'rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100'
                  }
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    isSendingEmail || !String(sendEmailTo).trim() || !String(sendEmailSubject).trim() || !String(sendEmailBody).trim()
                  }
                  onClick={() => {
                    if (isSendingEmail) return
                    const to = String(sendEmailTo).trim()
                    const subject = String(sendEmailSubject).trim()
                    const text = String(sendEmailBody).trim()
                    if (!to || !subject || !text) return

                    setIsSendingEmail(true)
                    setSendEmailError(null)
                    setSendEmailSuccess(null)

                    void (async () => {
                      try {
                        const {
                          data: { session },
                          error: sessionErr,
                        } = await supabase.auth.getSession()
                        if (sessionErr) throw sessionErr
                        if (!session?.access_token) {
                          throw new Error('No session found. Please log in again.')
                        }

                        const payload = { to, subject, text }

                        const res = await fetch(
                          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-provider-update-email`,
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${session.access_token}`,
                              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
                            },
                            body: JSON.stringify(payload),
                          },
                        )

                        if (!res.ok) {
                          const errText = await res.text()
                          throw new Error(`Edge Function failed: ${res.status} ${errText}`)
                        }

                        const data = (await res.json().catch(() => null)) as any
                        if (!data?.ok) {
                          throw new Error('Send failed')
                        }

                        if (sendEmailProviderId && emailUpdatesData?.byProviderId?.[sendEmailProviderId]) {
                          const now = new Date().toISOString()
                          const providerPatients = emailUpdatesData.byProviderId[sendEmailProviderId]
                          const ids = providerPatients.map((p) => String(p.id)).filter((id) => id)

                          if (ids.length) {
                            const updateRes = await supabase
                              .from('referrals_colonoscopy_egd')
                              .update({ email_sent_at: now })
                              .in('id', ids)
                            if (updateRes.error) {
                              throw new Error(`Email sent but failed to update Email Sent At: ${updateRes.error.message}`)
                            }
                          }

                          setEmailSentAtByRowId((prev) => {
                            const next = { ...prev }
                            for (const p of providerPatients) {
                              if (p?.id) next[String(p.id)] = now
                            }
                            return next
                          })
                        }

                        setToastMessage('Email sent successfully')
                        setSendEmailSuccess('Email sent')
                        setIsSendEmailModalOpen(false)
                        await reloadRows()
                      } catch (e: any) {
                        setSendEmailError(e?.message ?? 'Send failed')
                      } finally {
                        setIsSendingEmail(false)
                      }
                    })()
                  }}
                  className={
                    isSendingEmail || !String(sendEmailTo).trim() || !String(sendEmailSubject).trim() || !String(sendEmailBody).trim()
                      ? 'rounded-md bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500'
                      : 'rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand/90'
                  }
                >
                  {isSendingEmail ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmEmailSentRowId || confirmEmailSentProviderId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-md bg-white shadow-lg">
            <div className="border-b px-4 py-3 text-sm font-semibold text-slate-800">Confirm email sent</div>
            <div className="grid gap-3 px-4 py-4">
              <div className="text-sm text-slate-700">Are you sure the email update has been sent?</div>
              {markEmailSentError ? <div className="text-sm text-red-700">{markEmailSentError}</div> : null}
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-700">Email sent at</span>
                <input
                  type="datetime-local"
                  value={confirmEmailSentAtInput}
                  onChange={(e) => setConfirmEmailSentAtInput(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  if (isMarkingEmailSent) return
                  setConfirmEmailSentRowId(null)
                  setConfirmEmailSentProviderId(null)
                  setConfirmEmailSentAtInput('')
                  setMarkEmailSentError(null)
                }}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!confirmEmailSentAtInput || isMarkingEmailSent}
                onClick={() => {
                  const dt = String(confirmEmailSentAtInput).trim()
                  if (!dt) return
                  const iso = new Date(dt).toISOString()

                  setIsMarkingEmailSent(true)
                  setMarkEmailSentError(null)

                  void (async () => {
                    try {
                      const ids: string[] = []
                      if (confirmEmailSentProviderId && emailUpdatesData?.byProviderId?.[confirmEmailSentProviderId]) {
                        const providerPatients = emailUpdatesData.byProviderId[confirmEmailSentProviderId]
                        for (const p of providerPatients) {
                          if (p?.id) ids.push(String(p.id))
                        }
                      } else if (confirmEmailSentRowId) {
                        ids.push(String(confirmEmailSentRowId))
                      }

                      if (!ids.length) {
                        throw new Error('No rows selected')
                      }

                      const updateRes = await supabase
                        .from('referrals_colonoscopy_egd')
                        .update({ email_sent_at: iso })
                        .in('id', ids)

                      if (updateRes.error) throw updateRes.error

                      setEmailSentAtByRowId((prev) => {
                        const next = { ...prev }
                        for (const id of ids) next[id] = iso
                        return next
                      })

                      setConfirmEmailSentRowId(null)
                      setConfirmEmailSentProviderId(null)
                      setConfirmEmailSentAtInput('')
                      setToastMessage('Email sent confirmed')
                      await reloadRows()
                    } catch (e: any) {
                      setMarkEmailSentError(e?.message ?? 'Failed to mark as sent')
                    } finally {
                      setIsMarkingEmailSent(false)
                    }
                  })()
                }}
                className={
                  !confirmEmailSentAtInput || isMarkingEmailSent
                    ? 'rounded-md bg-emerald-200 px-3 py-1.5 text-xs font-semibold text-white'
                    : 'rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700'
                }
              >
                {isMarkingEmailSent ? 'Saving…' : 'Yes, mark as sent'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isProviderFilterOpen ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsProviderFilterOpen(false)
            }}
          />
          <div
            className="fixed z-50 w-72 rounded-md border bg-white p-2 shadow-lg"
            style={{ left: providerFilterAnchor.left, top: providerFilterAnchor.top }}
          >
            <div className="flex items-center justify-between gap-2 border-b pb-2">
              <div className="text-xs font-semibold text-slate-700">Referral providers</div>
              <button
                type="button"
                onClick={() => {
                  setProviderFilterIds({})
                  setIsProviderFilterOpen(false)
                }}
                className="text-[11px] font-medium text-slate-600 underline"
              >
                Clear
              </button>
            </div>
            <div className="max-h-56 overflow-auto pt-2">
              {providerFilterOptions.length ? (
                providerFilterOptions.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-center gap-2 px-1 py-1 text-xs text-slate-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(providerFilterIds[opt.id])}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setProviderFilterIds((prev) => ({ ...prev, [opt.id]: checked }))
                      }}
                    />
                    <span className="truncate">{opt.label}</span>
                  </label>
                ))
              ) : (
                <div className="px-1 py-2 text-xs text-slate-500">No providers</div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {toastMessage ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-6 py-4 text-base font-semibold text-emerald-800 shadow-lg">
            {toastMessage}
          </div>
        </div>
      ) : null}
    </div>
  )
}
