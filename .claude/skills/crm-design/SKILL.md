---
name: crm-design
description: Use when writing or changing ANY UI in this CRM - a page, dialog, card, badge, form field, empty state, or any styling at all. Covers the token system, the _ui component kit, dark mode and the rules that keep the app looking like one product.
---

# Visual language

## Never hardcode a color

Every color is a semantic token declared in `src/app/globals.css` under `@theme`, with a
dark override under `:root[data-theme="dark"]`. Use the Tailwind class that maps to the
token, and dark mode works for free.

| purpose | token classes |
| --- | --- |
| page background | `bg-bg` |
| card, dialog, popover surface | `bg-surface`, nested `bg-surface-2`, `bg-surface-3` |
| borders | `border-border`, `border-border-strong`, `border-hairline` |
| text | `text-foreground`, `text-muted`, `text-muted-soft` |
| primary action | `bg-primary`, `hover:bg-primary-hover`, `text-primary-foreground` |
| status accents | `blue`, `green`, `orange`, `red`, `purple`, `teal`, `pink`, `indigo`, `cyan`, each with a `-soft` background and a `-text` foreground |
| semantic aliases | `accent`, `warning`, `danger`, each with `-soft` |
| focus ring | `ring-ring` |

`text-red-500`, `bg-gray-100`, `#fff` and `rgb(...)` in a component are all bugs. If a
token seems missing, add it to `@theme` AND to the dark block, do not inline the value.

The nine status accents are the `ColorToken` palette that per-workspace číselníky pick
from. `src/lib/crm/config.ts` `styleMap` maps a token to its dot and badge classes, so a
status badge never hardcodes anything either.

## Use the kit, do not rebuild it

`src/app/_ui/` has thirty components: Avatar, Badge, Button, Card, Checkbox,
ConfirmDialog, DatePicker, DescriptionEditor, Dialog, EmptyState, ExpandableText, Field,
Input, Kbd, Label, Markdown, MultiSelect, PageHeader, PageShell, Pagination, Popover,
Select, Skeleton, Spinner, Stat, StatusDot, Table, Textarea, Toast.

Before writing a new component, check whether one of these already does it. A page is
`PageShell` + `PageHeader` + `Card`s. A form field is `Field` + `Label` + `Input`. A
destructive action is `ConfirmDialog`. An empty list is `EmptyState` with an icon, a title
and a description.

Radix primitives are already wrapped (Dialog, Popover, Select, Checkbox, Tooltip). Import
the wrapper, not `@radix-ui/*` directly.

## Rules that are not negotiable

- **`cursor-pointer` on everything clickable.** Tailwind v4 preflight drops the button
  default in some cases, so rows, headers, chips and popover items set it explicitly.
- **No emoji anywhere.** Icons come from `lucide-react`.
- **No trailing period on headings, labels or table headers.**
- **No em dashes**, in copy or in code. Comma, colon, parentheses, or split the sentence.
- **Money is `80 000 Kč`**: non-breaking thin space as the thousands separator, symbol
  after, no decimals unless they carry meaning. Numeric columns get `tabular-nums` and
  `align: "right"`.
- **Dates are Czech format** via the helpers in `src/lib/dates.ts`, never
  `toLocaleDateString` inline.
- **Czech UI copy with diacritics.** Identifiers, file names and comments are English.
  Terse and factual, no marketing phrasing.
- **Úkoly, never tikety**, in every user-facing string.

## Theme

Light, dark or system. The preference is in localStorage and resolved before first paint
by the inline script in `src/app/layout.tsx` (`src/app/_lib/theme.ts`), which writes
`data-theme` on `<html>`. There is no flash of the wrong theme, and no `prefers-color-scheme`
media query in the CSS, so do not add one. The switch is `ThemeSwitch` in the sidebar
footer.

Test both themes before calling a UI change done. The usual dark-mode bug is a component
that hardcoded a light value.

## Layout

- Page: `PageShell` wraps, `PageHeader` carries the title and primary action.
- Radius is `--radius-md` (0.75rem) by default. Cards use `shadow-soft`, floating layers
  (dialogs, popovers) use `shadow-lifted`.
- Headings use `font-display` with tight tracking; body text uses `font-sans`. Both are
  system font stacks, so there is no webfont to load.
- Breakpoints go up to `5xl` (3840px). Wide tables should use the space, not cap at
  `max-w-7xl`.
