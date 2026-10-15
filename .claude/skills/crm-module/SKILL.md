---
name: crm-module
description: Use when adding a new entity or module to this CRM (a new table with its own pages, actions, API routes and CLI verbs), or when extending an existing entity with a new field. Walks the full vertical slice in the order that keeps schema, store, API, CLI and UI from drifting apart.
---

# Adding a module to this CRM

Every existing module (clients, deals, projects, tickets, people, documents) is the same
vertical slice. Build the new one in this order, top to bottom. Skipping a layer is how
the layers drift.

## 1. Types

`src/core/types/crm.types.ts`. Add the domain interface. Enum-ish fields are `string`,
not a literal union: they are validated per workspace at the boundary.

If the entity needs its own číselník, add the kind to `EnumKind`, its defaults to
`DEFAULT_ENUM_OPTIONS` in `src/core/enumDefaults.ts`, and any semantic the code branches
on to `REQUIRED_SEMANTICS`. Code must branch on `semantic`, never on a value slug.

## 2. Schema and migration

`src/lib/db/schema/crm.ts`. The table MUST carry:

- `id: text().primaryKey()`
- `organizationId` with `references(() => organizations.id, { onDelete: "cascade" })`
- `createdByUserId` referencing users with `onDelete: "set null"`
- `createdAt` (and `updatedAt` if the row is editable)
- an index on `(organization_id, <the column you filter by most>)`

Then hand-write the matching numbered SQL in `drizzle/`. Idempotent, applied by
`pnpm db:migrate`. Drizzle-kit never auto-applies here.

If the entity should be audited (it almost always should), add it to the `audited` array
in a new migration modelled on `drizzle/0002_audit_triggers.sql`, and to `UNDO_TABLES` in
`src/lib/crm/audit/undo.ts` if it should be undoable.

## 3. Store

`src/lib/crm/store/<entity>.ts`. This is the canonical write layer, where invariants live.

- Every exported function takes `OrgScope` as its FIRST argument.
- Every query filters on `scope.orgId`. No exceptions, not even for a lookup by primary
  key.
- Writes stamp the actor from `scope.actor`.
- Use `resolveDbc(scope)` so a caller's open audited transaction is honoured, and
  `withTx` for multi-statement invariants.
- Row-to-domain mapping goes in `store/mappers.ts`, not inline.
- Refuse rather than cascade silently: `deleteClient` refuses when related rows exist and
  says so. Copy that shape.

Callers import straight from the store module. Re-exports and barrel files are lint errors.

## 4. API routes

`src/app/api/internal/crm/[orgSlug]/<entity>/route.ts` and `[id]/route.ts`. Every handler:

```
requireInternalToken(request)   ->  401 / 503
resolveOrgScope(orgSlug)        ->  404
parse body or query             ->  400
call store                      ->  409 on a store refusal
JSON                            ->  200
```

Body parsers go in `_lib/parseBody.ts`, query builders in `_lib/query.ts`. Enum values
are validated against `loadOrgEnums(scope.orgId)`, loaded once per request and passed into
the parser. Routes stay thin: auth, validate, call store, respond.

A state transition that must leave an activity trail gets its own subroute
(`POST /deals/[id]/move`), not a PATCH, so the log stays truthful.

## 5. CLI

`src/scripts/cli.ts`. Add the entity with its verbs and update the help text and the
examples.

HOUSE RULE: every important endpoint gets a CLI verb. An endpoint with no CLI command is
an unfinished feature.

## 6. UI

Route folder under `src/app/(app)/[orgSlug]/<cesky-nazev>/`:

- `page.tsx` (RSC): resolve `requireOrgContext`, parse searchParams, query the store.
- `_components/<X>Table.tsx` (`"use client"`): the Browser wrapper. Read the
  `crm-datagrid` skill before writing it.
- `actions.ts`: server actions returning `ActionState`, wrapped in `withUiAudit` so the
  mutation becomes one undoable batch.
- `[id]/page.tsx` for the detail view if the entity has one.

Add the nav entry in `src/app/_components/navItems.ts` and a command-palette action in
`src/app/_components/command/`.

UI copy is Czech with diacritics. Identifiers, file names and comments are English.

## 7. Verify

`pnpm code:check`, then drive it in the running app (the `verify` skill). A module is done
when you have clicked through create, edit, delete, undo, filter and group, and the CLI
reaches the same data.

## Checklist

- [ ] Domain type added, enum fields are `string`
- [ ] Číselník kind + defaults + required semantics, if any
- [ ] Table has `organization_id`, actor columns, an index
- [ ] Hand-written idempotent migration
- [ ] Audit trigger + UNDO_TABLES entry
- [ ] Store functions all take `OrgScope` first and filter on `scope.orgId`
- [ ] Mapper in `mappers.ts`
- [ ] API routes: token, org scope, validation, store, status codes
- [ ] CLI verbs and help text
- [ ] List surface on the Browser, detail page, server actions with `withUiAudit`
- [ ] Nav entry and command palette action
- [ ] `pnpm code:check` green and clicked through in the app
