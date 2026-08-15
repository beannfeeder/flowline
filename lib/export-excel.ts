// Builds and downloads a formatted .xlsx workbook of the forecast:
// - Overview sheet with headline metrics, insights, and embedded chart images
// - Income & expenses sheet with every item and its computed totals
// - Daily forecast sheet with the day-by-day balance walk
// Runs entirely in the browser (offline-friendly).

import ExcelJS from 'exceljs'
import {
  type Forecast,
  type FlowItem,
  CADENCE_LABELS,
  monthlyEquivalent,
  occurrencesInRange,
} from '@/lib/forecast'
import { buildInsights } from '@/lib/insights'
import { renderBalanceChartPng, renderExpensePiePng } from '@/lib/chart-images'
import { formatShortDate } from '@/lib/format'

const CURRENCY_FMT = '$#,##0.00'
const INK = 'FF24382C' // dark green
const HEADER_FILL = 'FF24382C'
const HEADER_TEXT = 'FFF3F5EC'
const ZEBRA = 'FFF4F2EC'
const INCOME_TEXT = 'FF1F7A45'
const EXPENSE_TEXT = 'FFC24A26'

interface ExportArgs {
  forecast: Forecast
  items: FlowItem[]
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT }, size: 11 }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_FILL },
    }
    cell.alignment = { vertical: 'middle' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBC8BE' } } }
  })
  row.height = 22
}

function download(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function exportForecastToExcel({ forecast, items }: ExportArgs) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Flowline'
  wb.created = new Date()

  /* ------------------------------------------------------------------ */
  /* Overview sheet                                                      */
  /* ------------------------------------------------------------------ */
  const overview = wb.addWorksheet('Overview', {
    views: [{ showGridLines: false }],
  })
  overview.columns = [
    { width: 30 },
    { width: 22 },
    { width: 4 },
    { width: 60 },
  ]

  const title = overview.getCell('A1')
  title.value = 'Flowline — Cash-Flow Forecast'
  title.font = { bold: true, size: 18, color: { argb: INK } }
  overview.getCell('A2').value = `${formatShortDate(forecast.startDate)} → ${formatShortDate(
    forecast.endDate,
  )}  ·  ${forecast.days.length} days`
  overview.getCell('A2').font = { color: { argb: 'FF6D6A61' }, size: 11 }

  const metrics: [string, number, string?][] = [
    ['Starting balance', forecast.startingBalance],
    ['Total income', forecast.totalIncome, 'income'],
    ['Total expenses', forecast.totalExpense, 'expense'],
    ['Net change', forecast.net],
    ['Projected end balance', forecast.endingBalance],
    ['Lowest balance', forecast.lowestBalance],
  ]

  let r = 4
  const mHead = overview.getRow(r)
  mHead.getCell(1).value = 'Metric'
  mHead.getCell(2).value = 'Value'
  styleHeaderRow(mHead)
  r++

  metrics.forEach(([label, value, tone], i) => {
    const row = overview.getRow(r)
    row.getCell(1).value = label
    const vc = row.getCell(2)
    vc.value = value
    vc.numFmt = CURRENCY_FMT
    vc.font = {
      bold: true,
      color: {
        argb:
          tone === 'income'
            ? INCOME_TEXT
            : tone === 'expense'
              ? EXPENSE_TEXT
              : value < 0
                ? EXPENSE_TEXT
                : INK,
      },
    }
    if (i % 2 === 1) {
      row.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: ZEBRA },
      }
      row.getCell(2).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: ZEBRA },
      }
    }
    r++
  })

  // Lowest-day callout
  r++
  const low = overview.getRow(r)
  low.getCell(1).value = 'Tightest day'
  low.getCell(1).font = { bold: true, color: { argb: INK } }
  low.getCell(2).value = forecast.lowestDate
    ? formatShortDate(forecast.lowestDate)
    : '—'
  low.getCell(2).font = { bold: true, color: { argb: EXPENSE_TEXT } }

  // Insights (right column)
  const insights = buildInsights(forecast)
  overview.getCell('D4').value = 'Insights & suggestions'
  overview.getCell('D4').font = { bold: true, size: 12, color: { argb: INK } }
  let ir = 5
  insights.forEach((ins) => {
    const tCell = overview.getCell(`D${ir}`)
    tCell.value = `• ${ins.title}`
    tCell.font = {
      bold: true,
      size: 11,
      color: {
        argb:
          ins.tone === 'critical' || ins.tone === 'warning'
            ? EXPENSE_TEXT
            : ins.tone === 'positive'
              ? INCOME_TEXT
              : INK,
      },
    }
    ir++
    const bCell = overview.getCell(`D${ir}`)
    bCell.value = ins.body
    bCell.font = { size: 10, color: { argb: 'FF54524B' } }
    bCell.alignment = { wrapText: true, vertical: 'top' }
    overview.getRow(ir).height = 30
    ir += 1
  })

  // Embed charts below the metrics table
  const balancePng = renderBalanceChartPng(forecast)
  const piePng = renderExpensePiePng(forecast)

  const chartStartRow = Math.max(r, ir) + 2
  overview.getCell(`A${chartStartRow}`).value = 'Visualizations'
  overview.getCell(`A${chartStartRow}`).font = {
    bold: true,
    size: 12,
    color: { argb: INK },
  }

  if (balancePng) {
    const id1 = wb.addImage({ base64: balancePng, extension: 'png' })
    overview.addImage(id1, {
      tl: { col: 0, row: chartStartRow + 1 },
      ext: { width: 720, height: 302 },
    })
  }
  if (piePng) {
    const id2 = wb.addImage({ base64: piePng, extension: 'png' })
    overview.addImage(id2, {
      tl: { col: 0, row: chartStartRow + 18 },
      ext: { width: 720, height: 302 },
    })
  }

  /* ------------------------------------------------------------------ */
  /* Income & Expenses sheet                                             */
  /* ------------------------------------------------------------------ */
  const flows = wb.addWorksheet('Income & Expenses', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
  })
  flows.columns = [
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Cadence', key: 'cadence', width: 16 },
    { header: 'Amount', key: 'amount', width: 14 },
    { header: 'Monthly equivalent', key: 'monthly', width: 18 },
    { header: 'First date', key: 'first', width: 14 },
    { header: 'Occurrences in window', key: 'occ', width: 20 },
    { header: 'Total in window', key: 'total', width: 16 },
  ]
  styleHeaderRow(flows.getRow(1))

  // Income first, then expenses; each sorted by window total desc.
  const withStats = items.map((item) => {
    const dates = occurrencesInRange(item, forecast.startDate, forecast.endDate)
    return {
      item,
      occurrences: dates.length,
      total: dates.length * item.amount,
    }
  })
  const ordered = withStats.sort((a, b) => {
    if (a.item.kind !== b.item.kind) return a.item.kind === 'income' ? -1 : 1
    return b.total - a.total
  })

  ordered.forEach((row, i) => {
    const isIncome = row.item.kind === 'income'
    const excelRow = flows.addRow({
      name: row.item.name,
      type: isIncome ? 'Income' : 'Expense',
      category: row.item.category || '—',
      cadence: CADENCE_LABELS[row.item.cadence],
      amount: row.item.amount,
      monthly: monthlyEquivalent(row.item),
      first: formatShortDate(row.item.startDate),
      occ: row.occurrences,
      total: row.total,
    })
    excelRow.getCell('amount').numFmt = CURRENCY_FMT
    excelRow.getCell('monthly').numFmt = CURRENCY_FMT
    excelRow.getCell('total').numFmt = CURRENCY_FMT
    excelRow.getCell('type').font = {
      bold: true,
      color: { argb: isIncome ? INCOME_TEXT : EXPENSE_TEXT },
    }
    if (i % 2 === 1) {
      excelRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: ZEBRA },
        }
      })
    }
  })

  // Totals row
  const totalRow = flows.addRow({
    name: 'TOTAL',
    type: '',
    category: '',
    cadence: '',
    amount: null,
    monthly: null,
    first: '',
    occ: null,
    total: forecast.totalIncome - forecast.totalExpense,
  })
  totalRow.getCell('total').numFmt = CURRENCY_FMT
  totalRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: INK } }
    cell.border = { top: { style: 'thin', color: { argb: 'FFCBC8BE' } } }
  })

  /* ------------------------------------------------------------------ */
  /* Daily Forecast sheet                                                */
  /* ------------------------------------------------------------------ */
  const daily = wb.addWorksheet('Daily Forecast', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
  })
  daily.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Income', key: 'income', width: 14 },
    { header: 'Expenses', key: 'expense', width: 14 },
    { header: 'Net change', key: 'net', width: 14 },
    { header: 'End balance', key: 'balance', width: 16 },
    { header: 'Transactions', key: 'tx', width: 52 },
  ]
  styleHeaderRow(daily.getRow(1))

  forecast.days.forEach((day, i) => {
    const dayIncome = day.occurrences
      .filter((o) => o.signedAmount > 0)
      .reduce((s, o) => s + o.signedAmount, 0)
    const dayExpense = day.occurrences
      .filter((o) => o.signedAmount < 0)
      .reduce((s, o) => s + -o.signedAmount, 0)
    const tx = day.occurrences
      .map(
        (o) =>
          `${o.name} (${o.signedAmount > 0 ? '+' : '-'}$${Math.abs(
            o.signedAmount,
          ).toLocaleString('en-US')})`,
      )
      .join(', ')

    const row = daily.addRow({
      date: formatShortDate(day.date),
      income: dayIncome || null,
      expense: dayExpense || null,
      net: day.delta || null,
      balance: day.balance,
      tx,
    })
    row.getCell('income').numFmt = CURRENCY_FMT
    row.getCell('expense').numFmt = CURRENCY_FMT
    row.getCell('net').numFmt = CURRENCY_FMT
    row.getCell('balance').numFmt = CURRENCY_FMT
    if (dayIncome) row.getCell('income').font = { color: { argb: INCOME_TEXT } }
    if (dayExpense)
      row.getCell('expense').font = { color: { argb: EXPENSE_TEXT } }

    const balCell = row.getCell('balance')
    balCell.font = {
      bold: true,
      color: { argb: day.balance < 0 ? EXPENSE_TEXT : INK },
    }
    if (day.date === forecast.lowestDate) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFBE3DA' },
        }
      })
    } else if (i % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: ZEBRA },
        }
      })
    }
  })

  /* ------------------------------------------------------------------ */
  const buffer = await wb.xlsx.writeBuffer()
  download(buffer as ArrayBuffer, `flowline-forecast-${forecast.startDate}.xlsx`)
}
