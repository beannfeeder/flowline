'use client'

import { useMemo } from 'react'
import { RotateCcw, Wallet, CalendarDays, TrendingUp, Waves } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FlowEditor } from '@/components/flow-editor'
import { ForecastChart } from '@/components/forecast-chart'
import { SummaryCards } from '@/components/summary-cards'
import { OverviewPanel } from '@/components/overview-panel'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { type FlowItem, buildForecast, todayISO, addDays, parseDate, toISO } from '@/lib/forecast'
import { formatLongDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'driftline.state.v1'

interface AppState {
  items: FlowItem[]
  startingBalance: number
  startDate: string
  horizonDays: number
}

function seedState(): AppState {
  const today = todayISO()
  const d = (offset: number) => toISO(addDays(parseDate(today), offset))
  return {
    startingBalance: 1850,
    startDate: today,
    horizonDays: 30,
    items: [
      { id: 's1', name: 'Paycheck', amount: 2600, kind: 'income', cadence: 'biweekly', startDate: d(4), category: 'Salary' },
      { id: 's2', name: 'Freelance', amount: 650, kind: 'income', cadence: 'monthly', startDate: d(12), category: 'Freelance' },
      { id: 'e1', name: 'Rent', amount: 1450, kind: 'expense', cadence: 'monthly', startDate: d(1), category: 'Housing' },
      { id: 'e2', name: 'Groceries', amount: 130, kind: 'expense', cadence: 'weekly', startDate: d(2), category: 'Groceries' },
      { id: 'e3', name: 'Car insurance', amount: 145, kind: 'expense', cadence: 'monthly', startDate: d(8), category: 'Insurance' },
      { id: 'e4', name: 'Electricity', amount: 95, kind: 'expense', cadence: 'monthly', startDate: d(15), category: 'Utilities' },
      { id: 'e5', name: 'Phone', amount: 55, kind: 'expense', cadence: 'monthly', startDate: d(9), category: 'Utilities' },
      { id: 'e6', name: 'Streaming bundle', amount: 24, kind: 'expense', cadence: 'monthly', startDate: d(6), category: 'Subscriptions' },
      { id: 'e7', name: 'Music', amount: 12, kind: 'expense', cadence: 'monthly', startDate: d(3), category: 'Subscriptions' },
      { id: 'e8', name: 'Gym', amount: 40, kind: 'expense', cadence: 'monthly', startDate: d(18), category: 'Health' },
      { id: 'e9', name: 'Domain renewal', amount: 180, kind: 'expense', cadence: 'annually', startDate: d(21), category: 'Subscriptions' },
    ],
  }
}

const HORIZONS = [30, 60, 90]

const inputClass =
  'h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30'

export function Forecaster() {
  const [state, setState, hydrated] = useLocalStorage<AppState>(
    STORAGE_KEY,
    seedState,
  )

  const forecast = useMemo(
    () =>
      buildForecast({
        items: state.items,
        startingBalance: state.startingBalance,
        startDate: state.startDate,
        horizonDays: state.horizonDays,
      }),
    [state],
  )

  const income = state.items.filter((i) => i.kind === 'income')
  const expenses = state.items.filter((i) => i.kind === 'expense')

  const addItem = (item: FlowItem) =>
    setState((s) => ({ ...s, items: [...s.items, item] }))
  const updateItem = (item: FlowItem) =>
    setState((s) => ({
      ...s,
      items: s.items.map((i) => (i.id === item.id ? item : i)),
    }))
  const removeItem = (id: string) =>
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Waves className="size-5" />
            </span>
            <span className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Driftline
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground text-balance sm:text-3xl">
            See exactly when your balance runs thin.
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground text-pretty">
            Plug in your income and recurring bills. Driftline models every
            overlapping cycle and pinpoints the day cash gets tight — all in your
            browser, fully offline.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (
              window.confirm(
                'Reset to the sample data? Your current entries will be cleared.',
              )
            ) {
              setState(seedState())
            }
          }}
        >
          <RotateCcw />
          Reset
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* Left: inputs */}
        <div className="min-w-0 space-y-6">
          {/* Settings */}
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Setup</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                  htmlFor="starting-balance"
                >
                  <Wallet className="size-3.5" />
                  Starting balance today
                </label>
                <input
                  id="starting-balance"
                  className={cn(inputClass, 'font-mono')}
                  type="number"
                  step="0.01"
                  value={Number.isFinite(state.startingBalance) ? state.startingBalance : ''}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      startingBalance: Number.parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <label
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                  htmlFor="start-date"
                >
                  <CalendarDays className="size-3.5" />
                  From
                </label>
                <input
                  id="start-date"
                  className={cn(inputClass, 'font-mono')}
                  type="date"
                  value={state.startDate}
                  onChange={(e) =>
                    setState((s) => ({ ...s, startDate: e.target.value || todayISO() }))
                  }
                />
              </div>
              <div className="space-y-1">
                <label
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                  htmlFor="horizon"
                >
                  <TrendingUp className="size-3.5" />
                  Look ahead
                </label>
                <div className="flex gap-1 rounded-lg border border-border p-0.5">
                  {HORIZONS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setState((s) => ({ ...s, horizonDays: h }))}
                      className={cn(
                        'h-8 flex-1 rounded-md text-xs font-medium transition-colors',
                        state.horizonDays === h
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {h}d
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Income */}
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Income</h2>
              <span className="size-2 rounded-full bg-income" aria-hidden />
            </div>
            <FlowEditor
              kind="income"
              items={income}
              onAdd={addItem}
              onUpdate={updateItem}
              onRemove={removeItem}
            />
          </section>

          {/* Expenses */}
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Recurring bills
              </h2>
              <span className="size-2 rounded-full bg-expense" aria-hidden />
            </div>
            <FlowEditor
              kind="expense"
              items={expenses}
              onAdd={addItem}
              onUpdate={updateItem}
              onRemove={removeItem}
            />
          </section>
        </div>

        {/* Right: forecast */}
        <div className="min-w-0 space-y-6">
          <SummaryCards forecast={forecast} />

          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                Projected balance
              </h2>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded-full bg-chart-3" />
                  Balance
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-expense" />
                  Lowest day
                </span>
              </div>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              {formatLongDate(forecast.startDate)} → {formatLongDate(forecast.endDate)}
            </p>
            <ForecastChart forecast={forecast} />
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <OverviewPanel forecast={forecast} />
          </section>
        </div>
      </div>

      <footer className="mt-10 border-t border-border pt-5 text-center text-xs text-muted-foreground">
        {hydrated ? 'Saved on this device' : 'Loading…'} · Driftline stores
        everything locally in your browser. No account, no cloud.
      </footer>
    </div>
  )
}
