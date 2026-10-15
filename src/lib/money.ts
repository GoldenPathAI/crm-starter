const NBSP = String.fromCharCode(0x00a0)

// The one money format of the app, e.g. "80 000 Kč": whole crowns, thousands and the
// unit separated by a non-breaking space so an amount never wraps.
export const formatCzk = (value: number): string => {
  const rounded = Math.round(value)
  const sign = rounded < 0 ? "-" : ""
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)

  return `${sign}${digits}${NBSP}Kč`
}

export const formatCzkOrDash = (amount: number | undefined): string =>
  amount === undefined ? "-" : formatCzk(amount)
