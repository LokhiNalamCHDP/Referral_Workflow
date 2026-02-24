import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, ReactNode } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import { supabase } from '../lib/supabaseClient'
import useLocalStorageState from '../lib/useLocalStorageState'
import { useSupabaseAuth } from '../lib/useSupabaseAuth'
import { useAccess } from '../lib/AccessProvider'
import { canEdit } from '../lib/permissions'

type FieldType = 'text' | 'checkbox' | 'date' | 'datetime'

type ColumnDef = {
  key: string
  label: string
  type: FieldType
}

type RowValue = string | boolean

type Row = {
  id: string
  archived?: boolean
} & Record<string, RowValue>

type ReferralProviderOption = {
  id: string
  referral_provider: string
  provider_practice: string | null
}

const OTHER_PROVIDER_VALUE = '__other__'
const UNKNOWN_PROVIDER_VALUE = '__unknown__'
const UNKNOWN_PROVIDER_LABEL = 'Unknown Referral Provider'
const OTHER_PROVIDER_PRACTICE_VALUE = '__other_practice__'
const REFERRING_PROVIDER_PRACTICE_KEY = 'referringProviderPractice'

const SPECIALTIES = [
  'Colonoscopy and EGD',
  'General Surgery',
  'Spine Neuro Rajamand',
  'Ortho',
  'Ophthalmology',
  'IR Carlevato',
  'Heme Onc Rice',
  'Infusion',
  "Women's Health",
  'Cardio Deschutter',
  'Singh Cancellations',
  'Hernia Sx Waitlist',
] as const

const INSURANCE_OPTIONS = [
  '',
  'Medicare',
  'Medicaid',
  'Commercial',
  'Self Pay',
  'Cash Pay',
  'Workers’ Compensation',
  'Accident / Liability',
] as const

const FORM_RECEIVED_OPTIONS = ['', 'Yes- Direct', 'Yes- Consult', 'No'] as const

const STATUS_OPTIONS = [
  '',
  'NEW_REFERRAL',
  'IN_PROGRESS',
  'APPT_SCHEDULED',
  'NO_RESPONSE_3_ATTEMPTS',
  'NOT_INTERESTED',
  'CANCELLED/ NO_SHOW',
] as const

function statusLabel(value: string) {
  switch (value) {
    case 'NEW_REFERRAL':
      return 'New referral'
    case 'IN_PROGRESS':
      return 'In progress'
    case 'APPT_SCHEDULED':
      return 'Appt scheduled'
    case 'NO_RESPONSE_3_ATTEMPTS':
      return 'No response (3 attempts)'
    case 'NOT_INTERESTED':
      return 'Not interested'
    case 'CANCELLED/ NO_SHOW':
      return 'Cancelled / No show'
    default:
      return value
  }
}

type Specialty = (typeof SPECIALTIES)[number]

const SPECIALTY_TABLES: Record<Specialty, string> = {
  'Colonoscopy and EGD': 'referrals_colonoscopy_egd',
  'General Surgery': 'referrals_general_surgery',
  'Spine Neuro Rajamand': 'referrals_spine_neuro_rajamand',
  Ortho: 'referrals_ortho',
  Ophthalmology: 'referrals_ophthalmology',
  'IR Carlevato': 'referrals_ir_carlevato',
  'Heme Onc Rice': 'referrals_heme_onc_rice',
  Infusion: 'referrals_infusion',
  "Women's Health": 'referrals_womens_health',
  'Cardio Deschutter': 'referrals_cardio_deschutter',
  'Singh Cancellations': 'referrals_singh_cancellations',
  'Hernia Sx Waitlist': 'referrals_hernia_sx_waitlist',
}

function toIsoDateOnly(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function toIsoDateTime(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

 function toDateTimeLocalValue(value: unknown) {
   if (typeof value !== 'string' || !value.trim()) return ''
   const d = new Date(value)
   if (Number.isNaN(d.getTime())) return ''

   const pad2 = (n: number) => String(n).padStart(2, '0')
   const yyyy = d.getFullYear()
   const mm = pad2(d.getMonth() + 1)
   const dd = pad2(d.getDate())
   const hh = pad2(d.getHours())
   const min = pad2(d.getMinutes())
   return `${yyyy}-${mm}-${dd}T${hh}:${min}`
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

const SCHEMAS: Record<Specialty, ColumnDef[]> = {
  'Colonoscopy and EGD': [
    { key: 'dateReferralReceived', label: 'Date Referral Received', type: 'date' },
    { key: 'patientName', label: 'Patient Name', type: 'text' },
    { key: 'dob', label: 'DOB', type: 'date' },
    { key: 'phoneNumber', label: 'Phone Number', type: 'text' },
    { key: 'insurance', label: 'Insurance', type: 'text' },
    { key: 'referringProvider', label: 'Referral Provider', type: 'text' },
    { key: 'reason', label: 'Reason', type: 'text' },
    { key: 'formsSent', label: 'Forms Sent', type: 'checkbox' },
    { key: 'formReceived', label: 'Form Received', type: 'text' },
    { key: 'calledToSchedule', label: 'Called to schedule', type: 'checkbox' },
    { key: 'prepInstructionSent', label: 'Prep Instruction sent', type: 'checkbox' },
    { key: 'firstPatientCommunication', label: '1st patient communication', type: 'datetime' },
    { key: 'secondPatientCommunication', label: '2nd patient communication', type: 'datetime' },
    { key: 'thirdPatientCommunication', label: '3rd patient communication', type: 'datetime' },
    { key: 'apptDateTime', label: 'Appt date/time', type: 'datetime' },
    { key: 'notes', label: 'Notes', type: 'text' },
  ],
  'General Surgery': [
    { key: 'dateReferralReceived', label: 'Date Referral Received', type: 'date' },
    { key: 'patientName', label: 'Patient Name', type: 'text' },
    { key: 'dob', label: 'DOB', type: 'date' },
    { key: 'phoneNumber', label: 'Phone', type: 'text' },
    { key: 'insurance', label: 'Insurance', type: 'text' },
    {
      key: 'referringProvider',
      label: 'Referral Provider',
      type: 'text',
    },
    { key: 'reason', label: 'Reason', type: 'text' },
    {
      key: 'firstPatientCommunication',
      label: '1st Communication',
      type: 'datetime',
    },
    {
      key: 'secondPatientCommunication',
      label: '2nd Communication',
      type: 'datetime',
    },
    {
      key: 'thirdPatientCommunication',
      label: '3rd Communication',
      type: 'datetime',
    },
    { key: 'apptDateTime', label: 'Appt date and time', type: 'datetime' },
    { key: 'notes', label: 'Notes', type: 'text' },
  ],
  'Spine Neuro Rajamand': [
    { key: 'dateReferralReceived', label: 'Date Referral Received', type: 'date' },
    { key: 'patientName', label: 'Patient Name', type: 'text' },
    { key: 'dob', label: 'DOB', type: 'date' },
    { key: 'phoneNumber', label: 'Phone', type: 'text' },
    { key: 'insurance', label: 'Insurance', type: 'text' },
    { key: 'referringProvider', label: 'Referral Provider', type: 'text' },
    { key: 'reason', label: 'Reason', type: 'text' },
    {
      key: 'firstPatientCommunication',
      label: '1st Communication',
      type: 'datetime',
    },
    {
      key: 'secondPatientCommunication',
      label: '2nd Communication',
      type: 'datetime',
    },
    {
      key: 'thirdPatientCommunication',
      label: '3rd Communication',
      type: 'datetime',
    },
    { key: 'apptDateTime', label: 'Appt date and time', type: 'datetime' },
    { key: 'notes', label: 'Notes', type: 'text' },
  ],
  Ortho: [
    { key: 'dateReferralReceived', label: 'Date Referral Received', type: 'date' },
    { key: 'patientName', label: 'Patient Name', type: 'text' },
    { key: 'dob', label: 'DOB', type: 'date' },
    { key: 'phoneNumber', label: 'Phone', type: 'text' },
    { key: 'insurance', label: 'Insurance', type: 'text' },
    { key: 'referringProvider', label: 'Referral Provider', type: 'text' },
    { key: 'reason', label: 'Reason', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'text' },
    { key: 'firstPatientCommunication', label: '1st Communication', type: 'datetime' },
    { key: 'secondPatientCommunication', label: '2nd Communication', type: 'datetime' },
    { key: 'thirdPatientCommunication', label: '3rd Communication', type: 'datetime' },
    { key: 'apptDateTime', label: 'Appt date and time', type: 'datetime' },
    { key: 'notes2', label: 'Notes 2', type: 'text' },
  ],
  Ophthalmology: [
    { key: 'dateReferralReceived', label: 'Date Referral Received', type: 'date' },
    { key: 'patientName', label: 'Patient Name', type: 'text' },
    { key: 'dob', label: 'DOB', type: 'date' },
    { key: 'phoneNumber', label: 'Phone', type: 'text' },
    { key: 'insurance', label: 'Insurance', type: 'text' },
    { key: 'referringProvider', label: 'Referral Provider', type: 'text' },
    { key: 'reason', label: 'Reason', type: 'text' },
    {
      key: 'firstPatientCommunication',
      label: '1st Communication',
      type: 'datetime',
    },
    {
      key: 'secondPatientCommunication',
      label: '2nd Communication',
      type: 'datetime',
    },
    {
      key: 'thirdPatientCommunication',
      label: '3rd Communication',
      type: 'datetime',
    },
    { key: 'apptDateTime', label: 'Appt date and time', type: 'datetime' },
  ],
  'IR Carlevato': [
    { key: 'dateReferralReceived', label: 'Date Referral Received', type: 'date' },
    { key: 'patientName', label: 'Patient Name', type: 'text' },
    { key: 'dob', label: 'DOB', type: 'date' },
    { key: 'phoneNumber', label: 'Phone', type: 'text' },
    { key: 'insurance', label: 'Insurance', type: 'text' },
    { key: 'referringProvider', label: 'Referral Provider', type: 'text' },
    { key: 'reason', label: 'Reason', type: 'text' },
    {
      key: 'firstPatientCommunication',
      label: '1st Communication',
      type: 'datetime',
    },
    {
      key: 'secondPatientCommunication',
      label: '2nd Communication',
      type: 'datetime',
    },
    {
      key: 'thirdPatientCommunication',
      label: '3rd Communication',
      type: 'datetime',
    },
    { key: 'apptDateTime', label: 'Appt date and time', type: 'datetime' },
  ],
  'Heme Onc Rice': [
    { key: 'dateReferralReceived', label: 'Date Referral Received', type: 'date' },
    { key: 'patientName', label: 'Patient Name', type: 'text' },
    { key: 'dob', label: 'DOB', type: 'date' },
    { key: 'phoneNumber', label: 'Phone', type: 'text' },
    { key: 'insurance', label: 'Insurance', type: 'text' },
    { key: 'ngmPatient', label: 'NGM Patient?', type: 'checkbox' },
    { key: 'referringProvider', label: 'Referral Provider', type: 'text' },
    { key: 'reason', label: 'Reason', type: 'text' },
    {
      key: 'firstPatientCommunication',
      label: '1st Communication',
      type: 'datetime',
    },
    {
      key: 'secondPatientCommunication',
      label: '2nd Communication',
      type: 'datetime',
    },
    {
      key: 'thirdPatientCommunication',
      label: '3rd Communication',
      type: 'datetime',
    },
    { key: 'apptDateTime', label: 'Appt date and time', type: 'datetime' },
    { key: 'notes', label: 'Notes', type: 'text' },
  ],
  Infusion: [
    { key: 'dateReferralReceived', label: 'Date Referral Received', type: 'date' },
    { key: 'patientName', label: 'Patient Name', type: 'text' },
    { key: 'dob', label: 'DOB', type: 'date' },
    { key: 'phoneNumber', label: 'Phone', type: 'text' },
    { key: 'insurance', label: 'Insurance', type: 'text' },
    { key: 'ngmPatient', label: 'NGM Patient', type: 'checkbox' },
    { key: 'referringProvider', label: 'Referral Provider', type: 'text' },
    { key: 'reason', label: 'Reason', type: 'text' },
    {
      key: 'firstPatientCommunication',
      label: '1st Communication',
      type: 'datetime',
    },
    {
      key: 'secondPatientCommunication',
      label: '2nd Communication',
      type: 'datetime',
    },
    {
      key: 'thirdPatientCommunication',
      label: '3rd Communication',
      type: 'datetime',
    },
    { key: 'apptDateTime', label: 'Appt date and time', type: 'datetime' },
  ],
  "Women's Health": [
    { key: 'dateReferralReceived', label: 'Date Referral Received', type: 'date' },
    { key: 'patientName', label: 'Patient Name', type: 'text' },
    { key: 'dob', label: 'DOB', type: 'date' },
    { key: 'phoneNumber', label: 'Phone', type: 'text' },
    { key: 'insurance', label: 'Insurance', type: 'text' },
    { key: 'referringProvider', label: 'Referral Provider', type: 'text' },
    { key: 'reason', label: 'Reason', type: 'text' },
    {
      key: 'firstPatientCommunication',
      label: '1st Communication',
      type: 'datetime',
    },
    {
      key: 'secondPatientCommunication',
      label: '2nd Communication',
      type: 'datetime',
    },
    {
      key: 'thirdPatientCommunication',
      label: '3rd Communication',
      type: 'datetime',
    },
    { key: 'apptDateTime', label: 'Appt date and time', type: 'datetime' },
    { key: 'notes', label: 'Notes', type: 'text' },
  ],
  'Cardio Deschutter': [
    { key: 'dateReferralReceived', label: 'Date Referral Received', type: 'date' },
    { key: 'patientName', label: 'Patient Name', type: 'text' },
    { key: 'dob', label: 'DOB', type: 'date' },
    { key: 'phoneNumber', label: 'Phone', type: 'text' },
    { key: 'insurance', label: 'Insurance', type: 'text' },
    {
      key: 'referringProvider',
      label: 'Referral Provider',
      type: 'text',
    },
    { key: 'reason', label: 'Reason', type: 'text' },
    {
      key: 'firstPatientCommunication',
      label: '1st Communication',
      type: 'datetime',
    },
    {
      key: 'secondPatientCommunication',
      label: '2nd Communication',
      type: 'datetime',
    },
    {
      key: 'thirdPatientCommunication',
      label: '3rd Communication',
      type: 'datetime',
    },
    { key: 'apptDateTime', label: 'Appt date and time', type: 'datetime' },
  ],
  'Singh Cancellations': [
    { key: 'needsCall', label: 'Needs Call', type: 'checkbox' },
    { key: 'dateCancelled', label: 'Date Cancelled', type: 'date' },
    { key: 'patientName', label: 'Patient Name', type: 'text' },
    { key: 'dob', label: 'DOB', type: 'date' },
    { key: 'phoneNumber', label: 'Phone', type: 'text' },
    { key: 'insurance', label: 'Insurance', type: 'text' },
    { key: 'reason', label: 'Reason', type: 'text' },
    {
      key: 'firstPatientCommunication',
      label: '1st Communication',
      type: 'datetime',
    },
    {
      key: 'secondPatientCommunication',
      label: '2nd Communication',
      type: 'datetime',
    },
    {
      key: 'thirdPatientCommunication',
      label: '3rd Communication',
      type: 'datetime',
    },
    { key: 'apptDateTime', label: 'Appt date and time', type: 'datetime' },
    { key: 'notes', label: 'Notes', type: 'text' },
  ],
  'Hernia Sx Waitlist': [
    { key: 'dateReferralReceived', label: 'Date Referral Received', type: 'date' },
    { key: 'patientName', label: 'Patient Name', type: 'text' },
    { key: 'dob', label: 'DOB', type: 'date' },
    { key: 'phoneNumber', label: 'Phone', type: 'text' },
    { key: 'insurance', label: 'Insurance', type: 'text' },
    { key: 'reason', label: 'Reason', type: 'text' },
    {
      key: 'firstPatientCommunication',
      label: '1st Communication',
      type: 'datetime',
    },
    {
      key: 'secondPatientCommunication',
      label: '2nd Communication',
      type: 'datetime',
    },
    {
      key: 'thirdPatientCommunication',
      label: '3rd Communication',
      type: 'datetime',
    },
    { key: 'apptDateTime', label: 'Appt date and time', type: 'datetime' },
  ],
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getPatientNameForPrompt(row: Row) {
  const direct = row.patientName
  if (typeof direct === 'string' && direct.trim()) return direct.trim()

  for (const [k, v] of Object.entries(row)) {
    if (k === 'id' || k === 'archived') continue
    if (!k.toLowerCase().includes('patient')) continue
    if (!k.toLowerCase().includes('name')) continue
    if (typeof v === 'string' && v.trim()) return v.trim()
  }

  return ''
}

function createEmptyDraft(schema: ColumnDef[]) {
  const out: Record<string, RowValue> = {}
  for (const col of schema) {
    out[col.key] = col.type === 'checkbox' ? false : ''
  }
  return out
}

function parseDateForFilter(v: unknown) {
  if (typeof v !== 'string' || !v.trim()) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  d.setHours(0, 0, 0, 0)
  return d
}

function normalizeBoolean(v: unknown) {
  return v === true
}

function normalizeBooleanLoose(v: unknown) {
  if (v === true) return true
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    return s === 'true' || s === 'yes' || s === 'y' || s === '1' || s === 'x'
  }
  return false
}

function normalizeFormReceived(v: unknown) {
  if (typeof v === 'string') return v
  if (v === true) return 'Yes- Direct'
  if (v === false) return 'No'
  return ''
}

function withReferringProviderPractice(schema: ColumnDef[]): ColumnDef[] {
  const already = schema.some((c) => c.key === REFERRING_PROVIDER_PRACTICE_KEY)
  if (already) return schema

  const idx = schema.findIndex(
    (c) => c.key === 'referringProvider' || /referring\s*provider/i.test(c.label),
  )
  if (idx < 0) return schema

  const practiceCol: ColumnDef = {
    key: REFERRING_PROVIDER_PRACTICE_KEY,
    label: 'Referral Provider Practice',
    type: 'text',
  }

  return [...schema.slice(0, idx), practiceCol, ...schema.slice(idx)]
}

function withReasonNotesAfterReferringProvider(schema: ColumnDef[]): ColumnDef[] {
  const rpIdx = schema.findIndex(
    (c) => c.key === 'referringProvider' || /referring\s*provider/i.test(c.label),
  )
  if (rpIdx < 0) return schema

  const reasonCol = schema.find((c) => c.key === 'reason' || /^reason$/i.test(c.label.trim()))
  const notesCol = schema.find((c) => c.key === 'notes' || /^notes$/i.test(c.label.trim()))
  if (!reasonCol && !notesCol) return schema

  const filtered = schema.filter((c) => c !== reasonCol && c !== notesCol)
  const insertAt = filtered.findIndex(
    (c) => c.key === 'referringProvider' || /referring\s*provider/i.test(c.label),
  )
  if (insertAt < 0) return schema

  const extras: ColumnDef[] = []
  if (reasonCol) extras.push(reasonCol)
  if (notesCol) extras.push(notesCol)
  return [...filtered.slice(0, insertAt + 1), ...extras, ...filtered.slice(insertAt + 1)]
}

function withStatusEmailSentAfterApptDateTime(schema: ColumnDef[]): ColumnDef[] {
  const alreadyHasStatus = schema.some((c) => c.key === 'status')
  const alreadyHasStatusUpdatedAt = schema.some((c) => c.key === 'statusUpdatedAt')
  const alreadyHasEmailSentAt = schema.some((c) => c.key === 'emailSentAt')
  if (alreadyHasStatus && alreadyHasStatusUpdatedAt && alreadyHasEmailSentAt) return schema

  const idx = schema.findIndex((c) => c.key === 'apptDateTime')
  if (idx < 0) return schema

  const additions: ColumnDef[] = []
  if (!alreadyHasStatus) {
    additions.push({ key: 'status', label: 'Status', type: 'text' })
  }
  if (!alreadyHasStatusUpdatedAt) {
    additions.push({ key: 'statusUpdatedAt', label: 'Status Updated Date', type: 'datetime' })
  }
  if (!alreadyHasEmailSentAt) {
    additions.push({ key: 'emailSentAt', label: 'Email Sent At', type: 'datetime' })
  }

  return [...schema.slice(0, idx + 1), ...additions, ...schema.slice(idx + 1)]
}

function withStatusAfterApptDateTime(schema: ColumnDef[]): ColumnDef[] {
  const alreadyHasStatus = schema.some((c) => c.key === 'status')
  if (alreadyHasStatus) return schema

  const idx = schema.findIndex((c) => c.key === 'apptDateTime')
  if (idx < 0) return schema

  const statusCol: ColumnDef = { key: 'status', label: 'Status', type: 'text' }
  return [...schema.slice(0, idx + 1), statusCol, ...schema.slice(idx + 1)]
}

export default function ReferralTablePage() {
  const navigate = useNavigate()
  const { session } = useSupabaseAuth()
  const access = useAccess()
  const canEditRows = canEdit(access.access?.role)

  const [activeSpecialty, setActiveSpecialty] = useState<Specialty>(SPECIALTIES[0])

  const baseSchema = useMemo(() => {
    const withPractice = withReferringProviderPractice(SCHEMAS[activeSpecialty])
    const withReasonNotes =
      activeSpecialty === 'Colonoscopy and EGD'
        ? withReasonNotesAfterReferringProvider(withPractice)
        : withPractice
    return withStatusEmailSentAfterApptDateTime(withReasonNotes)
  }, [activeSpecialty])
  const schema = useMemo(
    () => baseSchema,
    [baseSchema],
  )
  const [rows, setRows] = useState<Row[]>([])
  const [isRowsLoading, setIsRowsLoading] = useState(false)
  const [rowsError, setRowsError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [providerOptions, setProviderOptions] = useState<ReferralProviderOption[]>([])
  const [insuranceOptions, setInsuranceOptions] = useState<string[]>(() => [...INSURANCE_OPTIONS])

  useEffect(() => {
    if (providerOptions.length === 0) return
    setRows((prev) =>
      prev.map((r) => {
        const providerId = typeof r.referringProviderId === 'string' ? r.referringProviderId : ''
        if (!providerId || providerId === OTHER_PROVIDER_VALUE || providerId === UNKNOWN_PROVIDER_VALUE)
          return r
        const p = providerOptions.find((x) => String(x.id) === String(providerId))
        if (!p) return r
        const providerName = (p.referral_provider ?? '').trim()
        const practice = (p.provider_practice ?? '').trim()
        const practiceSame = String(r[REFERRING_PROVIDER_PRACTICE_KEY] ?? '') === practice
        const providerSame = String(r.referringProvider ?? '') === providerName
        if (practiceSame && providerSame) return r
        return { ...r, referringProvider: providerName, [REFERRING_PROVIDER_PRACTICE_KEY]: practice }
      }),
    )
  }, [providerOptions])

  useEffect(() => {
    let isMounted = true

    void (async () => {
      const { data, error } = await supabase
        .from('referral_providers')
        .select('id, referral_provider, provider_practice')
        .order('referral_provider', { ascending: true })

      if (!isMounted) return
      if (error) {
        setProviderOptions([])
        return
      }
      setProviderOptions((data ?? []) as any)
    })()

    return () => {
      isMounted = false
    }
  }, [])

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

  useEffect(() => {
    let isMounted = true

    void (async () => {
      const { data, error } = await supabase.from('insurances').select('*')
      if (!isMounted) return
      if (error) return

      const next = Array.from(
        new Set((data ?? []).map(insuranceRowLabel).map((v) => v.trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b))

      setInsuranceOptions(['', ...next])
    })()

    return () => {
      isMounted = false
    }
  }, [])

  function providerLabel(p: ReferralProviderOption) {
    return (p.referral_provider ?? '').trim()
  }

  function mapColonoscopyEgdRecordToRow(r: any, schemaForRow: ColumnDef[]): Row {
    const out: Row = {
      id: String(r.id ?? ''),
      archived: typeof r.record_status === 'string' ? r.record_status !== 'active' : false,
    }

    out.referringProviderId = r.referral_provider_id != null ? String(r.referral_provider_id) : ''
    ;(out as any).provider_practice = r.provider_practice
    ;(out as any).providerPractice = r.provider_practice

    const mapped: Record<string, unknown> = {
      dateReferralReceived: r.date_referral_received,
      patientName: r.patient_name,
      dob: r.dob,
      phoneNumber: r.phone,
      insurance: r.insurance,
      referringProvider: r.referral_provider,
      referringProviderId: r.referral_provider_id != null ? String(r.referral_provider_id) : '',
      reason: r.reason,
      formsSent: r.forms_sent === true,
      formReceived: normalizeFormReceived(r.form_received),
      calledToSchedule: r.called_to_schedule,
      prepInstructionSent: r.prep_instruction_sent,
      firstPatientCommunication: r.communication_1,
      secondPatientCommunication: r.communication_2,
      thirdPatientCommunication: r.communication_3,
      apptDateTime: r.appt_date_time,
      status: r.status,
      statusUpdatedAt: r.status_updated_at,
      emailSentAt: r.email_sent_at,
      notes: r.notes,
    }

    for (const col of schemaForRow) {
      const raw = mapped[col.key]
      out[col.key] = col.type === 'checkbox' ? normalizeBooleanLoose(raw) : String(raw ?? '')
    }

    return out
  }

  function mapReferralTableRecordToRow(r: any, schemaForRow: ColumnDef[]): Row {
    const out: Row = {
      id: String(r.id ?? ''),
      archived: typeof r.record_status === 'string' ? r.record_status !== 'active' : false,
    }

    out.referringProviderId = r.referral_provider_id != null ? String(r.referral_provider_id) : ''
    ;(out as any).provider_practice = r.provider_practice
    ;(out as any).providerPractice = r.provider_practice

    const mapped: Record<string, unknown> = {
      dateReferralReceived: r.date_referral_received,
      patientName: r.patient_name,
      dob: r.dob,
      phoneNumber: r.phone,
      insurance: r.insurance,
      ngmPatient: r.ngm_patient,
      referringProvider: r.referral_provider,
      referringProviderId: r.referral_provider_id != null ? String(r.referral_provider_id) : '',
      reason: r.reason,
      formsSent: r.forms_sent === true,
      formReceived: normalizeFormReceived(r.form_received),
      calledToSchedule: r.called_to_schedule,
      prepInstructionSent: r.prep_instruction_sent,
      firstPatientCommunication: r.communication_1,
      secondPatientCommunication: r.communication_2,
      thirdPatientCommunication: r.communication_3,
      apptDateTime: r.appt_date_time,
      status: r.status,
      statusUpdatedAt: r.status_updated_at,
      emailSentAt: r.email_sent_at,
      notes: r.notes,
      notes2: r.notes_2 ?? r.notes2,
    }

    for (const col of schemaForRow) {
      const raw = mapped[col.key]
      out[col.key] = col.type === 'checkbox' ? normalizeBooleanLoose(raw) : String(raw ?? '')
    }

    return out
  }

  function mapGeneralSurgeryRecordToRow(r: any, schemaForRow: ColumnDef[]): Row {
    const out: Row = {
      id: String(r.id ?? ''),
      archived: typeof r.record_status === 'string' ? r.record_status !== 'active' : false,
    }

    out.referringProviderId = r.referral_provider_id != null ? String(r.referral_provider_id) : ''
    ;(out as any).provider_practice = r.provider_practice
    ;(out as any).providerPractice = r.provider_practice

    const mapped: Record<string, unknown> = {
      dateReferralReceived: r.date_referral_received,
      patientName: r.patient_name,
      dob: r.dob,
      phoneNumber: r.phone,
      insurance: r.insurance,
      referringProvider: r.referral_provider,
      referringProviderId: r.referral_provider_id != null ? String(r.referral_provider_id) : '',
      reason: r.reason,
      firstPatientCommunication: r.communication_1,
      secondPatientCommunication: r.communication_2,
      thirdPatientCommunication: r.communication_3,
      apptDateTime: r.appt_date_time,
      status: r.status,
      statusUpdatedAt: r.status_updated_at,
      emailSentAt: r.email_sent_at,
      notes: r.notes,
    }

    for (const col of schemaForRow) {
      const raw = mapped[col.key]
      out[col.key] = col.type === 'checkbox' ? normalizeBooleanLoose(raw) : String(raw ?? '')
    }

    return out
  }

  function mapSupabaseRecordToRow(r: any, schemaForRow: ColumnDef[]): Row {
    const out: Row = {
      id: String(r.id ?? r.uuid ?? r.row_id ?? ''),
      archived: r.archived === true,
    }

    const payload: Record<string, unknown> =
      r && typeof r === 'object' && r.data && typeof r.data === 'object' ? (r.data as any) : r

    if (payload && 'referringProviderId' in payload) {
      out.referringProviderId = String((payload as any).referringProviderId ?? '')
    }

    for (const col of schemaForRow) {
      const raw =
        col.key === 'statusUpdatedAt'
          ? (payload as any)?.status_updated_at ?? (payload as any)?.statusUpdatedAt
          : col.key === 'emailSentAt'
            ? (payload as any)?.email_sent_at ?? (payload as any)?.emailSentAt
            : payload?.[col.key]
      out[col.key] = col.type === 'checkbox' ? normalizeBooleanLoose(raw) : String(raw ?? '')
    }

    return out
  }

  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) return

    let isMounted = true
    setIsRowsLoading(true)
    setRowsError(null)

    void (async () => {
      const tableName = SPECIALTY_TABLES[activeSpecialty]

      const query = tableName
        ? supabase.from(tableName).select('*').eq('record_status', 'active')
        : supabase
            .from('referrals')
            .select('id, archived, data, created_at')
            .eq('user_id', uid)
            .eq('specialty', activeSpecialty)

      const { data, error } = await query.order('created_at', { ascending: false })

      if (!isMounted) return

      if (error) {
        setRows([])
        setRowsError(error.message)
        setIsRowsLoading(false)
        return
      }

      const next: Row[] = (data ?? []).map((r: any) =>
        tableName ? mapReferralTableRecordToRow(r, baseSchema) : mapSupabaseRecordToRow(r, baseSchema),
      )

      setRows(next)
      setIsRowsLoading(false)
    })()

    return () => {
      isMounted = false
    }
  }, [activeSpecialty, baseSchema, session?.user?.id])

  const [searchBy, setSearchBy] = useState<string>('__all__')
  const [searchText, setSearchText] = useState('')

  const dateColumns = useMemo(
    () => schema.filter((c) => c.type === 'date' || c.type === 'datetime'),
    [schema],
  )

  const defaultDateKey = useMemo(() => {
    const preferred = dateColumns.find((c) => c.key === 'dateReferralReceived')
    return preferred?.key ?? '__none__'
  }, [dateColumns])

  const [dateFilterKey, setDateFilterKey] = useState<string>(defaultDateKey)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    setDateFilterKey((prev) => {
      if (prev === '__none__') return defaultDateKey
      if (dateColumns.some((c) => c.key === prev)) return prev
      return defaultDateKey
    })
  }, [dateColumns, defaultDateKey])

  const [sortBy, setSortBy] = useState<string>('__none__')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const [isFreezeOpen, setIsFreezeOpen] = useState(false)
  const [pinnedKeys, setPinnedKeys] = useState<string[]>([])
  const tableRef = useRef<HTMLTableElement | null>(null)
  const [pinnedLeftOffsets, setPinnedLeftOffsets] = useState<number[]>([])
  const freezeMenuRef = useRef<HTMLDivElement | null>(null)

  function downloadCsv() {
    const header = schema.map((c) => c.label)
    const keys = schema.map((c) => c.key)

    const escape = (v: unknown) => {
      const s = String(v ?? '')
      const needsQuotes = /[",\n\r]/.test(s)
      const escaped = s.replace(/"/g, '""')
      return needsQuotes ? `"${escaped}"` : escaped
    }

    const lines = [header.map(escape).join(',')]
    for (const r of sortedRows) {
      lines.push(keys.map((k) => escape(r[k])).join(','))
    }

    const csv = `${lines.join('\n')}\n`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slugify(activeSpecialty)}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const filteredRows = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    const base = rows.filter((r) => r.archived !== true)

    const from = dateFrom ? parseDateForFilter(dateFrom) : null
    const to = dateTo ? parseDateForFilter(dateTo) : null
    const toInclusive = to ? new Date(to) : null
    if (toInclusive) toInclusive.setDate(toInclusive.getDate() + 1)

    const dateFiltered =
      dateFilterKey === '__none__' || (!from && !toInclusive)
        ? base
        : base.filter((r) => {
            const d = parseDateForFilter(r[dateFilterKey])
            if (!d) return false
            if (from && d < from) return false
            if (toInclusive && d >= toInclusive) return false
            return true
          })

    if (!q) return dateFiltered

    const searchColKeys = searchBy === '__all__' ? schema.map((c) => c.key) : [searchBy]

    return dateFiltered.filter((r) => {
      for (const k of searchColKeys) {
        const v = r[k]
        const asString = typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v ?? '')
        if (asString.toLowerCase().includes(q)) return true
      }
      return false
    })
  }, [rows, schema, searchBy, searchText, dateFilterKey, dateFrom, dateTo])

  const sortedRows = useMemo(() => {
    if (sortBy === '__none__') return filteredRows

    const direction = sortDir === 'asc' ? 1 : -1
    const sorted = [...filteredRows]

    sorted.sort((a, b) => {
      const av = a[sortBy]
      const bv = b[sortBy]

      if (typeof av === 'boolean' && typeof bv === 'boolean') {
        if (av === bv) return 0
        return av ? 1 * direction : -1 * direction
      }

      const as = String(av ?? '').toLowerCase()
      const bs = String(bv ?? '').toLowerCase()

      if (as === bs) return 0
      return as < bs ? -1 * direction : 1 * direction
    })

    return sorted
  }, [filteredRows, sortBy, sortDir])

  useEffect(() => {
    setPinnedKeys((prev) => prev.filter((k) => schema.some((c) => c.key === k)))
  }, [schema])

  useEffect(() => {
    if (!isFreezeOpen) return

    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node | null
      if (!target) return
      if (freezeMenuRef.current && freezeMenuRef.current.contains(target)) return
      setIsFreezeOpen(false)
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [isFreezeOpen])

  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorSpecialty, setEditorSpecialty] = useState<Specialty>(SPECIALTIES[0])
  const editorSchema = useMemo(
    () => {
      const withPractice = withReferringProviderPractice(SCHEMAS[editorSpecialty])
      const withReasonNotes =
        editorSpecialty === 'Colonoscopy and EGD'
          ? withReasonNotesAfterReferringProvider(withPractice)
          : withPractice
      return withStatusAfterApptDateTime(withReasonNotes)
    },
    [editorSpecialty],
  )
  const [draft, setDraft] = useState<Record<string, RowValue>>(() => createEmptyDraft(baseSchema))

  const editingRow = useMemo(() => {
    if (!editingId) return null
    return rows.find((r: Row) => r.id === editingId) ?? null
  }, [editingId, rows])

  function openAdd() {
    setSaveError(null)
    setEditingId(null)
    setEditorSpecialty(activeSpecialty)
    {
      const withPractice = withReferringProviderPractice(SCHEMAS[activeSpecialty])
      const nextSchemaBase =
        activeSpecialty === 'Colonoscopy and EGD'
          ? withReasonNotesAfterReferringProvider(withPractice)
          : withPractice
      const nextSchema = withStatusAfterApptDateTime(nextSchemaBase)
      setDraft(createEmptyDraft(nextSchema))
    }
    setIsEditorOpen(true)
  }

  function openEdit(id: string) {
    setSaveError(null)
    const row = rows.find((r: Row) => r.id === id)
    if (!row) return
    setEditingId(id)
    setEditorSpecialty(activeSpecialty)
    const nextDraft: Record<string, RowValue> = createEmptyDraft(baseSchema)
    for (const col of baseSchema) {
      if (col.type === 'datetime') {
        nextDraft[col.key] = toDateTimeLocalValue(row[col.key])
      } else {
        nextDraft[col.key] = row[col.key]
      }
    }

    const rowProviderId = typeof row.referringProviderId === 'string' ? row.referringProviderId.trim() : ''
    if (rowProviderId) {
      nextDraft.referringProviderId = rowProviderId
      const picked = providerOptions.find((p) => String(p.id) === String(rowProviderId)) ?? null
      if (picked) {
        const providerPractice = String(picked.provider_practice ?? '').trim()
        if (providerPractice) nextDraft[REFERRING_PROVIDER_PRACTICE_KEY] = providerPractice
        nextDraft.referringProvider = providerLabel(picked)
      }
    } else {
      const providerFromTable = String(row.referringProvider ?? '').trim()
      const practiceFromTable = String(
        (row as any).provider_practice ??
          (row as any).providerPractice ??
          row[REFERRING_PROVIDER_PRACTICE_KEY] ??
          '',
      ).trim()
      if (providerFromTable === UNKNOWN_PROVIDER_LABEL) {
        nextDraft.referringProviderId = UNKNOWN_PROVIDER_VALUE
        nextDraft.referringProvider = UNKNOWN_PROVIDER_LABEL
      } else if (providerFromTable) {
        nextDraft.referringProviderId = OTHER_PROVIDER_VALUE
        nextDraft.referringProvider = providerFromTable
      }
      if (practiceFromTable) {
        nextDraft[REFERRING_PROVIDER_PRACTICE_KEY] = practiceFromTable
      }
    }

    setDraft(nextDraft)
    setIsEditorOpen(true)
  }

  function closeEditor() {
    setSaveError(null)
    setIsEditorOpen(false)
    setEditingId(null)
    setEditorSpecialty(activeSpecialty)
    setDraft(createEmptyDraft(baseSchema))
  }

  function saveDraft() {
    const uid = session?.user?.id
    if (!uid) return
    setSaveError(null)

    const requiredKeys = ['dateReferralReceived', 'patientName', 'dob', 'phoneNumber'] as const

    const schemaKeys = new Set(editorSchema.map((c) => c.key))
    const missingLabels: string[] = []

    for (const key of requiredKeys) {
      if (!schemaKeys.has(key)) continue
      const v = typeof draft[key] === 'string' ? draft[key].trim() : ''
      if (!v) {
        const label = editorSchema.find((c) => c.key === key)?.label ?? key
        missingLabels.push(label)
      }
    }

    if (schemaKeys.has('phoneNumber')) {
      const phoneRaw = typeof draft.phoneNumber === 'string' ? draft.phoneNumber : ''
      const phoneDigits = phoneRaw.replace(/\D+/g, '')
      if (phoneDigits.length !== 10) {
        const label = editorSchema.find((c) => c.key === 'phoneNumber')?.label ?? 'Phone Number'
        setSaveError(`${label} must be exactly 10 digits`)
        return
      }
    }

    const practice =
      typeof draft[REFERRING_PROVIDER_PRACTICE_KEY] === 'string'
        ? String(draft[REFERRING_PROVIDER_PRACTICE_KEY]).trim()
        : ''
    if (!practice) missingLabels.push('Referral Provider Practice')

    const providerId =
      typeof draft.referringProviderId === 'string' ? draft.referringProviderId.trim() : ''
    const providerText =
      typeof draft.referringProvider === 'string' ? draft.referringProvider.trim() : ''
    const providerIsSelected = Boolean(providerId)
    const providerNeedsText = providerId === OTHER_PROVIDER_VALUE || practice === OTHER_PROVIDER_PRACTICE_VALUE
    if (!providerIsSelected && practice !== OTHER_PROVIDER_PRACTICE_VALUE) {
      missingLabels.push('Referral Provider')
    }
    if (providerNeedsText && !providerText) {
      missingLabels.push('Referral Provider')
    }

    if (missingLabels.length > 0) {
      setSaveError(`Please fill: ${Array.from(new Set(missingLabels)).join(', ')}`)
      return
    }

    const nextStatusInput = typeof draft.status === 'string' ? draft.status.trim() : ''
    const nextApptDateTime = typeof draft.apptDateTime === 'string' ? draft.apptDateTime.trim() : ''
    const nextThirdCommunication =
      typeof draft.thirdPatientCommunication === 'string' ? draft.thirdPatientCommunication.trim() : ''

    if (nextStatusInput === 'APPT_SCHEDULED' && schemaKeys.has('apptDateTime') && !nextApptDateTime) {
      const label = editorSchema.find((c) => c.key === 'apptDateTime')?.label ?? 'Appt date/time'
      setSaveError(`${label} must be set when Status is Appt scheduled`)
      return
    }

    if (nextStatusInput === 'NO_RESPONSE_3_ATTEMPTS') {
      if (schemaKeys.has('thirdPatientCommunication') && !nextThirdCommunication) {
        const label =
          editorSchema.find((c) => c.key === 'thirdPatientCommunication')?.label ??
          '3rd patient communication'
        setSaveError(`${label} must be set when Status is No response (3 attempts)`)
        return
      }
      if (schemaKeys.has('apptDateTime') && nextApptDateTime) {
        const label = editorSchema.find((c) => c.key === 'apptDateTime')?.label ?? 'Appt date/time'
        setSaveError(`${label} must be empty when Status is No response (3 attempts)`)
        return
      }
    }

    const data: Record<string, unknown> = {}
    for (const col of editorSchema) {
      if (col.key === REFERRING_PROVIDER_PRACTICE_KEY) continue
      if (col.type === 'datetime') {
        data[col.key] = toIsoDateTime(draft[col.key])
      } else {
        data[col.key] = draft[col.key]
      }
    }

    const targetSpecialty = editingId ? activeSpecialty : editorSpecialty
    const archived = editingRow?.archived === true
    const tableName = SPECIALTY_TABLES[targetSpecialty]

    const nextStatus = typeof data.status === 'string' ? data.status.trim() : ''
    const prevStatus = typeof editingRow?.status === 'string' ? editingRow.status.trim() : ''
    const shouldTouchStatusUpdatedAt = Boolean(nextStatus) && (!editingId || nextStatus !== prevStatus)

    void (async () => {
      try {
        const selectedProvider =
          typeof draft.referringProviderId === 'string' &&
          draft.referringProviderId.trim() &&
          draft.referringProviderId !== OTHER_PROVIDER_VALUE &&
          draft.referringProviderId !== UNKNOWN_PROVIDER_VALUE
            ? providerOptions.find((p) => String(p.id) === String(draft.referringProviderId)) ?? null
            : null

        const resolvedProviderText = selectedProvider
          ? providerLabel(selectedProvider)
          : String(data.referringProvider ?? '')
        const resolvedProviderId = selectedProvider ? Number(selectedProvider.id) : null
        const resolvedProviderPractice = selectedProvider ? (selectedProvider.provider_practice ?? '') : ''

        if (tableName) {
          const payload: any = {
            record_status: archived ? 'archived' : 'active',
            updated_at: new Date().toISOString(),
          }

          if (schemaKeys.has('dateReferralReceived')) {
            payload.date_referral_received = toIsoDateOnly(data.dateReferralReceived)
          }
          if (schemaKeys.has('patientName')) {
            payload.patient_name = String(data.patientName ?? '')
          }
          if (schemaKeys.has('dob')) {
            payload.dob = toIsoDateOnly(data.dob)
          }
          if (schemaKeys.has('phoneNumber')) {
            payload.phone = String(data.phoneNumber ?? '')
          }
          if (schemaKeys.has('insurance')) {
            payload.insurance = String(data.insurance ?? '')
          }
          if (schemaKeys.has('ngmPatient')) {
            payload.ngm_patient = (data as any).ngmPatient === true
          }

          if (schemaKeys.has('referringProvider') || schemaKeys.has('referringProviderId')) {
            payload.referral_provider = resolvedProviderText
            payload.referral_provider_id = resolvedProviderId
            payload.provider_practice = resolvedProviderPractice
          }

          if (schemaKeys.has('reason')) {
            payload.reason = String(data.reason ?? '')
          }
          if (schemaKeys.has('status')) {
            payload.status = typeof data.status === 'string' && data.status.trim() ? data.status.trim() : null
            if (shouldTouchStatusUpdatedAt) {
              payload.status_updated_at = new Date().toISOString()
            }
          }
          if (schemaKeys.has('emailSentAt')) {
            payload.email_sent_at = toIsoDateTime(data.emailSentAt)
          }
          if (schemaKeys.has('formsSent')) {
            payload.forms_sent = data.formsSent === true
          }
          if (schemaKeys.has('formReceived')) {
            payload.form_received =
              typeof data.formReceived === 'string' && data.formReceived.trim() ? data.formReceived.trim() : null
          }
          if (schemaKeys.has('calledToSchedule')) {
            payload.called_to_schedule = data.calledToSchedule === true
          }
          if (schemaKeys.has('prepInstructionSent')) {
            payload.prep_instruction_sent = data.prepInstructionSent === true
          }
          if (schemaKeys.has('firstPatientCommunication')) {
            payload.communication_1 = toIsoDateTime(data.firstPatientCommunication)
          }
          if (schemaKeys.has('secondPatientCommunication')) {
            payload.communication_2 = toIsoDateTime(data.secondPatientCommunication)
          }
          if (schemaKeys.has('thirdPatientCommunication')) {
            payload.communication_3 = toIsoDateTime(data.thirdPatientCommunication)
          }
          if (schemaKeys.has('apptDateTime')) {
            payload.appt_date_time = toIsoDateTime(data.apptDateTime)
          }
          if (schemaKeys.has('notes')) {
            payload.notes = String(data.notes ?? '')
          }
          if (schemaKeys.has('notes2')) {
            payload.notes_2 = String((data as any).notes2 ?? '')
          }

          if (editingId) {
            const { error } = await supabase.from(tableName).update(payload).eq('id', Number(editingId))
            if (error) throw error

            const nextRow = mapReferralTableRecordToRow(
              { id: Number(editingId), record_status: payload.record_status, ...payload },
              editorSchema,
            )
            nextRow.referringProvider = resolvedProviderText
            nextRow.referringProviderId = resolvedProviderId != null ? String(resolvedProviderId) : ''
            nextRow[REFERRING_PROVIDER_PRACTICE_KEY] = resolvedProviderPractice

            if (targetSpecialty === activeSpecialty) {
              setRows((prev) => prev.map((x) => (x.id === editingId ? nextRow : x)))
            }
            closeEditor()
            return
          }

          const { data: inserted, error } = await supabase
            .from(tableName)
            .insert(payload)
            .select('id')
            .single()
          if (error) throw error

          const insertedId = String(inserted?.id ?? '')
          const nextRow = mapReferralTableRecordToRow(
            { id: Number(inserted?.id ?? 0), record_status: payload.record_status, ...payload },
            editorSchema,
          )
          nextRow.id = insertedId
          nextRow.referringProvider = resolvedProviderText
          nextRow.referringProviderId = resolvedProviderId != null ? String(resolvedProviderId) : ''
          nextRow[REFERRING_PROVIDER_PRACTICE_KEY] = resolvedProviderPractice

          if (targetSpecialty === activeSpecialty) {
            setRows((prev) => [nextRow, ...prev])
          }
          closeEditor()
          return
        }

        const payload: any = {
          user_id: uid,
          archived,
          specialty: targetSpecialty,
          data,
        }

        if (editingId) {
          const { error } = await supabase.from('referrals').update(payload).eq('id', Number(editingId))
          if (error) throw error
          const nextRow: Row = { ...editingRow, ...data, id: editingId } as any
          nextRow.referringProvider = resolvedProviderText
          nextRow.referringProviderId = resolvedProviderId != null ? String(resolvedProviderId) : ''
          nextRow[REFERRING_PROVIDER_PRACTICE_KEY] = resolvedProviderPractice
          if (targetSpecialty === activeSpecialty) {
            setRows((prev) => prev.map((x) => (x.id === editingId ? nextRow : x)))
          }
          closeEditor()
          return
        }

        const { data: inserted, error } = await supabase
          .from('referrals')
          .insert(payload)
          .select('id')
          .single()
        if (error) throw error
        const nextRow: Row = { ...data, id: String(inserted?.id ?? '') } as any
        nextRow.referringProvider = resolvedProviderText
        nextRow.referringProviderId = resolvedProviderId != null ? String(resolvedProviderId) : ''
        nextRow[REFERRING_PROVIDER_PRACTICE_KEY] = resolvedProviderPractice
        if (targetSpecialty === activeSpecialty) {
          setRows((prev) => [nextRow, ...prev])
        }
        closeEditor()
      } catch (e: any) {
        setSaveError(e?.message ?? 'Failed to save')
      }
    })()
  }

  function archiveRow(id: string) {
    const uid = session?.user?.id
    if (!uid) return
    void (async () => {
      const tableName = SPECIALTY_TABLES[activeSpecialty]
      const { error } = tableName
        ? await supabase
            .from(tableName)
            .update({ record_status: 'archived', updated_at: new Date().toISOString() })
            .eq('id', Number(id))
        : await supabase.from('referrals').update({ archived: true }).eq('id', Number(id))

      if (error) {
        setRowsError(error.message)
        return
      }

      setRows((prev) => prev.filter((r) => r.id !== id))
    })()
  }

  function isNotesColumn(col: ColumnDef) {
    const key = col.key.toLowerCase()
    const label = col.label.toLowerCase()
    return key.includes('notes') || label.includes('notes')
  }

  function isDateColumn(col: ColumnDef) {
    return col.type === 'date'
  }

  function isDateTimeColumn(col: ColumnDef) {
    return col.type === 'datetime'
  }

  function orderSchema(cols: ColumnDef[]) {
    const firstKeys = [
      'dateReferralReceived',
      'patientName',
      'dob',
      'phoneNumber',
      'insurance',
      REFERRING_PROVIDER_PRACTICE_KEY,
      'referringProvider',
    ]

    const reason = cols.find((c) => c.key === 'reason') ?? null
    const notes = cols.find((c) => c.key === 'notes') ?? null
    const reasonNotesRemoved = cols.filter((c) => c.key !== 'reason' && c.key !== 'notes')

    const first: ColumnDef[] = []
    for (const k of firstKeys) {
      const col = reasonNotesRemoved.find((c) => c.key === k)
      if (col) first.push(col)
    }

    const firstSet = new Set(first.map((c) => c.key))
    const middle = reasonNotesRemoved.filter((c) => !firstSet.has(c.key))

    const extras: ColumnDef[] = []
    if (reason) extras.push(reason)
    if (notes) extras.push(notes)

    return [...first, ...extras, ...middle]
  }

  const orderedSchema = useMemo(() => orderSchema(schema), [schema])

  const pinnedKeysInSchemaOrder = useMemo(() => {
    const set = new Set(pinnedKeys)
    set.delete('reason')
    set.delete('notes')
    return orderedSchema.filter((c) => set.has(c.key)).map((c) => c.key)
  }, [pinnedKeys, orderedSchema])

  const displaySchema = useMemo(() => {
    if (pinnedKeys.length === 0) return orderedSchema

    const set = new Set(pinnedKeys)
    set.delete('reason')
    set.delete('notes')
    const pinned = orderedSchema.filter((c) => set.has(c.key))
    const rest = orderedSchema.filter((c) => !set.has(c.key))
    return [...pinned, ...rest]
  }, [orderedSchema, pinnedKeys])

  useEffect(() => {
    if (!tableRef.current) return

    const pinnedCount = pinnedKeysInSchemaOrder.length
    if (pinnedCount <= 0) {
      setPinnedLeftOffsets([])
      return
    }

    const ths = Array.from(
      tableRef.current.querySelectorAll<HTMLTableCellElement>('thead th[data-col-key]'),
    )

    const widths: number[] = []
    for (let i = 0; i < pinnedCount; i++) {
      const th = ths[i]
      widths.push(th ? th.getBoundingClientRect().width : 0)
    }

    const offsets: number[] = []
    let acc = 0
    for (let i = 0; i < widths.length; i++) {
      offsets.push(acc)
      acc += widths[i]
    }

    setPinnedLeftOffsets(offsets)
  }, [displaySchema, pinnedKeysInSchemaOrder.length])

  function stickyStyle(index: number, isHeader: boolean) {
    if (index >= pinnedKeysInSchemaOrder.length) return undefined
    return {
      position: 'sticky' as const,
      left: pinnedLeftOffsets[index],
      zIndex: isHeader ? 30 : 20,
      background: '#ffffff',
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader
        title="ReferralTracker"
        subtitle={activeSpecialty}
        right={
          <>
            <button
              type="button"
              onClick={openAdd}
              className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90"
            >
              Add Referral
            </button>

          </>
        }
      />

      <div className="mx-auto border-b bg-white px-4 pb-3">
        <div className="flex w-full gap-2 overflow-x-auto pt-3">
          {SPECIALTIES.map((s) => {
            const isActive = s === activeSpecialty
            return (
              <button
                key={s}
                type="button"
                onClick={() => setActiveSpecialty(s)}
                className={clsx(
                  'whitespace-nowrap rounded-full px-3 py-1 text-sm',
                  isActive
                    ? 'bg-brand text-white'
                    : 'bg-white text-slate-800 hover:bg-[rgb(48_158_235/0.08)]',
                )}
              >
                {s}
              </button>
            )
          })}
        </div>
      </div>

      <main className="mx-auto px-4 py-6">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700">Search by</span>
            <select
              value={searchBy}
              onChange={(e) => setSearchBy(e.target.value)}
              className="w-[240px] rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
            >
              <option value="__all__">All columns</option>
              {schema.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700">Search</span>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-[320px] rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
              placeholder="Type to filter rows..."
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700">Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-[240px] rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
            >
              <option value="__none__">None</option>
              {schema.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50"
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            aria-label={sortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            <span>{sortDir === 'asc' ? 'Asc' : 'Desc'}</span>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={clsx(
                'h-4 w-4 text-slate-600 transition-transform',
                sortDir === 'desc' && 'rotate-180',
              )}
            >
              <path
                fillRule="evenodd"
                d="M10 3a.75.75 0 01.75.75v10.69l2.22-2.22a.75.75 0 111.06 1.06l-3.5 3.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06l2.22 2.22V3.75A.75.75 0 0110 3z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          <div ref={freezeMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsFreezeOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              <span>Freeze Columns</span>
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className={clsx(
                  'h-4 w-4 text-slate-600 transition-transform',
                  isFreezeOpen && 'rotate-180',
                )}
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {isFreezeOpen ? (
              <div className="absolute right-0 top-11 z-40 w-[320px] rounded-md border bg-white p-2 shadow-lg">
                <div className="px-2 pb-2 text-xs font-semibold text-slate-700">
                  Select columns (order = freeze order)
                </div>
                <div className="max-h-[320px] overflow-auto">
                  {schema.map((c) => {
                    const checked = pinnedKeys.includes(c.key)
                    return (
                      <label
                        key={c.key}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const nextChecked = e.target.checked
                            setPinnedKeys((prev) => {
                              if (nextChecked) {
                                if (prev.includes(c.key)) return prev
                                return [...prev, c.key]
                              }
                              return prev.filter((k) => k !== c.key)
                            })
                          }}
                        />
                        <span className="flex-1">{c.label}</span>
                        {checked ? (
                          <span className="text-xs text-slate-500">
                            #{pinnedKeysInSchemaOrder.indexOf(c.key) + 1}
                          </span>
                        ) : null}
                      </label>
                    )
                  })}
                </div>

                {pinnedKeys.length ? (
                  <button
                    type="button"
                    onClick={() => setPinnedKeys([])}
                    className="mt-2 w-full rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    Clear frozen columns
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {searchText.trim() ? (
            <button
              type="button"
              onClick={() => setSearchText('')}
              className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              Clear
            </button>
          ) : null}

          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700">Date field</span>
            <select
              value={dateFilterKey}
              onChange={(e) => setDateFilterKey(e.target.value)}
              className="w-[240px] rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
            >
              <option value="__none__">No date filter</option>
              {dateColumns.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[170px] rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[170px] rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
            />
          </label>

          <button
            type="button"
            onClick={downloadCsv}
            className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            <span>Download</span>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 text-slate-600"
            >
              <path
                fillRule="evenodd"
                d="M10 2.75a.75.75 0 01.75.75v7.69l2.22-2.22a.75.75 0 111.06 1.06l-3.5 3.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06l2.22 2.22V3.5a.75.75 0 01.75-.75zM3.5 12.5a.75.75 0 01.75.75v2.25c0 .414.336.75.75.75h10c.414 0 .75-.336.75-.75V13.25a.75.75 0 011.5 0v2.25A2.25 2.25 0 0115.75 17.75h-11A2.25 2.25 0 012.5 15.5v-2.25a.75.75 0 01.75-.75z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="rounded-lg border bg-white">
          <div className="overflow-x-auto">
            <table
              ref={tableRef}
              className="w-full table-auto border-separate border-spacing-0"
            >
              <thead className="sticky top-0 bg-white">
                <tr>
                  {displaySchema.map((col, idx) => (
                    <Th
                      key={col.key}
                      dataColKey={col.key}
                      className={clsx(
                        isNotesColumn(col) && 'w-[320px] min-w-[320px]',
                        isDateColumn(col) && 'w-[140px] max-w-[140px]',
                        isDateTimeColumn(col) && 'w-[190px] max-w-[190px]',
                      )}
                      style={stickyStyle(idx, true)}
                    >
                      {col.label}
                    </Th>
                  ))}
                  {canEditRows ? <Th className="w-[160px]">Actions</Th> : null}
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={displaySchema.length + (canEditRows ? 1 : 0)}
                      className="border-t px-4 py-10 text-center text-sm text-slate-600"
                    >
                      {isRowsLoading
                        ? 'Loading…'
                        : rowsError
                          ? rowsError
                          : rows.length === 0
                            ? 'No referrals yet. Click “Add Referral” to create your first row.'
                            : 'No results found for your search.'}
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((r) => (
                    <tr key={r.id} className="odd:bg-slate-50 hover:bg-slate-100">
                      {displaySchema.map((col, idx) => (
                        <Td
                          key={col.key}
                          className={clsx(
                            col.type === 'checkbox' && 'text-center',
                            col.type === 'text' && !isNotesColumn(col) && 'truncate',
                            isNotesColumn(col) && 'whitespace-pre-wrap break-words',
                            isDateColumn(col) &&
                              'whitespace-nowrap',
                            isDateTimeColumn(col) &&
                              'whitespace-nowrap',
                            isNotesColumn(col) && 'w-[320px] min-w-[320px]',
                            isDateColumn(col) && 'w-[140px] max-w-[140px]',
                            isDateTimeColumn(col) && 'w-[190px] max-w-[190px]',
                          )}
                          style={stickyStyle(idx, false)}
                        >
                          {col.type === 'checkbox'
                            ? r[col.key]
                              ? 'Yes'
                              : ''
                            : (() => {
                                if (col.key === 'referringProvider' || col.key === REFERRING_PROVIDER_PRACTICE_KEY) {
                                  const providerId =
                                    typeof r.referringProviderId === 'string' ? r.referringProviderId : ''
                                  if (!providerId || providerId === OTHER_PROVIDER_VALUE) {
                                    const rawProvider = String(r.referringProvider ?? '')
                                    const split = rawProvider.split(' - ')
                                    const left = split[0] ?? ''
                                    const rawPracticeFromTable = String(
                                      (r as any).provider_practice ?? (r as any).providerPractice ?? '',
                                    )

                                    if (col.key === REFERRING_PROVIDER_PRACTICE_KEY) {
                                      return rawPracticeFromTable.trim()
                                    }

                                    return left.trim()
                                  }
                                  const p = providerOptions.find((x) => String(x.id) === String(providerId))
                                  if (!p) return ''
                                  if (col.key === REFERRING_PROVIDER_PRACTICE_KEY) {
                                    return (p.provider_practice ?? '').trim()
                                  }
                                  return (p.referral_provider ?? '').trim()
                                }

                                if (isDateTimeColumn(col)) {
                                  return formatDateTimeDisplay(r[col.key])
                                }

                                if (col.key === 'status') {
                                  return statusLabel(String(r[col.key] ?? ''))
                                }

                                return String(r[col.key] ?? '')
                              })()}
                        </Td>
                      ))}
                      {canEditRows ? (
                        <Td>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(r.id)}
                              className="rounded border px-2 py-1 text-sm hover:bg-white"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                (() => {
                                  const name = getPatientNameForPrompt(r)
                                  const label = name ? `“${name}”` : 'this referral'
                                  const ok = window.confirm(
                                    `Are you sure you want to archive ${label}?`,
                                  )
                                  if (ok) archiveRow(r.id)
                                })()
                              }
                              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-700 hover:bg-slate-100"
                            >
                              Archive
                            </button>
                          </div>
                        </Td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {isEditorOpen ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeEditor}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-[560px] overflow-y-auto bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="text-sm font-semibold">
                  {editingRow ? 'Edit Referral' : 'Add Referral'}
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded px-2 py-1 text-sm hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 px-4 py-4">
              {!editingRow ? (
                <Section title="Table">
                  <Select
                    label="Add to"
                    value={editorSpecialty}
                    options={SPECIALTIES}
                    onChange={(next) => {
                      setEditorSpecialty(next)
                      setDraft(createEmptyDraft(SCHEMAS[next]))
                    }}
                  />
                </Section>
              ) : null}

              <Section title="Details">
                {editorSchema.map((col) => {
                  const value = draft[col.key]
                  if (col.key === REFERRING_PROVIDER_PRACTICE_KEY) return null

                  const isReferringProvider =
                    col.key === 'referringProvider' || col.key === 'referringProviderId'

                  if (isReferringProvider) {
                    const providerId =
                      typeof draft.referringProviderId === 'string' ? draft.referringProviderId : ''
                    const providerPractice =
                      typeof draft[REFERRING_PROVIDER_PRACTICE_KEY] === 'string'
                        ? (draft[REFERRING_PROVIDER_PRACTICE_KEY] as string)
                        : ''

                    const practiceOptions = Array.from(
                      new Set(
                        providerOptions
                          .map((p) => (p.provider_practice ?? '').trim())
                          .filter((v) => v.length > 0),
                      ),
                    ).sort((a, b) => a.localeCompare(b))

                    const practiceOptionsWithCurrent =
                      providerPractice &&
                      providerPractice !== OTHER_PROVIDER_PRACTICE_VALUE &&
                      !practiceOptions.includes(providerPractice)
                        ? [...practiceOptions, providerPractice].sort((a, b) => a.localeCompare(b))
                        : practiceOptions

                    const filteredProviderOptions = providerPractice
                      ? providerOptions.filter((p) => (p.provider_practice ?? '').trim() === providerPractice)
                      : []

                    const providerIdOptions = [
                      '',
                      UNKNOWN_PROVIDER_VALUE,
                      OTHER_PROVIDER_VALUE,
                      ...filteredProviderOptions.map((p) => String(p.id)),
                    ]

                    return (
                      <div key={col.key} className="grid gap-3">
                        <Select
                          label="Referral Provider Practice"
                          value={providerPractice}
                          options={['', OTHER_PROVIDER_PRACTICE_VALUE, ...practiceOptionsWithCurrent]}
                          optionLabel={(v) => {
                            if (v === OTHER_PROVIDER_PRACTICE_VALUE) return 'Other Referral Provider Practice'
                            return v
                          }}
                          onChange={(nextPractice) => {
                            setDraft((d) => {
                              const currentProviderId =
                                typeof d.referringProviderId === 'string' ? d.referringProviderId : ''
                              const keepOtherProvider =
                                currentProviderId === OTHER_PROVIDER_VALUE &&
                                typeof d.referringProvider === 'string' &&
                                d.referringProvider.trim().length > 0

                              return {
                                ...d,
                                referringProviderId:
                                  nextPractice === OTHER_PROVIDER_PRACTICE_VALUE
                                    ? OTHER_PROVIDER_VALUE
                                    : '',
                                referringProvider: keepOtherProvider
                                  ? (d.referringProvider as string)
                                  : '',
                                [REFERRING_PROVIDER_PRACTICE_KEY]: nextPractice,
                              }
                            })
                          }}
                        />

                        {providerPractice === OTHER_PROVIDER_PRACTICE_VALUE ? null : (
                          <Select
                            label={col.label}
                            value={providerId}
                            options={providerIdOptions}
                            optionLabel={(v) => {
                              if (!v) return ''
                              if (v === UNKNOWN_PROVIDER_VALUE) return UNKNOWN_PROVIDER_LABEL
                              if (v === OTHER_PROVIDER_VALUE) return 'Other Referral Provider'
                              const p = filteredProviderOptions.find((x) => String(x.id) === String(v))
                              return p ? providerLabel(p) : v
                            }}
                            onChange={(v) => {
                              if (v === UNKNOWN_PROVIDER_VALUE) {
                                setDraft((d) => ({
                                  ...d,
                                  referringProviderId: UNKNOWN_PROVIDER_VALUE,
                                  referringProvider: UNKNOWN_PROVIDER_LABEL,
                                }))
                                return
                              }
                              if (v === OTHER_PROVIDER_VALUE) {
                                setDraft((d) => ({
                                  ...d,
                                  referringProviderId: OTHER_PROVIDER_VALUE,
                                  referringProvider:
                                    typeof d.referringProvider === 'string' ? d.referringProvider : '',
                                }))
                                return
                              }

                              const picked = v
                                ? filteredProviderOptions.find((p) => String(p.id) === String(v)) ?? null
                                : null
                              setDraft((d) => ({
                                ...d,
                                referringProviderId: v,
                                referringProvider: picked ? providerLabel(picked) : '',
                                [REFERRING_PROVIDER_PRACTICE_KEY]: picked ? (picked.provider_practice ?? '') : '',
                              }))
                            }}
                          />
                        )}

                        {providerId === OTHER_PROVIDER_VALUE ? (
                          <Input
                            label="Other Referral Provider"
                            value={typeof draft.referringProvider === 'string' ? draft.referringProvider : ''}
                            onChange={(v) => setDraft((d) => ({ ...d, referringProvider: v }))}
                          />
                        ) : null}
                      </div>
                    )
                  }

                  if (editorSpecialty === 'Colonoscopy and EGD' && col.key === 'formReceived') {
                    return (
                      <Select
                        key={col.key}
                        label={col.label}
                        value={typeof value === 'string' ? value : ''}
                        options={FORM_RECEIVED_OPTIONS}
                        onChange={(v) => setDraft((d) => ({ ...d, [col.key]: v }))}
                      />
                    )
                  }

                  if (col.key === 'status') {
                    return (
                      <Select
                        key={col.key}
                        label={col.label}
                        value={typeof value === 'string' ? value : ''}
                        options={STATUS_OPTIONS as unknown as string[]}
                        optionLabel={(v) => statusLabel(String(v ?? ''))}
                        onChange={(v) => setDraft((d) => ({ ...d, [col.key]: v }))}
                      />
                    )
                  }

                  if (col.type === 'checkbox') {
                    if (editorSpecialty === 'Colonoscopy and EGD' && col.key === 'formsSent') {
                      return (
                        <div key={col.key} className="flex flex-wrap items-center gap-6">
                          <Checkbox
                            label={col.label}
                            checked={value === true}
                            onChange={(checked) =>
                              setDraft((d) => ({ ...d, [col.key]: checked }))
                            }
                          />
                          <div className="text-xs text-slate-500">Screening Questionnaire</div>
                        </div>
                      )
                    }
                    return (
                      <Checkbox
                        key={col.key}
                        label={col.label}
                        checked={value === true}
                        onChange={(checked) =>
                          setDraft((d) => ({ ...d, [col.key]: checked }))
                        }
                      />
                    )
                  }

                  const isInsurance =
                    /insurance/i.test(col.key) || /insurance/i.test(col.label)

                  if (isInsurance) {
                    return (
                      <Select
                        key={col.key}
                        label={col.label}
                        value={typeof value === 'string' ? value : ''}
                        options={insuranceOptions}
                        onChange={(v) =>
                          setDraft((d) => ({ ...d, [col.key]: v }))
                        }
                      />
                    )
                  }

                  if (col.key === 'phoneNumber') {
                    return (
                      <div key={col.key} className="flex items-end gap-2">
                        <div className="flex-1">
                          <Input
                            label={col.label}
                            type={
                              col.type === 'date'
                                ? 'date'
                                : col.type === 'datetime'
                                  ? 'datetime-local'
                                  : 'text'
                            }
                            value={typeof value === 'string' ? value : ''}
                            onChange={(v) => setDraft((d) => ({ ...d, [col.key]: v }))}
                          />
                        </div>
                        <div className="pb-2 text-xs text-slate-500 whitespace-nowrap">
                          10 digit number without country code
                        </div>
                      </div>
                    )
                  }

                  const comm1Filled =
                    typeof draft.firstPatientCommunication === 'string' && draft.firstPatientCommunication.trim().length > 0
                  const comm2Filled =
                    typeof draft.secondPatientCommunication === 'string' && draft.secondPatientCommunication.trim().length > 0
                  const shouldDisable =
                    col.key === 'secondPatientCommunication'
                      ? !comm1Filled
                      : col.key === 'thirdPatientCommunication'
                        ? !comm1Filled || !comm2Filled
                        : false

                  return (
                    <Input
                      key={col.key}
                      label={col.label}
                      type={
                        col.type === 'date'
                          ? 'date'
                          : col.type === 'datetime'
                            ? 'datetime-local'
                            : 'text'
                      }
                      value={typeof value === 'string' ? value : ''}
                      disabled={shouldDisable}
                      onChange={(v) => setDraft((d) => ({ ...d, [col.key]: v }))}
                    />
                  )
                })}
              </Section>

              {saveError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {saveError}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveDraft}
                  className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Select<T extends string>({
  label,
  value,
  options,
  optionLabel,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  optionLabel?: (value: T) => string
  onChange: (next: T) => void
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as T)}
        className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {optionLabel ? optionLabel(o) : o}
          </option>
        ))}
      </select>
    </label>
  )
}


function Th({
  children,
  className,
  style,
  dataColKey,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  dataColKey?: string
}) {
  return (
    <th
      style={style}
      data-col-key={dataColKey}
      className={clsx(
        'border-b bg-sky-50 px-3 py-2 text-left text-xs font-bold text-slate-800',
        className,
      )}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <td
      style={style}
      className={clsx(
        'border-b px-3 py-2 align-top text-sm text-slate-800',
        className,
      )}
    >
      {children}
    </td>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-md border bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-700">{title}</div>
      <div className="grid gap-3">{children}</div>
    </section>
  )
}

function Input({
  label,
  type,
  value,
  disabled,
  onChange,
}: {
  label: string
  type?: 'text' | 'date' | 'datetime-local' | 'tel'
  value: string
  disabled?: boolean
  onChange: (next: string) => void
}) {
  const isPhone = /phone/i.test(label)
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <input
        type={isPhone ? 'tel' : (type ?? 'text')}
        inputMode={isPhone ? 'numeric' : undefined}
        pattern={isPhone ? '[0-9]*' : undefined}
        maxLength={isPhone ? 10 : undefined}
        value={value}
        disabled={disabled}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const next = e.target.value
          onChange(isPhone ? next.replace(/\D+/g, '').slice(0, 10) : next)
        }}
        className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      />
    </label>
  )
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300"
      />
      <span className="text-sm text-slate-800">{label}</span>
    </label>
  )
}
