import { useCallback, useEffect, useMemo, useState } from 'react'

export default function useLocalStorageState<T>(
  key: string,
  initialValue: T,
) {
  const initial = useMemo(() => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return initialValue
      return JSON.parse(raw) as T
    } catch {
      return initialValue
    }
  }, [initialValue, key])

  const [value, setValue] = useState<T>(initial)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) {
        setValue(initialValue)
        return
      }
      setValue(JSON.parse(raw) as T)
    } catch {
      setValue(initialValue)
    }
  }, [key, initialValue])

  const setAndPersist = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          // ignore write errors (e.g. storage full / disabled)
        }
        return resolved
      })
    },
    [key],
  )

  return [value, setAndPersist] as const
}
