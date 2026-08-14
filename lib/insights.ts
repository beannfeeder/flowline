import {
  type Forecast,
  CADENCE_LABELS,
  monthlyEquivalent,
} from '@/lib/forecast'
import { formatCurrency, formatShortDate } from '@/lib/format'

export type InsightTone = 'critical' | 'warning' | 'positive' | 'neutral'

export interface Insight {
  id: string
  tone: InsightTone
  title: string
  body: string
}

/**
 * Derive human-readable warnings and money-saving suggestions from a forecast.
 * Ordered by urgency: cash crunches first, then trimming ideas.
 */
export function buildInsights(forecast: Forecast): Insight[] {
  const insights: Insight[] = []
  const {
    goesNegative,
    firstNegativeDate,
    lowestBalance,
    lowestDate,
    totalIncome,
    totalExpense,
    net,
    expenseItems,
    expenseByCategory,
  } = forecast

  // 1. Cash-crunch warnings.
  if (goesNegative && firstNegativeDate) {
    insights.push({
      id: 'negative',
      tone: 'critical',
      title: 'Your balance goes negative',
      body: `On ${formatShortDate(firstNegativeDate)} your projected balance drops below zero (${formatCurrency(
        lowestBalance,
      )} at the low point). Move a bill later, add a buffer, or bring income forward before then.`,
    })
  } else if (lowestDate && lowestBalance < totalExpense * 0.15) {
    insights.push({
      id: 'tight',
      tone: 'warning',
      title: 'Things get tight mid-cycle',
      body: `Your thinnest day is ${formatShortDate(
        lowestDate,
      )}, when you'll have about ${formatCurrency(
        lowestBalance,
      )} left. Keep a cushion around then.`,
    })
  } else if (lowestDate) {
    insights.push({
      id: 'safe',
      tone: 'positive',
      title: 'You stay in the green',
      body: `Even at your lowest point (${formatShortDate(
        lowestDate,
      )}) you keep ${formatCurrency(lowestBalance)}. Comfortable headroom all cycle.`,
    })
  }

  // 2. Overall surplus / deficit.
  if (net < 0) {
    insights.push({
      id: 'deficit',
      tone: 'warning',
      title: 'You spend more than you earn',
      body: `Over this window expenses (${formatCurrency(
        totalExpense,
      )}) outpace income (${formatCurrency(totalIncome)}) by ${formatCurrency(
        Math.abs(net),
      )}. Trimming recurring bills is the fastest fix.`,
    })
  } else if (totalIncome > 0) {
    insights.push({
      id: 'surplus',
      tone: 'positive',
      title: `You net ${formatCurrency(net)} this window`,
      body: `Consider auto-moving part of that surplus into savings on payday so it doesn't get absorbed by day-to-day spending.`,
    })
  }

  // 3. Biggest expense — concrete trim suggestion.
  const top = expenseItems[0]
  if (top && top.total > 0) {
    const perMonth = monthlyEquivalent(top.item)
    const trim = top.total * 0.2
    insights.push({
      id: 'biggest',
      tone: 'neutral',
      title: `${top.item.name} is your biggest expense`,
      body: `It runs ${CADENCE_LABELS[
        top.item.cadence
      ].toLowerCase()} and costs about ${formatCurrency(
        perMonth,
      )}/mo (${formatCurrency(top.total)} this window). Cutting it by 20% would free up ${formatCurrency(
        trim,
      )}.`,
    })
  }

  // 4. Category concentration.
  const topCat = expenseByCategory[0]
  if (topCat && totalExpense > 0) {
    const share = topCat.total / totalExpense
    if (share > 0.4 && topCat.category) {
      insights.push({
        id: 'concentration',
        tone: 'neutral',
        title: `${Math.round(share * 100)}% of spending is "${topCat.category}"`,
        body: `${formatCurrency(
          topCat.total,
        )} goes to ${topCat.category}. A single category this large is usually the easiest place to find a quick win.`,
      })
    }
  }

  // 5. Subscription-style small recurring drains.
  const smallRecurring = expenseItems.filter(
    (it) =>
      it.item.cadence !== 'once' &&
      monthlyEquivalent(it.item) > 0 &&
      monthlyEquivalent(it.item) <= 30,
  )
  if (smallRecurring.length >= 3) {
    const monthlySum = smallRecurring.reduce(
      (s, it) => s + monthlyEquivalent(it.item),
      0,
    )
    insights.push({
      id: 'subscriptions',
      tone: 'neutral',
      title: `${smallRecurring.length} small subscriptions add up`,
      body: `Individually cheap, together they're about ${formatCurrency(
        monthlySum,
      )}/mo. Audit them — canceling the ones you forgot about is painless savings.`,
    })
  }

  return insights
}
