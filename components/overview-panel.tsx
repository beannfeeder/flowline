'use client'

import {
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Info,
} from 'lucide-react'
import type { Forecast } from '@/lib/forecast'
import { type Insight, buildInsights } from '@/lib/insights'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

const toneStyles: Record<
  Insight['tone'],
  { wrap: string; icon: React.ReactNode }
> = {
  critical: {
    wrap: 'border-expense/40 bg-expense/8',
    icon: <AlertTriangle className="text-expense" />,
  },
  warning: {
    wrap: 'border-chart-4/50 bg-chart-4/10',
    icon: <AlertTriangle className="text-chart-4" />,
  },
  positive: {
    wrap: 'border-income/40 bg-income/8',
    icon: <CheckCircle2 className="text-income" />,
  },
  neutral: {
    wrap: 'border-border bg-card',
    icon: <Lightbulb className="text-foreground" />,
  },
}

export function OverviewPanel({ forecast }: { forecast: Forecast }) {
  const insights = buildInsights(forecast)
  const { expenseByCategory, totalExpense, expenseItems } = forecast

  return (
    <div className="space-y-6">
      {/* Insights & suggestions */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Info className="size-4 text-muted-foreground" />
          What this means
        </h3>
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add some income and bills to see tailored insights.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {insights.map((ins) => {
              const style = toneStyles[ins.tone]
              return (
                <li
                  key={ins.id}
                  className={cn('rounded-xl border p-3.5', style.wrap)}
                >
                  <div className="flex gap-3">
                    <span className="mt-0.5 [&_svg]:size-4.5">{style.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground text-pretty">
                        {ins.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
                        {ins.body}
                      </p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Where the money goes */}
      {totalExpense > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Where your money goes
          </h3>
          <div className="space-y-2.5">
            {expenseByCategory.slice(0, 6).map((cat, i) => {
              const share = cat.total / totalExpense
              return (
                <div key={cat.category}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 text-foreground">
                      {i === 0 && (
                        <span className="rounded bg-expense/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-expense">
                          Top
                        </span>
                      )}
                      {cat.category}
                    </span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {formatCurrency(cat.total)}
                      <span className="ml-1.5 text-xs">
                        {Math.round(share * 100)}%
                      </span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        i === 0 ? 'bg-expense' : 'bg-expense/45',
                      )}
                      style={{ width: `${Math.max(share * 100, 2)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Biggest recurring bills */}
      {expenseItems.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Biggest bills this window
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {expenseItems.slice(0, 5).map((it) => (
              <li
                key={it.item.id}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {it.item.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {it.occurrences}×{' '}
                    {it.occurrences === 1 ? 'charge' : 'charges'} · {it.item.category}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-expense">
                  {formatCurrency(it.total)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
