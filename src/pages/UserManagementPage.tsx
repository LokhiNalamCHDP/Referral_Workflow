import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../components/AppHeader'
import { supabase } from '../lib/supabaseClient'
import type { Location, Role } from '../lib/accessTypes'

type UserAccessRow = {
  userId: string
  email: string
  displayName: string
  role: Role
  location: Location | null
  status: 'active' | 'disabled'
}

export default function UserManagementPage() {
  const [rows, setRows] = useState<UserAccessRow[]>([])
  const [originalRows, setOriginalRows] = useState<Record<string, UserAccessRow>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<Role>('guest')
  const [addLocation, setAddLocation] = useState<Location | ''>('')
  const [addStatus, setAddStatus] = useState<'active' | 'disabled'>('active')
  const [addError, setAddError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const roles = useMemo<Role[]>(() => ['admin', 'editor', 'guest'], [])
  const locations = useMemo<Location[]>(() => ['CH_Elko', 'CH_LakeHavasu', 'CH_Pahrump'], [])
  const statuses = useMemo<Array<'active' | 'disabled'>>(() => ['active', 'disabled'], [])

  const load = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    const { data, error: e } = await supabase
      .from('user_access')
      .select('user_id, email, display_name, role, location, status')
      .order('user_id', { ascending: true })

    if (e) {
      setRows([])
      setOriginalRows({})
      setError(e.message)
      setIsLoading(false)
      return
    }

    const nextRows: UserAccessRow[] = (data ?? []).map((r: any) => {
      const email = String(r.email ?? '').trim()
      const displayName = String(r.display_name ?? '').trim() || email
      const statusRaw = String(r.status ?? '').trim().toLowerCase()
      const status: 'active' | 'disabled' = statusRaw === 'disabled' ? 'disabled' : 'active'
      return {
        userId: String(r.user_id ?? ''),
        email,
        displayName,
        role: (String(r.role ?? 'guest') as Role) ?? 'guest',
        location: r.location == null ? null : (String(r.location) as Location),
        status,
      }
    })

    const nextOriginal: Record<string, UserAccessRow> = {}
    for (const r of nextRows) nextOriginal[r.userId] = r
    setRows(nextRows)
    setOriginalRows(nextOriginal)
    setIsLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const isRowDirty = (r: UserAccessRow) => {
    const o = originalRows[r.userId]
    if (!o) return true
    return o.role !== r.role || (o.location ?? null) !== (r.location ?? null) || o.status !== r.status
  }

  const saveRow = async (userId: string) => {
    const r = rows.find((x) => x.userId === userId)
    if (!r) return
    if (!isRowDirty(r)) return

    const locationToSave = r.role === 'admin' ? null : r.location

    setSavingUserId(userId)
    setError(null)
    setSuccess(null)

    const { error: e } = await supabase
      .from('user_access')
      .upsert(
        {
          user_id: userId,
          role: r.role,
          location: locationToSave,
          status: r.status,
        } as any,
        { onConflict: 'user_id' },
      )

    if (e) {
      setError(e.message)
      setSavingUserId(null)
      return
    }

    setSuccess('Saved')
    setOriginalRows((prev) => ({ ...prev, [userId]: r }))
    setSavingUserId(null)
  }

  const inviteUser = async () => {
    setAddError(null)
    setSuccess(null)
    const email = addEmail.trim()
    if (!email) {
      setAddError('Email is required')
      return
    }

    setIsAdding(true)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw new Error(sessionError.message)
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Not authenticated')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

      const res = await fetch(
        `${String(supabaseUrl).replace(/\/$/, '')}/functions/v1/admin-invite-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            email,
            role: addRole,
            location: addRole === 'admin' ? null : addLocation ? addLocation : null,
            status: addStatus,
          }),
        },
      )

      const raw = await res.text()
      let body: any = null
      try {
        body = JSON.parse(raw)
      } catch {
        body = { error: raw }
      }

      if (!res.ok) {
        throw new Error(String(body?.error ?? 'Invite failed'))
      }

      setIsAddOpen(false)
      setAddEmail('')
      setAddRole('guest')
      setAddLocation('')
      setAddStatus('active')
      setSuccess('User invited')
      await load()
    } catch (e: any) {
      setAddError(e?.message ?? 'Invite failed')
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader title="User management" subtitle="Admin only" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-700">
            {isLoading ? 'Loading…' : error ? error : success ? success : null}
          </div>
          <button
            type="button"
            onClick={() => {
              setAddError(null)
              setIsAddOpen(true)
            }}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Add user
          </button>
        </div>

        <div className="rounded-lg border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-separate border-spacing-0">
              <thead className="bg-white">
                <tr>
                  <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">Email</th>
                  <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">
                    Display name
                  </th>
                  <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">Role</th>
                  <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">Location</th>
                  <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">Status</th>
                  <th className="border-b px-3 py-2 text-left text-xs font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-600">
                      {isLoading ? 'Loading…' : 'No users found.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const dirty = isRowDirty(r)
                    const isSaving = savingUserId === r.userId

                    return (
                      <tr key={r.userId} className="odd:bg-slate-50 hover:bg-slate-100">
                        <td className="border-b px-3 py-2 text-sm text-slate-800">{r.email}</td>
                        <td className="border-b px-3 py-2 text-sm text-slate-800">{r.displayName}</td>
                        <td className="border-b px-3 py-2 text-sm text-slate-800">
                          <select
                            value={r.role}
                            onChange={(e) => {
                              const next = e.target.value as Role
                              setRows((prev) =>
                                prev.map((x) =>
                                  x.userId === r.userId
                                    ? { ...x, role: next, location: next === 'admin' ? null : x.location }
                                    : x,
                                ),
                              )
                            }}
                            className="w-full rounded-md border bg-white px-2 py-1 text-sm"
                          >
                            {roles.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border-b px-3 py-2 text-sm text-slate-800">
                          <select
                            value={r.location ?? ''}
                            onChange={(e) => {
                              const v = e.target.value
                              const next = v ? (v as Location) : null
                              setRows((prev) =>
                                prev.map((x) => (x.userId === r.userId ? { ...x, location: next } : x)),
                              )
                            }}
                            disabled={r.role === 'admin'}
                            className="w-full rounded-md border bg-white px-2 py-1 text-sm"
                          >
                            <option value="">(none)</option>
                            {locations.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border-b px-3 py-2 text-sm text-slate-800">
                          <select
                            value={r.status}
                            onChange={(e) => {
                              const next = (e.target.value as any) === 'disabled' ? 'disabled' : 'active'
                              setRows((prev) =>
                                prev.map((x) => (x.userId === r.userId ? { ...x, status: next } : x)),
                              )
                            }}
                            className="w-full rounded-md border bg-white px-2 py-1 text-sm"
                          >
                            {statuses.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border-b px-3 py-2 text-sm text-slate-800">
                          <button
                            type="button"
                            onClick={() => void saveRow(r.userId)}
                            disabled={!dirty || isSaving}
                            className={
                              !dirty || isSaving
                                ? 'rounded-md bg-emerald-200 px-3 py-1.5 text-sm font-semibold text-white opacity-80'
                                : 'rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700'
                            }
                          >
                            {isSaving ? 'Saving…' : 'Save'}
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {isAddOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsAddOpen(false)} />
          <div className="absolute left-1/2 top-1/2 w-[520px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-white p-5 shadow-xl">
            <div className="mb-3 text-sm font-semibold text-slate-900">Add user</div>

            <div className="grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-700">Email</span>
                <input
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-slate-700">Role</span>
                  <select
                    value={addRole}
                    onChange={(e) => {
                      const next = e.target.value as Role
                      setAddRole(next)
                      if (next === 'admin') setAddLocation('')
                    }}
                    className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                  >
                    {roles.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-slate-700">Location</span>
                  <select
                    value={addLocation}
                    onChange={(e) => setAddLocation(e.target.value as any)}
                    disabled={addRole === 'admin'}
                    className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                  >
                    <option value="">(none)</option>
                    {locations.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-700">Status</span>
                <select
                  value={addStatus}
                  onChange={(e) => setAddStatus((e.target.value as any) === 'disabled' ? 'disabled' : 'active')}
                  className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                >
                  {statuses.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>

              {addError ? <div className="text-sm text-red-600">{addError}</div> : null}

              <div className="mt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void inviteUser()}
                  disabled={isAdding}
                  className={
                    isAdding
                      ? 'rounded-md bg-emerald-200 px-3 py-2 text-sm font-semibold text-white opacity-80'
                      : 'rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700'
                  }
                >
                  {isAdding ? 'Inviting…' : 'Invite user'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
