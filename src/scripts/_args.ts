// Minimal argv helpers shared by the CRM maintenance scripts. Keeps flag parsing
// consistent (--org, --yes, --force) without pulling in a CLI dependency.
const args = (): string[] => process.argv.slice(2)

export const argValue = (flag: string): string | undefined => {
  const list = args()
  const index = list.indexOf(flag)

  return index >= 0 ? list[index + 1] : undefined
}

export const hasFlag = (flag: string): boolean => args().includes(flag)
