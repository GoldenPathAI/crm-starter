---
name: crm-datagrid
description: Use when building or changing ANY list, table or grid surface in this CRM - adding a new list page, adding a column, filter, sort, grouping, saved view or bulk action to an existing one. The shared Browser component is the only table in this app; never hand-roll a second one.
---

# List surfaces run on the Browser

`src/app/_components/browser/` is the house table. Every list in this app uses it. If you
are about to write a `<table>`, a toolbar with a filter dropdown, or a "sort by" select,
stop and use `Browser` instead.

## The split

`Browser<R>` owns all chrome and interaction and is data-agnostic. The RSC page owns the
query. Neither knows about the other's half.

**RSC page (`page.tsx`)**

1. Parse `searchParams` with the helpers in `queryHelpers.ts`.
2. Call `applyDefaultSavedView` (`src/app/_lib/defaultView.ts`) at the very top with the
   raw searchParams, so a starred default view applies on a bare URL.
3. Query the store with the resolved `OrgScope`.
4. Pass `rows`, `total` and the filter option lists down to a client wrapper.

When a group is active, pass ALL matching rows (the Browser buckets client-side).
Otherwise pass only the page slice.

**Client wrapper (`_components/XTable.tsx`, `"use client"`)**

Builds `BrowserColumn<R>[]` and renders `<Browser>`. Nothing else.

## Column shape

```ts
const columns: BrowserColumn<ClientRow>[] = [
  {
    id: "name",
    header: "Klient",
    sortField: "name",
    cell: (row) => <span className="font-medium">{row.name}</span>,
  },
  {
    id: "status",
    header: "Stav",
    sortField: "status",
    filter: {
      kind: "checkbox",
      paramKey: "status",
      label: "Stav",
      options: statusOptions,      // BrowserFilterOption[], value + label + dotClassName
      selected: activeStatuses,
    },
    cell: (row) => <Badge {...badgeFor(row.status)} />,
  },
]
```

Filter kinds are `checkbox` (multi-value, comma separated in the URL), `single`
(one value plus an "all" option) and `dateRange` (two params). Types live in
`browser/types.ts`.

## Hard rules

- **Filters and sorting live in column headers.** Never a control panel above the table.
  This is not a style preference, it is the reason the grid stays readable at 20 columns.
- **Every bit of state lives in the URL.** Filter, sort, group, page, `q`, view. That is
  what makes a view shareable and a saved view possible. Do not put list state in
  `useState`.
- **Grouping is a pure page-supplied bucketizer.** `BrowserGroupConfig.build(rows, group)`
  returns ordered buckets. The page owns domain ordering (status order, a trailing
  "Bez klienta" bucket). Up to two nested levels via `maxLevels: 2`.
- **Row click is `rowHref` or `onRowClick`, never both.** `rowHref` navigates, `onRowClick`
  opens a dialog (the pipeline list does this for deal detail).
- **Inline edit cells are just cell renderers** that call a server action. See the úkoly
  priority, termín and hotovo cells and `InlineEditCell.tsx`.
- Everything clickable gets `cursor-pointer`.

## Working examples, in increasing complexity

| file | shows |
| --- | --- |
| `projekty/_components/ProjectsTable.tsx` | the minimum: columns, one filter, sort |
| `klienti/_components/ClientsTable.tsx` | multi-value filters, grouping, presets |
| `ukoly/_components/TicketsTable.tsx` | view tabs with counts, inline edit cells, two-level grouping |
| `pipeline/_components/PipelineList.tsx` | `onRowClick` opening a detail dialog next to a kanban twin |

Copy the closest one and change the columns. Do not start from scratch.

## Saved views

Saved views are user-scoped rows in `crm.user_saved_views` capturing the normalized query
string. One view per org + user + page can be starred as default (`is_default`). This is
already wired through `SavedViewsMenu`; a new list surface gets it for free as long as it
passes a stable page key.

## Checklist for a new list surface

- [ ] RSC page parses searchParams via `queryHelpers.ts`
- [ ] `applyDefaultSavedView` called first
- [ ] Store query is org-scoped
- [ ] Client wrapper builds typed `BrowserColumn<R>[]`, no `any`
- [ ] Filters and sort are in column headers only
- [ ] Grouping bucketizer is pure and owns its ordering
- [ ] Empty state has an icon, a title and a description
- [ ] Grouped mode passes all rows, ungrouped passes the page slice
