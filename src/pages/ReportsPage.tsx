import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import clsx from 'clsx'
import AppHeader from '../components/AppHeader'
import { supabase } from '../lib/supabaseClient'
import { useSupabaseAuth } from '../lib/useSupabaseAuth'

const SPECIALTIES = [
  'Colonoscopy and EGD',
  'General Surgery',
  'Spine Neuro Rajamand',
  'Ortho',
  'Ophthalmology',
  'Rajamand Follow Ups',
  'IR Carlevato',
  'Heme Onc Rice',
  'Infusion',
  "Women's Health",
  'Cardio Deschutter',
  'Singh Cancellations',
  'Hernia Sx Waitlist',
] as const

type Specialty = (typeof SPECIALTIES)[number]

type AnyRow = Record<string, unknown>

type RowWithMeta = {
  specialty: Specialty
  row: AnyRow
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function parseDateInputValue(dateString: unknown) {
  if (!isNonEmptyString(dateString)) return null
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return null
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfWeekMonday(d: Date) {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  const day = out.getDay() // 0=Sun, 1=Mon
  const diff = (day + 6) % 7
  out.setDate(out.getDate() - diff)
  return out
}

function formatDateYYYYMMDD(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getCommCompletionBucket(row: AnyRow) {
  const first = isNonEmptyString(row.firstPatientCommunication)
  const second = isNonEmptyString(row.secondPatientCommunication)
  const third = isNonEmptyString(row.thirdPatientCommunication)

  if (first && second && third) return 'all_three'
  if (first && second) return 'first_second'
  if (first) return 'first_only'
  return 'none'
}

export default function ReportsPage() {
  const { session } = useSupabaseAuth()
  const [specialtyFilter, setSpecialtyFilter] = useState<'__all__' | Specialty>(
    '__all__',
  )
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [allRows, setAllRows] = useState<RowWithMeta[]>([])
  const [isLoadingRows, setIsLoadingRows] = useState(false)
  const [rowsError, setRowsError] = useState<string | null>(null)

  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) return

    let isMounted = true
    setIsLoadingRows(true)
    setRowsError(null)

    void (async () => {
      const { data, error } = await supabase
        .from('referrals')
        .select('specialty, data')
        .eq('user_id', uid)
        .eq('archived', false)

      if (!isMounted) return

      if (error) {
        setAllRows([])
        setRowsError(error.message)
        setIsLoadingRows(false)
        return
      }

      const allowed = new Set(SPECIALTIES as readonly string[])
      const next: RowWithMeta[] = (data ?? [])
        .map((r: any) => {
          const specialty = String(r.specialty)
          if (!allowed.has(specialty)) return null
          const row = (r.data ?? {}) as AnyRow
          return { specialty: specialty as Specialty, row }
        })
        .filter((x): x is RowWithMeta => x !== null)

      setAllRows(next)
      setIsLoadingRows(false)
    })()

    return () => {
      isMounted = false
    }
  }, [session?.user?.id])

  const filteredRows = useMemo(() => {
    const from = dateFrom ? parseDateInputValue(dateFrom) : null
    const to = dateTo ? parseDateInputValue(dateTo) : null
    const toInclusive = to ? new Date(to) : null
    if (toInclusive) toInclusive.setDate(toInclusive.getDate() + 1)

    return allRows.filter(({ specialty, row }) => {
      if (specialtyFilter !== '__all__' && specialty !== specialtyFilter) return false

      if (!from && !toInclusive) return true

      const received = parseDateInputValue(row.dateReferralReceived)
      if (!received) return false

      if (from && received < from) return false
      if (toInclusive && received >= toInclusive) return false
      return true
    })
  }, [allRows, dateFrom, dateTo, specialtyFilter])

  const totalReferrals = filteredRows.length

  const referralsByCategory = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const { specialty } of filteredRows) {
      counts[specialty] = (counts[specialty] ?? 0) + 1
    }
    return counts
  }, [filteredRows])

  const commStats = useMemo(() => {
    let firstOnly = 0
    let firstSecond = 0
    let allThree = 0
    let none = 0

    for (const { row } of filteredRows) {
      const bucket = getCommCompletionBucket(row)
      if (bucket === 'all_three') allThree++
      else if (bucket === 'first_second') firstSecond++
      else if (bucket === 'first_only') firstOnly++
      else none++
    }

    return { firstOnly, firstSecond, allThree, none }
  }, [filteredRows])

  const commDenominator = commStats.firstOnly + commStats.firstSecond + commStats.allThree

  const byCategoryItems = useMemo(() => {
    const entries = Object.entries(referralsByCategory)
    entries.sort((a, b) => b[1] - a[1])
    return entries
  }, [referralsByCategory])

  const maxCategoryCount = useMemo(() => {
    let max = 0
    for (const [, count] of byCategoryItems) max = Math.max(max, count)
    return max
  }, [byCategoryItems])

  const weeklyTrendItems = useMemo(() => {
    const buckets: Record<string, number> = {}
    for (const { row } of filteredRows) {
      const received = parseDateInputValue(row.dateReferralReceived)
      if (!received) continue
      const weekStart = startOfWeekMonday(received)
      const key = formatDateYYYYMMDD(weekStart)
      buckets[key] = (buckets[key] ?? 0) + 1
    }

    const entries = Object.entries(buckets)
    entries.sort((a, b) => a[0].localeCompare(b[0]))
    return entries
  }, [filteredRows])

  const maxWeeklyCount = useMemo(() => {
    let max = 0
    for (const [, count] of weeklyTrendItems) max = Math.max(max, count)
    return max
  }, [weeklyTrendItems])

  const commChartItems = useMemo(() => {
    return [
      { key: 'first_only', label: '1st only', value: commStats.firstOnly },
      { key: 'first_second', label: '1st + 2nd', value: commStats.firstSecond },
      { key: 'all_three', label: 'All 3', value: commStats.allThree },
    ]
  }, [commStats.allThree, commStats.firstOnly, commStats.firstSecond])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader title="Reports" subtitle="Referral tracking metrics" />

      <main className="mx-auto px-4 py-6">
        {rowsError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {rowsError}
          </div>
        ) : null}

        {isLoadingRows ? (
          <div className="mb-4 text-sm text-slate-700">Loading…</div>
        ) : null}

        <div className="grid gap-4">
          <div className="rounded-lg border bg-white p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Select
                label="Table"
                value={specialtyFilter}
                options={['__all__', ...SPECIALTIES]}
                optionLabel={(v) => (v === '__all__' ? 'All tables' : v)}
                onChange={(v) => setSpecialtyFilter(v)}
              />
              <Input
                label="From"
                type="date"
                value={dateFrom}
                onChange={(v) => setDateFrom(v)}
              />
              <Input
                label="To"
                type="date"
                value={dateTo}
                onChange={(v) => setDateTo(v)}
              />
            </div>
            <div className="mt-3 text-xs text-slate-600">
              Date filter uses the <span className="font-semibold">Date Referral Received</span>{' '}
              field. Rows without a valid date are excluded when a date range is set.
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <StatCard title="Total referrals" value={totalReferrals} />
            <StatCard
              title="Referrals with 1st comm started"
              value={commDenominator}
              subtitle={totalReferrals ? `${Math.round((commDenominator / totalReferrals) * 100)}%` : '0%'}
            />
            <StatCard
              title="All 3 comms completed"
              value={commStats.allThree}
              subtitle={
                commDenominator
                  ? `${Math.round((commStats.allThree / commDenominator) * 100)}% of started`
                  : '0% of started'
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">Referrals by category</div>
              {byCategoryItems.length === 0 ? (
                <div className="mt-3 text-sm text-slate-600">No rows match your filters.</div>
              ) : (
                <div className="mt-3">
                  <BarChart
                    items={byCategoryItems.map(([label, value]) => ({ label, value }))}
                    height={260}
                  />
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-white p-4">
              <div className="text-sm font-semibold text-slate-800">
                Communication completion ratio
              </div>
              {commDenominator === 0 ? (
                <div className="mt-3 text-sm text-slate-600">No rows match your filters.</div>
              ) : (
                <div className="mt-3 grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
                  <DonutChart items={commChartItems} size={200} />
                  <Legend items={commChartItems} total={commDenominator} />
                </div>
              )}

              <div className="mt-3 text-xs text-slate-600">
                Ratios are calculated out of rows that have at least the <span className="font-semibold">1st</span>{' '}
                patient communication date.
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <div className="text-sm font-semibold text-slate-800">Week-by-week trend</div>
            <div className="mt-1 text-xs text-slate-600">
              Grouped by <span className="font-semibold">Monday-starting weeks</span>, based on Date Referral Received.
            </div>

            {weeklyTrendItems.length === 0 ? (
              <div className="mt-3 text-sm text-slate-600">No rows with valid dates match your filters.</div>
            ) : (
              <div className="mt-3">
                <LineChart
                  points={weeklyTrendItems.map(([x, y]) => ({ xLabel: x, y }))}
                  height={260}
                  yMax={maxWeeklyCount}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string
  value: number
  subtitle?: string
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs font-semibold text-slate-600">{title}</div>
      <div className="mt-1 text-3xl font-semibold text-slate-900">{value}</div>
      {subtitle ? <div className="mt-1 text-xs text-slate-600">{subtitle}</div> : null}
    </div>
  )
}

function BarRow({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-sm text-slate-800">{label}</div>
        <div className="text-sm font-medium text-slate-700">{value}</div>
      </div>
      <div className="h-2 w-full rounded bg-slate-100">
        <div
          className="h-2 rounded bg-brand"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function RatioRow({
  label,
  value,
  total,
}: {
  label: string
  value: number
  total: number
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-white px-3 py-2">
      <div className="text-sm text-slate-800">{label}</div>
      <div className="text-sm font-medium text-slate-700">
        {value} ({pct}%)
      </div>
    </div>
  )
}

function BarChart({
  items,
  height,
}: {
  items: Array<{ label: string; value: number }>
  height: number
}) {
  const width = 720
  const padding = { top: 16, right: 16, bottom: 38, left: 40 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const max = items.reduce((m, i) => Math.max(m, i.value), 0)
  const bars = items.slice(0, 12)
  const step = bars.length ? innerW / bars.length : innerW
  const barW = Math.max(6, step * 0.62)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <rect x="0" y="0" width={width} height={height} fill="white" />
      <line
        x1={padding.left}
        y1={padding.top + innerH}
        x2={padding.left + innerW}
        y2={padding.top + innerH}
        stroke="#e2e8f0"
      />
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={padding.top + innerH}
        stroke="#e2e8f0"
      />

      {bars.map((b, i) => {
        const x = padding.left + i * step + (step - barW) / 2
        const h = max > 0 ? (b.value / max) * innerH : 0
        const y = padding.top + innerH - h
        return (
          <g key={b.label}>
            <rect x={x} y={y} width={barW} height={h} fill={CHART_COLORS[i % CHART_COLORS.length]} rx={4} />
            <text
              x={x + barW / 2}
              y={padding.top + innerH + 18}
              textAnchor="middle"
              fontSize="10"
              fill="#64748b"
            >
              {shortLabel(b.label)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function shortLabel(label: string) {
  if (label.length <= 10) return label
  return `${label.slice(0, 10)}…`
}

function LineChart({
  points,
  height,
  yMax,
}: {
  points: Array<{ xLabel: string; y: number }>
  height: number
  yMax: number
}) {
  const width = 720
  const padding = { top: 16, right: 16, bottom: 40, left: 40 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const max = Math.max(1, yMax)

  const xs = points.map((p, i) =>
    padding.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW),
  )
  const ys = points.map((p) => padding.top + innerH - (p.y / max) * innerH)
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xs[i]} ${ys[i]}`)
    .join(' ')

  const tickCount = Math.min(6, points.length)
  const tickIdxs = tickCount <= 1 ? [0] : Array.from({ length: tickCount }, (_, i) => {
    const t = i / (tickCount - 1)
    return Math.round(t * (points.length - 1))
  })

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <rect x="0" y="0" width={width} height={height} fill="white" />
      <line
        x1={padding.left}
        y1={padding.top + innerH}
        x2={padding.left + innerW}
        y2={padding.top + innerH}
        stroke="#e2e8f0"
      />
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={padding.top + innerH}
        stroke="#e2e8f0"
      />
      <path d={d} fill="none" stroke={LINE_COLOR} strokeWidth={3} />
      {points.map((p, i) => (
        <circle key={p.xLabel} cx={xs[i]} cy={ys[i]} r={4} fill={LINE_COLOR} />
      ))}
      {tickIdxs.map((i) => (
        <text
          key={points[i].xLabel}
          x={xs[i]}
          y={padding.top + innerH + 20}
          textAnchor="middle"
          fontSize="10"
          fill="#64748b"
        >
          {points[i].xLabel.slice(5)}
        </text>
      ))}
    </svg>
  )
}

const CHART_COLORS = [
  '#C5D6FB',
  '#6391F4',
  '#3C76F1',
  '#366AD9',
]

const LINE_COLOR = '#3C76F1'

function DonutChart({
  items,
  size,
}: {
  items: Array<{ key: string; label: string; value: number }>
  size: number
}) {
  const total = items.reduce((s, i) => s + i.value, 0)
  const r = size / 2
  const outer = r - 6
  const inner = outer * 0.62
  const cx = r
  const cy = r

  let acc = -Math.PI / 2
  const slices = items
    .filter((i) => i.value > 0)
    .map((i, idx) => {
      const angle = total > 0 ? (i.value / total) * Math.PI * 2 : 0
      const start = acc
      const end = acc + angle
      acc = end
      return {
        ...i,
        start,
        end,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      }
    })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s) => (
        <path
          key={s.key}
          d={donutArcPath(cx, cy, outer, inner, s.start, s.end)}
          fill={s.color}
        />
      ))}
      <circle cx={cx} cy={cy} r={inner - 1} fill="white" />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="18" fill="#0f172a" fontWeight="600">
        {total}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="10" fill="#64748b">
        referrals
      </text>
    </svg>
  )
}

function Legend({
  items,
  total,
}: {
  items: Array<{ key: string; label: string; value: number }>
  total: number
}) {
  return (
    <div className="grid gap-2">
      {items.map((i, idx) => {
        const pct = total > 0 ? Math.round((i.value / total) * 100) : 0
        return (
          <div key={i.key} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded"
                style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
              />
              <span className="text-sm text-slate-800">{i.label}</span>
            </div>
            <span className="text-sm font-medium text-slate-700">
              {i.value} ({pct}%)
            </span>
          </div>
        )
      })}
    </div>
  )
}

function polarToCartesian(cx: number, cy: number, r: number, a: number) {
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function donutArcPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  start: number,
  end: number,
) {
  const largeArc = end - start > Math.PI ? 1 : 0
  const p1 = polarToCartesian(cx, cy, outerR, start)
  const p2 = polarToCartesian(cx, cy, outerR, end)
  const p3 = polarToCartesian(cx, cy, innerR, end)
  const p4 = polarToCartesian(cx, cy, innerR, start)

  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ')
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
  optionLabel?: (v: T) => ReactNode
  onChange: (next: T) => void
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as T)}
        className={clsx(
          'w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2',
        )}
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

function Input({
  label,
  type,
  value,
  onChange,
}: {
  label: string
  type?: 'text' | 'date'
  value: string
  onChange: (next: string) => void
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className="w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
      />
    </label>
  )
}
