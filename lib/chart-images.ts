// Renders the forecast visualizations to PNG data URLs on an offscreen canvas,
// so they can be embedded as real images inside the exported Excel workbook.
// Fully client-side and offline — no external chart library needed.

import type { Forecast } from '@/lib/forecast'
import { formatShortDate } from '@/lib/format'

// Hex approximations of the app's theme tokens (canvas can't read oklch reliably).
const COLORS = {
  balanceLine: '#24382c',
  income: '#2f9e5e',
  expense: '#df5a34',
  gold: '#cf9f3f',
  blue: '#5273a8',
  purple: '#8a63c4',
  grid: '#e6e3da',
  axis: '#8a877d',
  text: '#33312b',
  mutedText: '#6d6a61',
  areaFill: 'rgba(47, 158, 94, 0.12)',
  negativeFill: 'rgba(223, 90, 52, 0.16)',
  zeroLine: '#df5a34',
  bg: '#ffffff',
}

const CATEGORY_PALETTE = [
  COLORS.expense,
  COLORS.blue,
  COLORS.gold,
  COLORS.income,
  COLORS.purple,
  '#c94f7c',
  '#3fa7a1',
  '#9aa03a',
]

function createCanvas(cssWidth: number, cssHeight: number) {
  const dpr = 2
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(cssWidth * dpr)
  canvas.height = Math.round(cssHeight * dpr)
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, cssWidth, cssHeight)
  return { canvas, ctx }
}

function niceCurrency(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`
  return `${sign}$${Math.round(abs)}`
}

/** Line chart of the projected end-of-day balance, with zero line + lowest-day marker. */
export function renderBalanceChartPng(forecast: Forecast): string {
  const W = 1000
  const H = 420
  const { ctx } = createCanvas(W, H)

  const padL = 74
  const padR = 24
  const padT = 28
  const padB = 46
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const days = forecast.days
  if (days.length === 0) return ''

  const balances = days.map((d) => d.balance)
  let min = Math.min(0, ...balances)
  let max = Math.max(0, ...balances)
  if (min === max) {
    min -= 100
    max += 100
  }
  const pad = (max - min) * 0.08
  min -= pad
  max += pad

  const x = (i: number) =>
    padL + (days.length === 1 ? plotW / 2 : (i / (days.length - 1)) * plotW)
  const y = (v: number) => padT + plotH - ((v - min) / (max - min)) * plotH

  // Title
  ctx.fillStyle = COLORS.text
  ctx.font = '600 18px system-ui, sans-serif'
  ctx.fillText('Projected balance', padL, 18)

  // Horizontal grid + y labels
  ctx.font = '12px system-ui, sans-serif'
  const ticks = 5
  for (let t = 0; t <= ticks; t++) {
    const val = min + ((max - min) * t) / ticks
    const yy = y(val)
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padL, yy)
    ctx.lineTo(W - padR, yy)
    ctx.stroke()
    ctx.fillStyle = COLORS.mutedText
    ctx.textAlign = 'right'
    ctx.fillText(niceCurrency(val), padL - 10, yy + 4)
  }
  ctx.textAlign = 'left'

  // X labels (about 6 evenly spaced dates)
  const labelCount = Math.min(6, days.length)
  for (let l = 0; l < labelCount; l++) {
    const i = Math.round((l / (labelCount - 1)) * (days.length - 1))
    ctx.fillStyle = COLORS.mutedText
    ctx.textAlign = l === 0 ? 'left' : l === labelCount - 1 ? 'right' : 'center'
    ctx.fillText(formatShortDate(days[i].date), x(i), H - padB + 22)
  }
  ctx.textAlign = 'left'

  const zeroY = y(0)

  // Area fill under the line
  ctx.beginPath()
  ctx.moveTo(x(0), y(balances[0]))
  for (let i = 1; i < days.length; i++) ctx.lineTo(x(i), y(balances[i]))
  ctx.lineTo(x(days.length - 1), Math.min(zeroY, padT + plotH))
  ctx.lineTo(x(0), Math.min(zeroY, padT + plotH))
  ctx.closePath()
  ctx.fillStyle = COLORS.areaFill
  ctx.fill()

  // Zero baseline (only if within range)
  if (0 >= min && 0 <= max) {
    ctx.strokeStyle = COLORS.zeroLine
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.moveTo(padL, zeroY)
    ctx.lineTo(W - padR, zeroY)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = COLORS.zeroLine
    ctx.font = '11px system-ui, sans-serif'
    ctx.fillText('$0', W - padR - 22, zeroY - 6)
  }

  // Balance line
  ctx.strokeStyle = COLORS.balanceLine
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x(0), y(balances[0]))
  for (let i = 1; i < days.length; i++) ctx.lineTo(x(i), y(balances[i]))
  ctx.stroke()

  // Lowest-day marker
  if (forecast.lowestDate) {
    const li = days.findIndex((d) => d.date === forecast.lowestDate)
    if (li >= 0) {
      const lx = x(li)
      const ly = y(forecast.lowestBalance)
      ctx.fillStyle = COLORS.expense
      ctx.beginPath()
      ctx.arc(lx, ly, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = COLORS.bg
      ctx.lineWidth = 2
      ctx.stroke()

      const label = `Lowest ${niceCurrency(forecast.lowestBalance)}`
      ctx.font = '600 12px system-ui, sans-serif'
      const tw = ctx.measureText(label).width
      const boxX = Math.min(Math.max(lx - tw / 2 - 8, padL), W - padR - tw - 16)
      const boxY = ly > padT + 40 ? ly - 34 : ly + 14
      ctx.fillStyle = COLORS.expense
      const r = 5
      const bw = tw + 16
      const bh = 22
      ctx.beginPath()
      ctx.roundRect(boxX, boxY, bw, bh, r)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, boxX + 8, boxY + 15)
    }
  }

  return ctx.canvas.toDataURL('image/png')
}

/** Doughnut chart of expense spread by category, with a labeled legend. */
export function renderExpensePiePng(forecast: Forecast): string {
  const W = 1000
  const H = 420
  const { ctx } = createCanvas(W, H)

  ctx.fillStyle = COLORS.text
  ctx.font = '600 18px system-ui, sans-serif'
  ctx.fillText('Where your money goes', 40, 26)

  const data = forecast.expenseByCategory.filter((c) => c.total > 0)
  const total = data.reduce((s, c) => s + c.total, 0)

  if (total === 0 || data.length === 0) {
    ctx.fillStyle = COLORS.mutedText
    ctx.font = '14px system-ui, sans-serif'
    ctx.fillText('No expenses in this window.', 40, 70)
    return ctx.canvas.toDataURL('image/png')
  }

  const cx = 230
  const cy = 230
  const outer = 150
  const inner = 84

  let start = -Math.PI / 2
  data.forEach((c, i) => {
    const angle = (c.total / total) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, outer, start, start + angle)
    ctx.closePath()
    ctx.fillStyle = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]
    ctx.fill()
    start += angle
  })

  // Doughnut hole
  ctx.beginPath()
  ctx.arc(cx, cy, inner, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.bg
  ctx.fill()
  ctx.fillStyle = COLORS.text
  ctx.font = '600 22px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(niceCurrency(total), cx, cy - 2)
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillStyle = COLORS.mutedText
  ctx.fillText('total bills', cx, cy + 18)
  ctx.textAlign = 'left'

  // Legend
  const legendX = 440
  let legendY = 90
  const rowH = 34
  ctx.font = '14px system-ui, sans-serif'
  data.forEach((c, i) => {
    const color = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(legendX, legendY - 12, 14, 14, 3)
    ctx.fill()

    const pct = Math.round((c.total / total) * 100)
    ctx.fillStyle = COLORS.text
    ctx.font = '600 14px system-ui, sans-serif'
    ctx.fillText(c.category || 'Uncategorized', legendX + 24, legendY)
    ctx.fillStyle = COLORS.mutedText
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText(
      `${niceCurrency(c.total)}  ·  ${pct}%`,
      legendX + 24,
      legendY + 16,
    )
    legendY += rowH
  })

  return ctx.canvas.toDataURL('image/png')
}
