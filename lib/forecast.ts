// Core cash-flow forecasting engine.
// Handles overlapping recurrence cycles (weekly, biweekly, monthly, quarterly,
// annual, one-time) and computes the projected daily balance plus the exact
// day the balance dips lowest.

export type Cadence =
  | 'once'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'annually'

export type FlowKind = 'income' | 'expense'

export interface FlowItem {
  id: string
  name: string
  /** Always a positive number; sign is derived from `kind`. */
  amount: number
  kind: FlowKind
  cadence: Cadence
  /** ISO date (YYYY-MM-DD) of the first occurrence. */
  startDate: string
  category: string
}

export interface Occurrence {
  id: string
  itemId: string
  name: string
  kind: FlowKind
  category: string
  /** ISO date of this specific occurrence. */
  date: string
  /** Signed amount: positive for income, negative for expense. */
  signedAmount: number
}

export interface DayPoint {
  date: string
  /** Net change on this day. */
  delta: number
  /** Balance at the end of this day. */
  balance: number
  occurrences: Occurrence[]
}

export interface CategoryTotal {
  category: string
  total: number
}

export interface ItemTotal {
  item: FlowItem
  /** Number of times it occurs in the window. */
  occurrences: number
  /** Total (unsigned) amount over the window. */
  total: number
}

export interface Forecast {
  days: DayPoint[]
  startDate: string
  endDate: string
  startingBalance: number
  endingBalance: number
  totalIncome: number
  totalExpense: number
  net: number
  /** The lowest end-of-day balance in the window. */
  lowestBalance: number
  lowestDate: string | null
  /** True if the projected balance goes below zero at any point. */
  goesNegative: boolean
  /** First date the balance drops below zero, if any. */
  firstNegativeDate: string | null
  expenseByCategory: CategoryTotal[]
  incomeByCategory: CategoryTotal[]
  expenseItems: ItemTotal[]
}

const MS_PER_DAY = 86_400_000

export const CADENCE_LABELS: Record<Cadence, string> = {
  once: 'One-time',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
}

/** Parse an ISO date string into a UTC-noon Date to dodge DST/timezone drift. */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0))
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

export function todayISO(): string {
  return toISO(new Date())
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / MS_PER_DAY)
}

/**
 * Add `n` months to a date while preserving the intended day-of-month.
 * If the target month is shorter (e.g. the 31st into February), it clamps to
 * the last valid day of that month — matching how real billing cycles behave.
 */
function addMonthsClamped(base: Date, n: number, anchorDay: number): Date {
  const year = base.getUTCFullYear()
  const month = base.getUTCMonth() + n
  const targetYear = year + Math.floor(month / 12)
  const targetMonth = ((month % 12) + 12) % 12
  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const day = Math.min(anchorDay, daysInMonth)
  return new Date(Date.UTC(targetYear, targetMonth, day, 12, 0, 0, 0))
}

/**
 * Generate every occurrence of an item that falls within [rangeStart, rangeEnd].
 * Steps forward from the item's start date according to its cadence, so cycles
 * that overlap in the window naturally stack on the correct days.
 */
export function occurrencesInRange(
  item: FlowItem,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  const start = parseDate(item.startDate)
  const from = parseDate(rangeStart)
  const to = parseDate(rangeEnd)
  const out: string[] = []

  if (item.cadence === 'once') {
    if (start >= from && start <= to) out.push(toISO(start))
    return out
  }

  const anchorDay = start.getUTCDate()
  let cursor = start
  let i = 0
  // Hard cap to avoid any runaway loop.
  const MAX_ITER = 10_000

  while (i < MAX_ITER) {
    if (cursor > to) break
    if (cursor >= from) out.push(toISO(cursor))

    i += 1
    switch (item.cadence) {
      case 'weekly':
        cursor = addDays(start, i * 7)
        break
      case 'biweekly':
        cursor = addDays(start, i * 14)
        break
      case 'monthly':
        cursor = addMonthsClamped(start, i, anchorDay)
        break
      case 'quarterly':
        cursor = addMonthsClamped(start, i * 3, anchorDay)
        break
      case 'annually':
        cursor = addMonthsClamped(start, i * 12, anchorDay)
        break
    }
  }

  return out
}

/** Normalize any cadence into an average monthly cost for comparison/insights. */
export function monthlyEquivalent(item: FlowItem): number {
  switch (item.cadence) {
    case 'weekly':
      return (item.amount * 52) / 12
    case 'biweekly':
      return (item.amount * 26) / 12
    case 'monthly':
      return item.amount
    case 'quarterly':
      return item.amount / 3
    case 'annually':
      return item.amount / 12
    case 'once':
      return 0
  }
}

export interface BuildForecastArgs {
  items: FlowItem[]
  startingBalance: number
  startDate: string
  horizonDays: number
}

export function buildForecast({
  items,
  startingBalance,
  startDate,
  horizonDays,
}: BuildForecastArgs): Forecast {
  const start = parseDate(startDate)
  const endDate = toISO(addDays(start, horizonDays - 1))

  // Bucket signed amounts + occurrence records per ISO day.
  const dayMap = new Map<string, { delta: number; occ: Occurrence[] }>()
  for (let d = 0; d < horizonDays; d++) {
    dayMap.set(toISO(addDays(start, d)), { delta: 0, occ: [] })
  }

  const expenseItemMap = new Map<string, ItemTotal>()

  for (const item of items) {
    if (!Number.isFinite(item.amount) || item.amount <= 0) continue
    const dates = occurrencesInRange(item, startDate, endDate)
    const sign = item.kind === 'income' ? 1 : -1

    if (item.kind === 'expense') {
      expenseItemMap.set(item.id, {
        item,
        occurrences: dates.length,
        total: dates.length * item.amount,
      })
    }

    for (const date of dates) {
      const bucket = dayMap.get(date)
      if (!bucket) continue
      bucket.delta += sign * item.amount
      bucket.occ.push({
        id: `${item.id}-${date}`,
        itemId: item.id,
        name: item.name,
        kind: item.kind,
        category: item.category,
        date,
        signedAmount: sign * item.amount,
      })
    }
  }

  const days: DayPoint[] = []
  let running = startingBalance
  let totalIncome = 0
  let totalExpense = 0
  let lowestBalance = Number.POSITIVE_INFINITY
  let lowestDate: string | null = null
  let firstNegativeDate: string | null = null

  const expenseByCat = new Map<string, number>()
  const incomeByCat = new Map<string, number>()

  for (let d = 0; d < horizonDays; d++) {
    const date = toISO(addDays(start, d))
    const bucket = dayMap.get(date)!
    running += bucket.delta

    for (const o of bucket.occ) {
      if (o.signedAmount >= 0) {
        totalIncome += o.signedAmount
        incomeByCat.set(o.category, (incomeByCat.get(o.category) ?? 0) + o.signedAmount)
      } else {
        totalExpense += -o.signedAmount
        expenseByCat.set(o.category, (expenseByCat.get(o.category) ?? 0) + -o.signedAmount)
      }
    }

    if (running < lowestBalance) {
      lowestBalance = running
      lowestDate = date
    }
    if (running < 0 && firstNegativeDate === null) {
      firstNegativeDate = date
    }

    days.push({
      date,
      delta: bucket.delta,
      balance: running,
      occurrences: bucket.occ.sort((a, b) => a.signedAmount - b.signedAmount),
    })
  }

  const sortDesc = (m: Map<string, number>): CategoryTotal[] =>
    [...m.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)

  return {
    days,
    startDate,
    endDate,
    startingBalance,
    endingBalance: running,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    lowestBalance: days.length ? lowestBalance : startingBalance,
    lowestDate,
    goesNegative: firstNegativeDate !== null,
    firstNegativeDate,
    expenseByCategory: sortDesc(expenseByCat),
    incomeByCategory: sortDesc(incomeByCat),
    expenseItems: [...expenseItemMap.values()]
      .filter((it) => it.total > 0)
      .sort((a, b) => b.total - a.total),
  }
}
