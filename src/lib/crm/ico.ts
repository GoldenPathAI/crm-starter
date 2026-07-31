// Czech IČO is 8 digits, but sources often drop leading zeros (ARES exports,
// imported registry numbers, hand-typed values). Canonical form = digits only,
// left-padded to 8, so lookups across systems compare equal.
export function normalizeIco(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }
  const digits = value.replace(/\s+/g, "")
  if (digits.length === 0) {
    return null
  }
  if (/^\d{1,8}$/.test(digits)) {
    return digits.padStart(8, "0")
  }
  return digits
}
