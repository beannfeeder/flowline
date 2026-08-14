'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Persist state to localStorage so the forecaster works fully offline and
 * survives reloads. Falls back to the initial value during SSR / before hydration.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T | (() => T),
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initialValue)
  const [hydrated, setHydrated] = useState(false)
  const keyRef = useRef(key)
  keyRef.current = key

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) {
        setValue(JSON.parse(raw) as T)
      }
    } catch {
      // Ignore malformed or unavailable storage.
    } finally {
      setHydrated(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved =
        typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      try {
        window.localStorage.setItem(keyRef.current, JSON.stringify(resolved))
      } catch {
        // Storage may be full or disabled; keep in-memory value regardless.
      }
      return resolved
    })
  }, [])

  return [value, set, hydrated]
}
