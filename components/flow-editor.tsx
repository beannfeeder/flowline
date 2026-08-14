'use client'

import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  type Cadence,
  type FlowItem,
  type FlowKind,
  CADENCE_LABELS,
  monthlyEquivalent,
  todayISO,
} from '@/lib/forecast'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'

const CADENCES: Cadence[] = [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'annually',
  'once',
]

const CATEGORY_SUGGESTIONS: Record<FlowKind, string[]> = {
  income: ['Salary', 'Freelance', 'Side gig', 'Investments', 'Benefits', 'Other'],
  expense: [
    'Housing',
    'Utilities',
    'Groceries',
    'Transport',
    'Insurance',
    'Subscriptions',
    'Debt',
    'Health',
    'Dining',
    'Other',
  ],
}

interface DraftState {
  name: string
  amount: string
  cadence: Cadence
  startDate: string
  category: string
}

function emptyDraft(kind: FlowKind): DraftState {
  return {
    name: '',
    amount: '',
    cadence: 'monthly',
    startDate: todayISO(),
    category: kind === 'income' ? 'Salary' : 'Housing',
  }
}

const inputClass =
  'h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30'

const labelClass = 'text-xs font-medium text-muted-foreground'

export function FlowEditor({
  kind,
  items,
  onAdd,
  onUpdate,
  onRemove,
}: {
  kind: FlowKind
  items: FlowItem[]
  onAdd: (item: FlowItem) => void
  onUpdate: (item: FlowItem) => void
  onRemove: (id: string) => void
}) {
  const [draft, setDraft] = useState<DraftState>(() => emptyDraft(kind))
  const [editingId, setEditingId] = useState<string | null>(null)

  const accent = kind === 'income' ? 'text-income' : 'text-expense'

  function commitDraft() {
    const amount = Number.parseFloat(draft.amount)
    if (!draft.name.trim() || !Number.isFinite(amount) || amount <= 0) return
    onAdd({
      id: crypto.randomUUID(),
      name: draft.name.trim(),
      amount,
      kind,
      cadence: draft.cadence,
      startDate: draft.startDate || todayISO(),
      category: draft.category.trim() || 'Other',
    })
    setDraft(emptyDraft(kind))
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {items.length === 0 && (
          <li className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            No {kind === 'income' ? 'income sources' : 'bills'} yet. Add one below.
          </li>
        )}
        {items.map((item) =>
          editingId === item.id ? (
            <EditRow
              key={item.id}
              kind={kind}
              item={item}
              onCancel={() => setEditingId(null)}
              onSave={(updated) => {
                onUpdate(updated)
                setEditingId(null)
              }}
            />
          ) : (
            <li
              key={item.id}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {item.name}
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {item.category}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {CADENCE_LABELS[item.cadence]}
                  {item.cadence !== 'once' &&
                    ` · ${formatCurrency(monthlyEquivalent(item))}/mo`}
                </div>
              </div>
              <span
                className={cn('shrink-0 font-mono text-sm font-semibold tabular-nums', accent)}
              >
                {kind === 'income' ? '+' : '−'}
                {formatCurrency(item.amount)}
              </span>
              <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${item.name}`}
                  onClick={() => setEditingId(item.id)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => onRemove(item.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ),
        )}
      </ul>

      {/* Add form */}
      <div className="rounded-xl border border-border bg-secondary/50 p-3">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="col-span-2 space-y-1">
            <label className={labelClass} htmlFor={`${kind}-name`}>
              {kind === 'income' ? 'Source' : 'Bill'}
            </label>
            <input
              id={`${kind}-name`}
              className={inputClass}
              placeholder={kind === 'income' ? 'e.g. Paycheck' : 'e.g. Rent'}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) commitDraft()
              }}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClass} htmlFor={`${kind}-amount`}>
              Amount
            </label>
            <input
              id={`${kind}-amount`}
              className={cn(inputClass, 'font-mono')}
              inputMode="decimal"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) commitDraft()
              }}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClass} htmlFor={`${kind}-cadence`}>
              Frequency
            </label>
            <select
              id={`${kind}-cadence`}
              className={inputClass}
              value={draft.cadence}
              onChange={(e) =>
                setDraft({ ...draft, cadence: e.target.value as Cadence })
              }
            >
              {CADENCES.map((c) => (
                <option key={c} value={c}>
                  {CADENCE_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass} htmlFor={`${kind}-date`}>
              {draft.cadence === 'once' ? 'Date' : 'First date'}
            </label>
            <input
              id={`${kind}-date`}
              className={cn(inputClass, 'font-mono')}
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClass} htmlFor={`${kind}-category`}>
              Category
            </label>
            <input
              id={`${kind}-category`}
              className={inputClass}
              list={`${kind}-categories`}
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
            <datalist id={`${kind}-categories`}>
              {CATEGORY_SUGGESTIONS[kind].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <Button
          className="mt-3 w-full"
          variant={kind === 'income' ? 'default' : 'outline'}
          onClick={commitDraft}
          disabled={!draft.name.trim() || !(Number.parseFloat(draft.amount) > 0)}
        >
          <Plus />
          Add {kind === 'income' ? 'income' : 'bill'}
        </Button>
      </div>
    </div>
  )
}

function EditRow({
  kind,
  item,
  onSave,
  onCancel,
}: {
  kind: FlowKind
  item: FlowItem
  onSave: (item: FlowItem) => void
  onCancel: () => void
}) {
  const [d, setD] = useState<DraftState>({
    name: item.name,
    amount: String(item.amount),
    cadence: item.cadence,
    startDate: item.startDate,
    category: item.category,
  })

  function save() {
    const amount = Number.parseFloat(d.amount)
    if (!d.name.trim() || !(amount > 0)) return
    onSave({
      ...item,
      name: d.name.trim(),
      amount,
      cadence: d.cadence,
      startDate: d.startDate || item.startDate,
      category: d.category.trim() || 'Other',
    })
  }

  return (
    <li className="rounded-lg border border-ring/50 bg-card p-3 ring-3 ring-ring/20">
      <div className="grid grid-cols-2 gap-2.5">
        <input
          className={cn(inputClass, 'col-span-2')}
          value={d.name}
          onChange={(e) => setD({ ...d, name: e.target.value })}
          aria-label="Name"
        />
        <input
          className={cn(inputClass, 'font-mono')}
          type="number"
          min="0"
          step="0.01"
          value={d.amount}
          onChange={(e) => setD({ ...d, amount: e.target.value })}
          aria-label="Amount"
        />
        <select
          className={inputClass}
          value={d.cadence}
          onChange={(e) => setD({ ...d, cadence: e.target.value as Cadence })}
          aria-label="Frequency"
        >
          {CADENCES.map((c) => (
            <option key={c} value={c}>
              {CADENCE_LABELS[c]}
            </option>
          ))}
        </select>
        <input
          className={cn(inputClass, 'font-mono')}
          type="date"
          value={d.startDate}
          onChange={(e) => setD({ ...d, startDate: e.target.value })}
          aria-label="First date"
        />
        <input
          className={inputClass}
          list={`${kind}-categories`}
          value={d.category}
          onChange={(e) => setD({ ...d, category: e.target.value })}
          aria-label="Category"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={save} className="flex-1">
          <Check />
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X />
          Cancel
        </Button>
      </div>
    </li>
  )
}
