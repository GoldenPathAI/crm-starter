// Copy-on-write helpers for the few collection edits the UI makes, so callers never
// mutate state they received from React or from a caller.

export const insertAt = <T>(items: readonly T[], index: number, item: T): T[] => [
  ...items.slice(0, index),
  item,
  ...items.slice(index),
]

export const toggleMember = <T>(set: ReadonlySet<T>, value: T): Set<T> =>
  set.has(value)
    ? new Set([...set].filter((entry) => entry !== value))
    : new Set([...set, value])

// Object.fromEntries widens the keys to string. The keys here come from a typed tuple,
// so the record is complete by construction and the assertion only restores that.
export const recordFromKeys = <K extends string, V>(
  keys: readonly K[],
  valueFor: (key: K) => V,
): Record<K, V> => Object.fromEntries(keys.map((key) => [key, valueFor(key)])) as Record<K, V>
