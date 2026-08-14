'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Forecast } from '@/lib/forecast'
import { formatCurrency, formatShortDate, formatWeekday } from '@/lib/format'
import { cn } from '@/lib/utils'

const HEIGHT = 320
const PAD = { top: 28, right: 16, bottom: 32, left: 16 }

export function ForecastChart({ forecast }: { forecast: Forecast }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(720)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(w)
    })
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  const { days, lowestDate, lowestBalance } = forecast
  const n = days.length

  const geom = useMemo(() => {
    const plotW = Math.max(width - PAD.left - PAD.right, 10)
    const plotH = HEIGHT - PAD.top - PAD.bottom

    const balances = days.map((d) => d.balance)
    let min = Math.min(0, ...balances)
    let max = Math.max(0, ...balances)
    if (min === max) {
      min -= 1
      max += 1
    }
    const range = max - min
    const padY = range * 0.08
    min -= padY
    max += padY

    const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)
    const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH

    const linePts = days.map((d, i) => [x(i), y(d.balance)] as const)
    const linePath = linePts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`)
      .join(' ')
    const areaPath =
      `M${linePts[0][0].toFixed(2)},${(PAD.top + plotH).toFixed(2)} ` +
      linePts.map((p) => `L${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') +
      ` L${linePts[linePts.length - 1][0].toFixed(2)},${(PAD.top + plotH).toFixed(2)} Z`

    const zeroY = y(0)
    const showZero = min < 0 && max > 0

    return { plotW, plotH, x, y, linePath, areaPath, zeroY, showZero, min, max, bottom: PAD.top + plotH }
  }, [days, n, width])

  const lowestIdx = useMemo(
    () => days.findIndex((d) => d.date === lowestDate),
    [days, lowestDate],
  )

  const activeIdx = hoverIdx ?? lowestIdx
  const activeDay = activeIdx >= 0 ? days[activeIdx] : null

  function handlePointer(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * width
    const rel = (px - PAD.left) / Math.max(geom.plotW, 1)
    const idx = Math.round(rel * (n - 1))
    setHoverIdx(Math.min(Math.max(idx, 0), n - 1))
  }

  // x-axis label indices: first, last, and a few evenly spaced.
  const labelStep = Math.max(1, Math.round(n / 6))
  const labelIdxs = Array.from({ length: n }, (_, i) => i).filter(
    (i) => i % labelStep === 0 || i === n - 1,
  )

  return (
    <div ref={containerRef} className="relative w-full select-none overflow-hidden">
      <svg
        role="img"
        aria-label="Projected daily balance over the forecast window"
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="block max-w-full touch-none"
        onPointerMove={handlePointer}
        onPointerLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--income)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--income)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Danger zone below zero */}
        {geom.showZero && (
          <rect
            x={PAD.left}
            y={geom.zeroY}
            width={geom.plotW}
            height={geom.bottom - geom.zeroY}
            fill="var(--expense)"
            opacity={0.08}
          />
        )}

        {/* Zero baseline */}
        {geom.showZero && (
          <line
            x1={PAD.left}
            x2={PAD.left + geom.plotW}
            y1={geom.zeroY}
            y2={geom.zeroY}
            stroke="var(--expense)"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.5}
          />
        )}

        {/* Area + line */}
        <path d={geom.areaPath} fill="url(#areaFill)" />
        <path
          d={geom.linePath}
          fill="none"
          stroke="var(--chart-3)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Lowest-day marker */}
        {lowestIdx >= 0 && (
          <g>
            <line
              x1={geom.x(lowestIdx)}
              x2={geom.x(lowestIdx)}
              y1={PAD.top}
              y2={geom.bottom}
              stroke="var(--expense)"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              opacity={0.7}
            />
            <circle
              cx={geom.x(lowestIdx)}
              cy={geom.y(lowestBalance)}
              r={6}
              fill="var(--expense)"
              stroke="var(--card)"
              strokeWidth={2}
            />
          </g>
        )}

        {/* Hover marker */}
        {hoverIdx !== null && hoverIdx !== lowestIdx && activeDay && (
          <g>
            <line
              x1={geom.x(hoverIdx)}
              x2={geom.x(hoverIdx)}
              y1={PAD.top}
              y2={geom.bottom}
              stroke="var(--muted-foreground)"
              strokeWidth={1}
              opacity={0.4}
            />
            <circle
              cx={geom.x(hoverIdx)}
              cy={geom.y(activeDay.balance)}
              r={5}
              fill="var(--chart-3)"
              stroke="var(--card)"
              strokeWidth={2}
            />
          </g>
        )}

        {/* X labels */}
        {labelIdxs.map((i) => (
          <text
            key={i}
            x={geom.x(i)}
            y={HEIGHT - 10}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            {formatShortDate(days[i].date)}
          </text>
        ))}
      </svg>

      {/* Tooltip */}
      {activeDay && (
        <ChartTooltip
          x={geom.x(activeIdx)}
          containerWidth={width}
          day={activeDay}
          isLowest={activeIdx === lowestIdx}
        />
      )}
    </div>
  )
}

function ChartTooltip({
  x,
  containerWidth,
  day,
  isLowest,
}: {
  x: number
  containerWidth: number
  day: Forecast['days'][number]
  isLowest: boolean
}) {
  const W = 210
  const left = Math.min(Math.max(x - W / 2, 4), containerWidth - W - 4)
  return (
    <div
      className="pointer-events-none absolute top-1 z-10 rounded-lg border border-border bg-popover/95 p-3 shadow-lg backdrop-blur-sm"
      style={{ left, width: W }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {formatWeekday(day.date)}, {formatShortDate(day.date)}
        </span>
        {isLowest && (
          <span className="rounded bg-expense/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-expense">
            Low
          </span>
        )}
      </div>
      <div
        className={cn(
          'mt-1 font-mono text-lg font-semibold tabular-nums',
          day.balance < 0 ? 'text-expense' : 'text-foreground',
        )}
      >
        {formatCurrency(day.balance)}
      </div>
      {day.occurrences.length > 0 ? (
        <ul className="mt-1.5 space-y-1 border-t border-border/60 pt-1.5">
          {day.occurrences.slice(0, 4).map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">{o.name}</span>
              <span
                className={cn(
                  'font-mono tabular-nums',
                  o.signedAmount >= 0 ? 'text-income' : 'text-expense',
                )}
              >
                {o.signedAmount >= 0 ? '+' : ''}
                {formatCurrency(o.signedAmount)}
              </span>
            </li>
          ))}
          {day.occurrences.length > 4 && (
            <li className="text-[11px] text-muted-foreground">
              +{day.occurrences.length - 4} more
            </li>
          )}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">No activity</p>
      )}
    </div>
  )
}
