// Values that live outside the process (database rows, URL params, API and CLI fields,
// localStorage) keep their lowercase spelling, so they are typed from a readonly tuple
// instead of an enum, whose member key must equal its PascalCase value. This narrows a
// raw string to one of those tuple members.
export const isOneOf = <T extends string>(values: readonly T[], value: string): value is T =>
  values.some((candidate) => candidate === value)
