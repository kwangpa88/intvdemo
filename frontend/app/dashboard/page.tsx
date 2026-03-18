'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
    ResponsiveContainer,
} from 'recharts'

// ── Constants ────────────────────────────────────────────────────────────────

const CHANNELS = ['Apple', 'Google Play', 'All']

const ROI_SERIES = [
    { key: 'day0_roi', fKey: 'f0', label: '当日', color: '#ef4444' },
    { key: 'day1_roi', fKey: 'f1', label: '1日', color: '#fb923c' },
    { key: 'day3_roi', fKey: 'f3', label: '3日', color: '#2dd4bf' },
    { key: 'day7_roi', fKey: 'f7', label: '7日', color: '#0d9488' },
    { key: 'day14_roi', fKey: 'f14', label: '14日', color: '#22c55e' },
    { key: 'day30_roi', fKey: 'f30', label: '30日', color: '#f59e0b' },
    { key: 'day60_roi', fKey: 'f60', label: '60日', color: '#06b6d4' },
    { key: 'day90_roi', fKey: 'f90', label: '90日', color: '#eab308' },
] as const

const LOG_TICKS = [1, 3, 7, 10, 30, 70, 100, 300, 500, 1000]

// ── Types ────────────────────────────────────────────────────────────────────

interface FilterOptions {
    apps: string[]
    bid_types: string[]
    country_regions: string[]
}

interface DataPoint {
    date: string
    day0_roi: number
    day1_roi: number
    day3_roi: number
    day7_roi: number
    day14_roi: number
    day30_roi: number
    day60_roi: number
    day90_roi: number
}

type ChartPoint = Record<string, number | null | string>

// ── Helpers ──────────────────────────────────────────────────────────────────

const clamp = (v: number | null | undefined) => Math.max(0.01, v ?? 0.01)

// ROI 지표별 통계 기간(일)
const ROI_PERIOD_DAYS: Record<string, number> = {
    day0_roi: 0, day1_roi: 1, day3_roi: 3, day7_roi: 7,
    day14_roi: 14, day30_roi: 30, day60_roi: 60, day90_roi: 90,
}

/**
 * 0% 원인 판별:
 * 데이터 절단일(cutoffDate)과 해당 날짜 간격이 ROI 기간보다 짧으면 '日期不足', 아니면 '真实0%'
 */
function getZeroReason(date: string, cutoffDate: string, periodDays: number): 'insufficient' | 'real' {
    if (periodDays === 0) return 'real'
    const diffDays = (new Date(cutoffDate).getTime() - new Date(date).getTime()) / 86400000
    return diffDays < periodDays ? 'insufficient' : 'real'
}

function buildChartData(data: DataPoint[], forecast: DataPoint[]): ChartPoint[] {
    // 데이터의 마지막 날짜 = 절단일(cutoff)
    const cutoffDate = data.length > 0 ? data[data.length - 1].date : ''
    const nullF = { f0: null, f1: null, f3: null, f7: null, f14: null, f30: null, f60: null, f90: null }
    const nullA = {
        day0_roi: null, day1_roi: null, day3_roi: null, day7_roi: null,
        day14_roi: null, day30_roi: null, day60_roi: null, day90_roi: null,
    }

    const actualPoints: ChartPoint[] = data.map(d => {
        const point: ChartPoint = { date: d.date, ...nullF }
        for (const [key, period] of Object.entries(ROI_PERIOD_DAYS)) {
            const raw = (d as unknown as Record<string, number>)[key]
            point[key] = clamp(raw)
            // raw === 0 일 때만 원인 메타데이터 저장 (진짜 0 vs 날짜 부족)
            if (raw === 0) {
                point[`${key}__zero`] = getZeroReason(d.date, cutoffDate, period)
            }
        }
        return point
    })

    // Bridge: last actual point carries first forecast values so lines connect
    if (actualPoints.length > 0 && forecast.length > 0) {
        const last = actualPoints[actualPoints.length - 1]
        const f0 = forecast[0]
        last.f0 = clamp(f0.day0_roi)
        last.f1 = clamp(f0.day1_roi)
        last.f3 = clamp(f0.day3_roi)
        last.f7 = clamp(f0.day7_roi)
        last.f14 = clamp(f0.day14_roi)
        last.f30 = clamp(f0.day30_roi)
        last.f60 = clamp(f0.day60_roi)
        last.f90 = clamp(f0.day90_roi)
    }

    const forecastPoints: ChartPoint[] = forecast.slice(1).map(d => ({
        date: d.date,
        ...nullA,
        f0: clamp(d.day0_roi),
        f1: clamp(d.day1_roi),
        f3: clamp(d.day3_roi),
        f7: clamp(d.day7_roi),
        f14: clamp(d.day14_roi),
        f30: clamp(d.day30_roi),
        f60: clamp(d.day60_roi),
        f90: clamp(d.day90_roi),
    }))

    return [...actualPoints, ...forecastPoints]
}

const formatDate = (v: string) => {
    const d = new Date(v)
    return `${d.getMonth() + 1}月${d.getDate()}日`
}

const formatPct = (v: number) => `${v}%`

// ── Sub-components ───────────────────────────────────────────────────────────

function SelectField({
    label, value, options, onChange,
}: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
    return (
        <div className="flex flex-col gap-1 min-w-[130px]">
            <label className="text-xs text-gray-500">{label}</label>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        </div>
    )
}

function RadioGroup({
    title, options, value, onChange,
}: { title: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-gray-700">{title}</p>
            <div className="flex items-center gap-8">
                {options.map(o => (
                    <label key={o.value} className="flex items-center gap-2 cursor-pointer text-sm select-none">
                        <span className={[
                            'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
                            value === o.value ? 'border-blue-600' : 'border-gray-400',
                        ].join(' ')}>
                            {value === o.value && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                        </span>
                        <input
                            type="radio"
                            className="sr-only"
                            name={title}
                            value={o.value}
                            checked={value === o.value}
                            onChange={() => onChange(o.value)}
                        />
                        <span className={value === o.value ? 'text-blue-600 font-medium' : 'text-gray-600'}>
                            {o.label}
                        </span>
                    </label>
                ))}
            </div>
        </div>
    )
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
    active?: boolean
    payload?: { dataKey: string; name: string; value: number; color: string; payload: ChartPoint }[]
    label?: string
}) {
    if (!active || !payload?.length) return null
    const isForecast = payload.some(p => p.dataKey?.startsWith('f') && p.value != null)
    // null 값 및 내부용 '_f_' 시리즈 숨김
    const visible = payload.filter(p => p.value != null && !p.name.startsWith('_'))

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs max-w-[260px]">
            <p className="font-semibold text-gray-700 mb-2">
                {label ? formatDate(label) : ''} {isForecast ? '(예측)' : ''}
            </p>
            <div className="flex flex-col gap-1">
                {visible.map(p => {
                    // __zero 메타데이터가 있는 경우 = 원래 0%였던 값
                    const reason = p.payload?.[`${p.dataKey}__zero`] as 'insufficient' | 'real' | undefined
                    const isZero = !!reason
                    return (
                        <div key={p.dataKey} className="flex items-center gap-1.5 flex-wrap">
                            <span className="w-2.5 h-0.5 inline-block shrink-0" style={{ backgroundColor: p.color }} />
                            <span className="text-gray-500 shrink-0">{p.name}:</span>
                            <span className="font-mono font-medium">
                                {isZero ? '0%' : `${Number(p.value).toFixed(2)}%`}
                            </span>
                            {isZero && reason === 'insufficient' && (
                                <span className="text-amber-500 font-normal">(日期不足)</span>
                            )}
                            {isZero && reason === 'real' && (
                                <span className="text-red-400 font-normal">(真实0%)</span>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const [filterOpts, setFilterOpts] = useState<FilterOptions>({ apps: [], bid_types: [], country_regions: [] })
    const [selApp, setSelApp] = useState('')
    const [selBidType, setSelBidType] = useState('')
    const [selCountry, setSelCountry] = useState('')
    const [selChannel, setSelChannel] = useState('Apple')
    const [displayMode, setDisplayMode] = useState<'ma' | 'raw'>('ma')
    const [scaleMode, setScaleMode] = useState<'log' | 'linear'>('log')
    const [chartData, setChartData] = useState<ChartPoint[]>([])
    const [loading, setLoading] = useState(false)

    // Load filter options on mount
    useEffect(() => {
        fetch('/api/roi/filters')
            .then(r => r.json())
            .then((opts: FilterOptions) => {
                setFilterOpts(opts)
                if (opts.apps.length) setSelApp(opts.apps[0])
                if (opts.bid_types.length) setSelBidType(opts.bid_types[0])
                if (opts.country_regions.length) setSelCountry(opts.country_regions[0])
            })
    }, [])

    // Fetch trend data when filters / display mode change
    const fetchTrend = useCallback(() => {
        if (!selApp || !selBidType || !selCountry) return
        setLoading(true)
        const params = new URLSearchParams({
            app: selApp,
            bid_type: selBidType,
            country_region: selCountry,
            days: '90',
            moving_avg: displayMode === 'ma' ? 'true' : 'false',
        })
        fetch(`/api/roi/trend?${params}`)
            .then(r => r.json())
            .then(({ data, forecast }: { data: DataPoint[]; forecast: DataPoint[] }) => {
                setChartData(buildChartData(data, forecast))
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [selApp, selBidType, selCountry, displayMode])

    useEffect(() => { fetchTrend() }, [fetchTrend])

    const labelSuffix = displayMode === 'ma' ? '(7日均值)' : ''

    return (
        <div className="min-h-screen bg-gray-50 p-6 space-y-4">

            {/* Header */}
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                    {selApp || 'App'} - 多时间维度ROI趋势
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                    {displayMode === 'ma' ? '(7日移动平均)' : '(原始数据)'}
                </p>
                <p className="text-xs text-gray-400">数据范围: 最近90天</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4">
                <div className="flex flex-wrap gap-6 items-end">
                    <SelectField label="用户安装渠道" value={selChannel} options={CHANNELS} onChange={setSelChannel} />
                    <SelectField label="出价类型" value={selBidType} options={filterOpts.bid_types} onChange={setSelBidType} />
                    <SelectField label="国家地区" value={selCountry} options={filterOpts.country_regions} onChange={setSelCountry} />
                    <SelectField label="APP" value={selApp} options={filterOpts.apps} onChange={setSelApp} />
                </div>
            </div>

            {/* Options */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4">
                <div className="grid grid-cols-2 divide-x divide-gray-200">
                    <div className="pr-8">
                        <RadioGroup
                            title="数据显示模式"
                            value={displayMode}
                            options={[
                                { value: 'ma', label: '显示移动平均值' },
                                { value: 'raw', label: '显示原始数据' },
                            ]}
                            onChange={v => setDisplayMode(v as 'ma' | 'raw')}
                        />
                    </div>
                    <div className="pl-8">
                        <RadioGroup
                            title="Y轴刻度"
                            value={scaleMode}
                            options={[
                                { value: 'linear', label: '线性刻度' },
                                { value: 'log', label: '对数刻度' },
                            ]}
                            onChange={v => setScaleMode(v as 'log' | 'linear')}
                        />
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-6">
                {loading ? (
                    <div className="h-[450px] flex items-center justify-center text-gray-400 text-sm">
                        데이터 로딩 중…
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="h-[450px] flex items-center justify-center text-gray-400 text-sm">
                        데이터가 없습니다.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={460}>
                        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />

                            <XAxis
                                dataKey="date"
                                tickFormatter={formatDate}
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                interval="preserveStartEnd"
                            />

                            <YAxis
                                scale={scaleMode === 'log' ? 'log' : 'linear'}
                                domain={scaleMode === 'log' ? [0.1, 'auto'] : ['auto', 'auto']}
                                ticks={scaleMode === 'log' ? LOG_TICKS : undefined}
                                tickFormatter={formatPct}
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                width={65}
                                allowDataOverflow={false}
                            />

                            <Tooltip content={<CustomTooltip />} />

                            <Legend
                                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                            />

                            {/* 100% 기준선 */}
                            <ReferenceLine
                                y={100}
                                stroke="#ef4444"
                                strokeWidth={2}
                                label={{ value: '100%回本线', position: 'insideTopLeft', fill: '#ef4444', fontSize: 11 }}
                            />

                            {/* 실제 데이터 라인 (solid) */}
                            {ROI_SERIES.map(s => (
                                <Line
                                    key={s.key}
                                    dataKey={s.key}
                                    name={`${s.label}${labelSuffix}`}
                                    stroke={s.color}
                                    dot={false}
                                    strokeWidth={1.5}
                                    connectNulls={false}
                                />
                            ))}

                            {/* 예측 라인 (dashed) — 첫 번째만 범례 표시 */}
                            {ROI_SERIES.map((s, i) => (
                                <Line
                                    key={`f_${s.key}`}
                                    dataKey={s.fKey}
                                    name={i === 0 ? '预测' : `_f_${s.label}`}
                                    stroke={s.color}
                                    dot={false}
                                    strokeWidth={1.5}
                                    strokeDasharray="5 5"
                                    connectNulls={false}
                                    legendType={i === 0 ? 'plainline' : 'none'}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    )
}
