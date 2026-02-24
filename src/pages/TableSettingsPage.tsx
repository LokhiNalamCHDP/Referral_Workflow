import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../components/AppHeader'
import { supabase } from '../lib/supabaseClient'

type InsuranceRow = {
  id: string
  label: string
  isActive: boolean
}

type ProviderRow = {
  id: string
  practice: string
  provider: string
  contactPhone: string
  contactEmail: string
  address: string
  isActive: boolean
  editHistory: any[]
}

type ProviderMode = 'new' | 'existing'

const PRACTICE_PLACEHOLDER_PROVIDER = '__practice__'

export default function TableSettingsPage() {
  const [activeTab, setActiveTab] = useState<'insurances' | 'providers'>('insurances')
  const [providerMode, setProviderMode] = useState<ProviderMode>('new')
  const [existingPracticeSelected, setExistingPracticeSelected] = useState('')

  const [isAddProviderOpen, setIsAddProviderOpen] = useState(false)
  const [isEditProviderOpen, setIsEditProviderOpen] = useState(false)
  const [editProviderId, setEditProviderId] = useState<string | null>(null)
  const [editProviderPractice, setEditProviderPractice] = useState('')
  const [editProviderNameDraft, setEditProviderNameDraft] = useState('')
  const [editProviderPhoneDraft, setEditProviderPhoneDraft] = useState('')
  const [editProviderEmailDraft, setEditProviderEmailDraft] = useState('')
  const [editProviderAddressDraft, setEditProviderAddressDraft] = useState('')
  const [editProviderActiveDraft, setEditProviderActiveDraft] = useState(true)
  const [editProviderModalError, setEditProviderModalError] = useState<string | null>(null)

  const [insurances, setInsurances] = useState<InsuranceRow[]>([])
  const [originalInsuranceActive, setOriginalInsuranceActive] = useState<Record<string, boolean>>({})
  const [insuranceColumnKey, setInsuranceColumnKey] = useState<string>('insurance')
  const [insuranceDraft, setInsuranceDraft] = useState('')
  const [insuranceError, setInsuranceError] = useState<string | null>(null)
  const [insuranceSuccess, setInsuranceSuccess] = useState<string | null>(null)

  const [providers, setProviders] = useState<ProviderRow[]>([])
  const [originalProviders, setOriginalProviders] = useState<Record<string, ProviderRow>>({})
  const [providerError, setProviderError] = useState<string | null>(null)
  const [providerSuccess, setProviderSuccess] = useState<string | null>(null)
  const [savingProviderId, setSavingProviderId] = useState<string | null>(null)

  const [newProviderPracticeExisting, setNewProviderPracticeExisting] = useState('')
  const [newProviderNameDraft, setNewProviderNameDraft] = useState('')
  const [newProviderPhoneDraft, setNewProviderPhoneDraft] = useState('')
  const [newProviderEmailDraft, setNewProviderEmailDraft] = useState('')
  const [newProviderAddressDraft, setNewProviderAddressDraft] = useState('')
  const [addProviderModalError, setAddProviderModalError] = useState<string | null>(null)

  const [newPracticeNameDraft, setNewPracticeNameDraft] = useState('')

  function insuranceRowLabel(r: any): string {
    if (!r || typeof r !== 'object') return ''
    const candidates = ['insurance', 'name', 'label', 'value', 'title']
    for (const k of candidates) {
      const v = (r as any)[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
    for (const v of Object.values(r)) {
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
    return ''
  }

  async function refreshInsurances() {
    const { data, error } = await supabase.from('insurances').select('*')
    if (error) {
      setInsurances([])
      setInsuranceError(error.message)
      return
    }

    const rows = data ?? []
    if (rows.length > 0) {
      const r0 = rows[0] as any
      const candidates = ['insurance', 'name', 'label', 'value', 'title']
      const foundKey = candidates.find((k) => typeof r0?.[k] === 'string')
      if (foundKey) setInsuranceColumnKey(foundKey)
    }

    const next: InsuranceRow[] = []
    for (const r of rows) {
      const label = insuranceRowLabel(r).trim()
      if (!label) continue
      const idRaw = (r as any).id
      const id = idRaw != null ? String(idRaw) : label
      const isActive = (r as any).is_active === true
      next.push({ id, label, isActive })
    }
    next.sort((a, b) => a.label.localeCompare(b.label))
    setInsurances(next)
    setOriginalInsuranceActive(Object.fromEntries(next.map((x) => [x.id, x.isActive])))
  }

  async function refreshProviders() {
    const { data, error } = await supabase
      .from('referral_providers')
      .select('id, referral_provider, provider_practice, contact_phone, contact_email, address, is_active, edit_history')
      .order('provider_practice', { ascending: true })
      .order('referral_provider', { ascending: true })

    if (error) {
      setProviders([])
      setProviderError(error.message)
      return
    }

    const rows = (data ?? []) as any[]
    const next: ProviderRow[] = rows.map((r) => {
      return {
        id: r.id != null ? String(r.id) : '',
        practice: String(r.provider_practice ?? ''),
        provider: String(r.referral_provider ?? ''),
        contactPhone: String(r.contact_phone ?? ''),
        contactEmail: String(r.contact_email ?? ''),
        address: String(r.address ?? ''),
        isActive: r.is_active === true,
        editHistory: Array.isArray(r.edit_history) ? r.edit_history : [],
      }
    })

    setProviders(next)
    setOriginalProviders(Object.fromEntries(next.map((x) => [x.id, x])))
  }

  useEffect(() => {
    void refreshInsurances()
    void refreshProviders()
  }, [])

  const canAddInsurance = useMemo(() => {
    const v = insuranceDraft.trim()
    if (!v) return false
    const set = new Set(insurances.map((x) => x.label.trim().toLowerCase()).filter(Boolean))
    return !set.has(v.toLowerCase())
  }, [insuranceDraft, insurances])

  async function addInsurance() {
    const v = insuranceDraft.trim()
    if (!v) return

    setInsuranceError(null)
    setInsuranceSuccess(null)

    if (!canAddInsurance) {
      setInsuranceError('Insurance already exists')
      return
    }

    const { error } = await supabase
      .from('insurances')
      .insert({ [insuranceColumnKey]: v, is_active: true })
    if (error) {
      setInsuranceError(error.message)
      return
    }

    setInsuranceDraft('')
    setInsuranceSuccess('Insurance added')
    await refreshInsurances()
  }

  const practices = useMemo(() => {
    return Array.from(
      new Set(providers.map((p) => p.practice.trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b))
  }, [providers])

  useEffect(() => {
    if (newProviderPracticeExisting.trim()) return
    if (practices.length === 0) return
    setNewProviderPracticeExisting(practices[0])
  }, [newProviderPracticeExisting, practices])

  const visibleProviders = useMemo(() => {
    return providers.filter((p) => p.provider !== PRACTICE_PLACEHOLDER_PROVIDER)
  }, [providers])

  const filteredProviders = useMemo(() => {
    const practice = existingPracticeSelected.trim()
    if (!practice) return []
    return visibleProviders.filter((p) => p.practice === practice)
  }, [visibleProviders, existingPracticeSelected])

  const canAddProvider = useMemo(() => {
    const providerName = newProviderNameDraft.trim()
    if (!providerName) return false

    const practice = newProviderPracticeExisting.trim()
    if (!practice) return false

    const existing = new Set(
      providers
        .filter((p) => p.provider.trim() && p.provider.trim() !== PRACTICE_PLACEHOLDER_PROVIDER)
        .map((p) => `${p.practice}`.trim().toLowerCase() + '|' + `${p.provider}`.trim().toLowerCase()),
    )
    return !existing.has(practice.toLowerCase() + '|' + providerName.toLowerCase())
  }, [newProviderEmailDraft, newProviderNameDraft, newProviderPracticeExisting, providers])

  async function addProvider() {
    if (!canAddProvider) return
    setProviderError(null)
    setProviderSuccess(null)
    setAddProviderModalError(null)

    const practice = newProviderPracticeExisting.trim()
    const providerName = newProviderNameDraft.trim()
    const contactPhone = newProviderPhoneDraft.trim()
    const contactEmail = newProviderEmailDraft.trim()
    const address = newProviderAddressDraft.trim()

    if (!contactEmail) {
      setAddProviderModalError('Email is required')
      return
    }

    const nowIso = new Date().toISOString()
    const editHistoryEntry = {
      at: nowIso,
      action: 'insert',
      provider_practice: practice,
      referral_provider: providerName,
      contact_phone: contactPhone || null,
      contact_email: contactEmail || null,
      address: address || null,
      is_active: true,
    }

    const { error } = await supabase.from('referral_providers').insert({
      provider_practice: practice,
      referral_provider: providerName,
      contact_phone: contactPhone || null,
      contact_email: contactEmail || null,
      address: address || null,
      is_active: true,
      edit_history: [editHistoryEntry],
    })

    if (error) {
      setProviderError(error.message)
      return
    }

    setNewProviderNameDraft('')
    setNewProviderPhoneDraft('')
    setNewProviderEmailDraft('')
    setNewProviderAddressDraft('')
    setProviderSuccess('Provider added')
    await refreshProviders()
  }

  function openEditProvider(p: ProviderRow) {
    setProviderError(null)
    setProviderSuccess(null)
    setEditProviderModalError(null)
    setEditProviderId(p.id)
    setEditProviderPractice(p.practice)
    setEditProviderNameDraft(p.provider)
    setEditProviderPhoneDraft(p.contactPhone)
    setEditProviderEmailDraft(p.contactEmail)
    setEditProviderAddressDraft(p.address)
    setEditProviderActiveDraft(p.isActive)
    setIsEditProviderOpen(true)
  }

  function applyEditProvider() {
    if (!editProviderId) return
    const contactEmail = editProviderEmailDraft.trim()
    if (!contactEmail) {
      setEditProviderModalError('Email is required')
      return
    }

    updateProviderField(editProviderId, {
      provider: editProviderNameDraft.trim(),
      contactPhone: editProviderPhoneDraft.trim(),
      contactEmail,
      address: editProviderAddressDraft.trim(),
      isActive: editProviderActiveDraft,
    })

    setIsEditProviderOpen(false)
    setEditProviderId(null)
    setEditProviderPractice('')
  }

  const canAddNewPracticeProvider = useMemo(() => {
    const practice = newPracticeNameDraft.trim()
    if (!practice) return false

    const providerName = newProviderNameDraft.trim()
    if (!providerName) return false

    const email = newProviderEmailDraft.trim()
    if (!email) return false

    const existing = new Set(
      providers
        .filter((p) => p.provider !== PRACTICE_PLACEHOLDER_PROVIDER)
        .map((p) => `${p.practice}`.trim().toLowerCase() + '|' + `${p.provider}`.trim().toLowerCase()),
    )

    return !existing.has(practice.toLowerCase() + '|' + providerName.toLowerCase())
  }, [newPracticeNameDraft, newProviderEmailDraft, newProviderNameDraft, providers])

  async function addNewPracticeProvider() {
    if (!canAddNewPracticeProvider) return
    setProviderError(null)
    setProviderSuccess(null)

    const practice = newPracticeNameDraft.trim()
    const providerName = newProviderNameDraft.trim()
    const contactPhone = newProviderPhoneDraft.trim()
    const contactEmail = newProviderEmailDraft.trim()
    const address = newProviderAddressDraft.trim()

    if (!contactEmail) {
      setProviderError('Email is required')
      return
    }

    const nowIso = new Date().toISOString()
    const editHistoryEntry = {
      at: nowIso,
      action: 'insert',
      provider_practice: practice,
      referral_provider: providerName,
      contact_phone: contactPhone || null,
      contact_email: contactEmail || null,
      address: address || null,
      is_active: true,
    }

    const { error } = await supabase.from('referral_providers').insert({
      provider_practice: practice,
      referral_provider: providerName,
      contact_phone: contactPhone || null,
      contact_email: contactEmail || null,
      address: address || null,
      is_active: true,
      edit_history: [editHistoryEntry],
    })

    if (error) {
      setProviderError(error.message)
      return
    }

    setNewPracticeNameDraft('')
    setNewProviderNameDraft('')
    setNewProviderPhoneDraft('')
    setNewProviderEmailDraft('')
    setNewProviderAddressDraft('')
    setProviderSuccess('Provider added')
    await refreshProviders()
  }


  function updateProviderField(id: string, patch: Partial<ProviderRow>) {
    setProviderError(null)
    setProviderSuccess(null)
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  function isProviderDirty(p: ProviderRow) {
    const original = originalProviders[p.id]
    if (!original) return false
    return (
      p.practice !== original.practice ||
      p.provider !== original.provider ||
      p.contactPhone !== original.contactPhone ||
      p.contactEmail !== original.contactEmail ||
      p.address !== original.address ||
      p.isActive !== original.isActive
    )
  }

  async function saveProviderRow(id: string) {
    if (!id) return
    if (savingProviderId) return

    const row = filteredProviders.find((x) => x.id === id)
    if (!row) return

    if (!isProviderDirty(row)) return

    setProviderError(null)
    setProviderSuccess(null)
    setSavingProviderId(id)

    try {
      const original = originalProviders[id]
      const changes: Record<string, { from: any; to: any }> = {}
      if (original) {
        if (row.practice !== original.practice) changes.provider_practice = { from: original.practice, to: row.practice }
        if (row.provider !== original.provider) changes.referral_provider = { from: original.provider, to: row.provider }
        if (row.contactPhone !== original.contactPhone) changes.contact_phone = { from: original.contactPhone, to: row.contactPhone }
        if (row.contactEmail !== original.contactEmail) changes.contact_email = { from: original.contactEmail, to: row.contactEmail }
        if (row.address !== original.address) changes.address = { from: original.address, to: row.address }
        if (row.isActive !== original.isActive) changes.is_active = { from: original.isActive, to: row.isActive }
      }

      const nowIso = new Date().toISOString()
      const editHistoryEntry = {
        at: nowIso,
        action: 'update',
        changes,
      }

      const priorHistory = (original?.editHistory ?? row.editHistory ?? []) as any[]
      const nextHistory = [...priorHistory, editHistoryEntry]

      const { error } = await supabase
        .from('referral_providers')
        .update({
          provider_practice: row.practice,
          referral_provider: row.provider,
          contact_phone: row.contactPhone || null,
          contact_email: row.contactEmail.trim() || null,
          address: row.address || null,
          is_active: row.isActive,
          edit_history: nextHistory,
        })
        .eq('id', id)

      if (error) throw error

      setProviderSuccess('Saved')
      await refreshProviders()
    } catch (e: any) {
      setProviderError(e?.message ?? 'Save failed')
      await refreshProviders()
    } finally {
      setSavingProviderId(null)
    }
  }

  const dirtyProviderIds = useMemo(() => {
    const dirty: string[] = []
    for (const p of filteredProviders) {
      const original = originalProviders[p.id]
      if (!original) continue
      if (
        p.practice !== original.practice ||
        p.provider !== original.provider ||
        p.contactPhone !== original.contactPhone ||
        p.contactEmail !== original.contactEmail ||
        p.address !== original.address ||
        p.isActive !== original.isActive
      ) {
        dirty.push(p.id)
      }
    }
    return dirty
  }, [filteredProviders, originalProviders])

  async function saveProviderChanges() {
    if (!dirtyProviderIds.length) return
    setProviderError(null)
    setProviderSuccess(null)

    for (const id of dirtyProviderIds) {
      const row = filteredProviders.find((x) => x.id === id)
      if (!row) continue

      const original = originalProviders[id]
      const changes: Record<string, { from: any; to: any }> = {}
      if (original) {
        if (row.practice !== original.practice) changes.provider_practice = { from: original.practice, to: row.practice }
        if (row.provider !== original.provider) changes.referral_provider = { from: original.provider, to: row.provider }
        if (row.contactPhone !== original.contactPhone)
          changes.contact_phone = { from: original.contactPhone, to: row.contactPhone }
        if (row.contactEmail !== original.contactEmail)
          changes.contact_email = { from: original.contactEmail, to: row.contactEmail }
        if (row.address !== original.address) changes.address = { from: original.address, to: row.address }
        if (row.isActive !== original.isActive) changes.is_active = { from: original.isActive, to: row.isActive }
      }

      const nowIso = new Date().toISOString()
      const editHistoryEntry = {
        at: nowIso,
        action: 'update',
        changes,
      }

      const priorHistory = (original?.editHistory ?? row.editHistory ?? []) as any[]
      const nextHistory = [...priorHistory, editHistoryEntry]

      const { error } = await supabase
        .from('referral_providers')
        .update({
          provider_practice: row.practice,
          referral_provider: row.provider,
          contact_phone: row.contactPhone || null,
          contact_email: row.contactEmail || null,
          address: row.address || null,
          is_active: row.isActive,
          edit_history: nextHistory,
        })
        .eq('id', id)

      if (error) {
        setProviderError(error.message)
        await refreshProviders()
        return
      }
    }

    setProviderSuccess('Saved')
    await refreshProviders()
  }

  const dirtyInsuranceIds = useMemo(() => {
    const dirty: string[] = []
    for (const r of insurances) {
      const original = originalInsuranceActive[r.id]
      if (original == null) continue
      if (r.isActive !== original) dirty.push(r.id)
    }
    return dirty
  }, [insurances, originalInsuranceActive])

  const canSaveActiveChanges = dirtyInsuranceIds.length > 0

  function toggleInsuranceActive(id: string, next: boolean) {
    setInsuranceError(null)
    setInsuranceSuccess(null)
    setInsurances((prev) => prev.map((r) => (r.id === id ? { ...r, isActive: next } : r)))
  }

  async function saveInsuranceActiveChanges() {
    if (!canSaveActiveChanges) return
    setInsuranceError(null)
    setInsuranceSuccess(null)

    for (const id of dirtyInsuranceIds) {
      const row = insurances.find((x) => x.id === id)
      if (!row) continue
      const { error } = await supabase.from('insurances').update({ is_active: row.isActive }).eq('id', id)
      if (error) {
        setInsuranceError(error.message)
        await refreshInsurances()
        return
      }
    }

    setInsuranceSuccess('Saved')
    await refreshInsurances()
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader title="Table settings" subtitle="Admin only" />
      <main className="mx-auto px-4 py-6">
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('insurances')}
              className={
                activeTab === 'insurances'
                  ? 'rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white'
                  : 'rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50'
              }
            >
              Insurance options
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('providers')}
              className={
                activeTab === 'providers'
                  ? 'rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white'
                  : 'rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50'
              }
            >
              Referral providers
            </button>
          </div>

          {activeTab === 'insurances' ? (
            <div className="rounded-lg border bg-white p-4 text-sm text-slate-700">
              <div className="mb-3 text-sm font-semibold text-slate-900">Insurance options</div>

              <div className="grid gap-3">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-slate-700">Add insurance</span>
                    <input
                      value={insuranceDraft}
                      onChange={(e) => setInsuranceDraft(e.target.value)}
                      className="w-[320px] rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                      placeholder="e.g., UnitedHealthcare"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={addInsurance}
                    disabled={!canAddInsurance}
                    className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => void refreshInsurances()}
                    className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={saveInsuranceActiveChanges}
                    disabled={!canSaveActiveChanges}
                    className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>

                {insuranceError ? <div className="text-sm text-red-600">{insuranceError}</div> : null}
                {insuranceSuccess ? <div className="text-sm text-emerald-700">{insuranceSuccess}</div> : null}

                <div className="max-h-[360px] overflow-auto rounded-md border">
                  {insurances.length === 0 ? (
                    <div className="p-3 text-sm text-slate-600">No insurance options found.</div>
                  ) : (
                    <table className="w-full border-separate border-spacing-0">
                      <thead className="sticky top-0 bg-white">
                        <tr>
                          <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                            Insurance
                          </th>
                          <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                            Active
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {insurances.map((x) => (
                          <tr key={x.id} className="odd:bg-slate-50 hover:bg-slate-100">
                            <td className="border-b px-3 py-2 text-sm text-slate-800">{x.label}</td>
                            <td className="border-b px-3 py-2">
                              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={x.isActive}
                                  onChange={(e) => toggleInsuranceActive(x.id, e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300"
                                />
                                <span>{x.isActive ? 'Yes' : 'No'}</span>
                              </label>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'providers' ? (
            <div className="rounded-lg border bg-white p-4 text-sm text-slate-700">
              <div className="mb-3 text-sm font-semibold text-slate-900">Referral providers</div>

              <div className="grid gap-3">
                <div className="flex flex-wrap items-center gap-4 rounded-md border bg-white p-3">
                  <div className="text-xs font-semibold text-slate-700">Mode</div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={providerMode === 'new'}
                      onChange={() => setProviderMode('new')}
                    />
                    <span>New practice</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={providerMode === 'existing'}
                      onChange={() => setProviderMode('existing')}
                    />
                    <span>Existing practice</span>
                  </label>
                </div>

                {providerMode === 'new' ? (
                  <div className="grid gap-3 rounded-md border bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-700">New practice</div>

                    <div className="grid gap-2">
                      <label className="grid gap-1">
                        <span className="text-xs font-medium text-slate-700">Practice name</span>
                        <input
                          value={newPracticeNameDraft}
                          onChange={(e) => setNewPracticeNameDraft(e.target.value)}
                          className="w-[360px] rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                          placeholder="Practice name"
                        />
                      </label>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="grid gap-1">
                          <span className="text-xs font-medium text-slate-700">Provider name</span>
                          <input
                            value={newProviderNameDraft}
                            onChange={(e) => setNewProviderNameDraft(e.target.value)}
                            className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                            placeholder="Provider"
                          />
                        </label>

                        <label className="grid gap-1">
                          <span className="text-xs font-medium text-slate-700">Contact phone</span>
                          <input
                            value={newProviderPhoneDraft}
                            onChange={(e) => setNewProviderPhoneDraft(e.target.value)}
                            className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                            placeholder="Phone"
                          />
                        </label>

                        <label className="grid gap-1">
                          <span className="text-xs font-medium text-slate-700">Contact email</span>
                          <input
                            value={newProviderEmailDraft}
                            onChange={(e) => setNewProviderEmailDraft(e.target.value)}
                            className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                            placeholder="Email (required)"
                          />
                        </label>

                        <label className="grid gap-1">
                          <span className="text-xs font-medium text-slate-700">Address</span>
                          <input
                            value={newProviderAddressDraft}
                            onChange={(e) => setNewProviderAddressDraft(e.target.value)}
                            className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                            placeholder="Address"
                          />
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={addNewPracticeProvider}
                          disabled={!canAddNewPracticeProvider}
                          className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Add new provider
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {providerMode === 'existing' && isEditProviderOpen && editProviderId ? (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-lg">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">Edit provider</div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditProviderOpen(false)
                            setEditProviderId(null)
                            setEditProviderPractice('')
                          }}
                          className="rounded-md border bg-white px-2 py-1 text-sm hover:bg-slate-50"
                        >
                          Close
                        </button>
                      </div>

                      <div className="grid gap-2">
                        {editProviderModalError ? (
                          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {editProviderModalError}
                          </div>
                        ) : null}
                        <div className="text-xs font-semibold text-slate-700">Practice</div>
                        <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          {editProviderPractice}
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="grid gap-1">
                            <span className="text-xs font-medium text-slate-700">Provider name</span>
                            <input
                              value={editProviderNameDraft}
                              onChange={(e) => setEditProviderNameDraft(e.target.value)}
                              className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                              placeholder="Provider"
                            />
                          </label>

                          <label className="grid gap-1">
                            <span className="text-xs font-medium text-slate-700">Contact phone</span>
                            <input
                              value={editProviderPhoneDraft}
                              onChange={(e) => setEditProviderPhoneDraft(e.target.value)}
                              className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                              placeholder="Phone"
                            />
                          </label>

                          <label className="grid gap-1">
                            <span className="text-xs font-medium text-slate-700">Contact email</span>
                            <input
                              value={editProviderEmailDraft}
                              onChange={(e) => setEditProviderEmailDraft(e.target.value)}
                              className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                              placeholder="Email (required)"
                            />
                          </label>

                          <label className="grid gap-1">
                            <span className="text-xs font-medium text-slate-700">Address</span>
                            <input
                              value={editProviderAddressDraft}
                              onChange={(e) => setEditProviderAddressDraft(e.target.value)}
                              className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                              placeholder="Address"
                            />
                          </label>
                        </div>

                        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={editProviderActiveDraft}
                            onChange={(e) => setEditProviderActiveDraft(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span>Active</span>
                        </label>

                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditProviderOpen(false)
                              setEditProviderId(null)
                              setEditProviderPractice('')
                            }}
                            className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={applyEditProvider}
                            className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {providerMode === 'existing' ? (
                  <div className="grid gap-2 rounded-md border bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-700">Select practice</div>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="grid gap-1">
                        <span className="text-xs font-medium text-slate-700">Practice</span>
                        <select
                          value={existingPracticeSelected}
                          onChange={(e) => {
                            const v = e.target.value
                            setExistingPracticeSelected(v)
                            setNewProviderPracticeExisting(v)
                          }}
                          className="w-[360px] rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                        >
                          <option value="">Select practice</option>
                          {practices.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        type="button"
                        onClick={() => setIsAddProviderOpen(true)}
                        disabled={!existingPracticeSelected.trim()}
                        className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Add new provider
                      </button>
                    </div>
                  </div>
                ) : null}

                {providerMode === 'existing' && existingPracticeSelected.trim() ? (
                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void refreshProviders()}
                        className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        Refresh
                      </button>
                    </div>

                    <div className="max-h-[520px] overflow-auto rounded-md border">
                      {filteredProviders.length === 0 ? (
                        <div className="p-3 text-sm text-slate-600">No providers found for this practice.</div>
                      ) : (
                        <table className="w-full border-separate border-spacing-0">
                          <thead className="sticky top-0 bg-white">
                            <tr>
                              <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                                Practice
                              </th>
                              <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                                Provider
                              </th>
                              <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                                Phone
                              </th>
                              <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                                Email
                              </th>
                              <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                                Address
                              </th>
                              <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                                Active
                              </th>
                              <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredProviders.map((p) => (
                              <tr key={p.id} className="odd:bg-slate-50 hover:bg-slate-100">
                                <td className="border-b px-3 py-2 align-top text-sm text-slate-800">{p.practice}</td>
                                <td className="border-b px-3 py-2 align-top text-sm text-slate-800">{p.provider}</td>
                                <td className="border-b px-3 py-2 align-top text-sm text-slate-800">{p.contactPhone}</td>
                                <td className="border-b px-3 py-2 align-top text-sm text-slate-800">{p.contactEmail}</td>
                                <td className="border-b px-3 py-2 align-top text-sm text-slate-800">{p.address}</td>
                                <td className="border-b px-3 py-2 align-top text-sm text-slate-800">{p.isActive ? 'Yes' : 'No'}</td>
                                <td className="border-b px-3 py-2 align-top">
                                  <button
                                    type="button"
                                    onClick={() => void saveProviderRow(p.id)}
                                    disabled={!isProviderDirty(p) || savingProviderId === p.id}
                                    className={
                                      !isProviderDirty(p) || savingProviderId === p.id
                                        ? 'mr-2 rounded-md bg-emerald-200 px-3 py-1 text-sm font-medium text-white opacity-80'
                                        : 'mr-2 rounded-md bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700'
                                    }
                                  >
                                    {savingProviderId === p.id ? 'Saving…' : 'Save'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditProvider(p)}
                                    className="rounded-md border bg-white px-3 py-1 text-sm hover:bg-slate-50"
                                  >
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                ) : null}

                {providerMode === 'existing' && isAddProviderOpen ? (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-lg">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">Add new provider</div>
                        <button
                          type="button"
                          onClick={() => setIsAddProviderOpen(false)}
                          className="rounded-md border bg-white px-2 py-1 text-sm hover:bg-slate-50"
                        >
                          Close
                        </button>
                      </div>

                      <div className="grid gap-2">
                        {addProviderModalError ? (
                          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {addProviderModalError}
                          </div>
                        ) : null}
                        <div className="text-xs font-semibold text-slate-700">Practice</div>
                        <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          {existingPracticeSelected}
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="grid gap-1">
                            <span className="text-xs font-medium text-slate-700">Provider name</span>
                            <input
                              value={newProviderNameDraft}
                              onChange={(e) => setNewProviderNameDraft(e.target.value)}
                              className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                              placeholder="Provider"
                            />
                          </label>

                          <label className="grid gap-1">
                            <span className="text-xs font-medium text-slate-700">Contact phone</span>
                            <input
                              value={newProviderPhoneDraft}
                              onChange={(e) => setNewProviderPhoneDraft(e.target.value)}
                              className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                              placeholder="Phone"
                            />
                          </label>

                          <label className="grid gap-1">
                            <span className="text-xs font-medium text-slate-700">Contact email</span>
                            <input
                              value={newProviderEmailDraft}
                              onChange={(e) => setNewProviderEmailDraft(e.target.value)}
                              className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                              placeholder="Email (required)"
                            />
                          </label>

                          <label className="grid gap-1">
                            <span className="text-xs font-medium text-slate-700">Address</span>
                            <input
                              value={newProviderAddressDraft}
                              onChange={(e) => setNewProviderAddressDraft(e.target.value)}
                              className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                              placeholder="Address"
                            />
                          </label>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setIsAddProviderOpen(false)}
                            className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await addProvider()
                              setIsAddProviderOpen(false)
                            }}
                            disabled={!canAddProvider}
                            className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Add provider
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {providerError ? <div className="text-sm text-red-600">{providerError}</div> : null}
                {providerSuccess ? <div className="text-sm text-emerald-700">{providerSuccess}</div> : null}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
