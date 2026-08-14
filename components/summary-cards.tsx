'use client'

import { ArrowDownRight, ArrowUpRight, TrendingDown, Wallet } from 'lucide-react'
import type { Forecast } from '@/lib/forecast'
import { formatCurrency, formatLongDate } from '@/lib/format'
import { cn } from '@/lib/utils'

export function SummaryCards({ forecast }: { forecast: Forecast }) {
  const { totalIncome, totalExpense, endingBalance, lowestBalance, lowestDate } =
    forecast

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card
        label="Income in"
        value={formatCurrency(totalIncome)}
        icon={<ArrowUpRight className="text-income" />}
        valueClass="text-income"
      />
      <Card
        label="Bills out"
        value={formatCurrency(totalExpense)}
        icon={<ArrowDownRight className="text-expense" />}
        valueClass="text-expense"
      />
      <Card
        label="Projected end balance"
        value={formatCurrency(endingBalance)}
        icon={<Wallet className="text-foreground" />}
        valueClass={endingBalance < 0 ? 'text-expense' : 'text-foreground'}
      />
      <Card
        label="Lowest point"
        value={formatCurrency(lowestBalance)}
        sub={lowestDate ? formatLongDate(lowestDate) : undefined}
        icon={<TrendingDown className="text-expense" />}
        valueClass={lowestBalance < 0 ? 'text-expense' : 'text-foreground'}
        highlight
      />
    </div>
  )
}

function Card({
  label,
  value,
  sub,
  icon,
  valueClass,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  valueClass?: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card p-4',
        highlight && 'bg-accent/60 ring-1 ring-accent-foreground/10',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="[&_svg]:size-4">{icon}</span>
      </div>
      <div
        className={cn(
          'mt-2 font-mono text-xl font-semibold tabular-nums sm:text-2xl',
          valueClass,
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  )
}
