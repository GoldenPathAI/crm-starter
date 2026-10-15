const czkFormatter = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 })

export const formatCzk = (value: number): string => `${czkFormatter.format(Math.round(value))} Kč`

export const formatDueRelative = (daysUntil: number): string => {
  if (daysUntil < 0) {
    return "po termínu"
  }

  if (daysUntil === 0) {
    return "dnes"
  }

  if (daysUntil === 1) {
    return "zítra"
  }

  if (daysUntil <= 4) {
    return `za ${daysUntil} dny`
  }

  return `za ${daysUntil} dní`
}

export const formatDeals = (count: number): string => {
  if (count === 1) {
    return "deal"
  }

  if (count <= 4) {
    return "dealy"
  }

  return "dealů"
}

export const dayWord = (count: number): string => {
  if (count === 1) {
    return "den"
  }

  if (count >= 2 && count <= 4) {
    return "dny"
  }

  return "dní"
}

export const ticketWord = (count: number): string => {
  if (count === 1) {
    return "úkol"
  }

  if (count <= 4) {
    return "úkoly"
  }

  return "úkolů"
}
