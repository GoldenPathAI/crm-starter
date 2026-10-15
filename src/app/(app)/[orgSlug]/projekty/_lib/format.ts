const NBSP = String.fromCharCode(0x00a0)

export const formatCzk = (value: number): string => {
  const rounded = Math.round(value)
  const sign = rounded < 0 ? "-" : ""
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)

  return `${sign}${digits}${NBSP}Kč`
}
