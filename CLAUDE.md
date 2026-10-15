# CLAUDE.md

Guidance for working in this repo.

## What this app is

A multi-workspace CRM: clients, contacts, deals (pipeline), projects, úkoly, activities,
documents. Next.js 15 App Router, React 19, Tailwind v4, strict TypeScript, ESM. Dev
server on port 4325. UI copy is Czech with diacritics, code is English.

It is a starter, not a product: the point is that every module here is a worked example
of how the next one should be built. Copy the pattern, do not invent a second one.

## Auth and workspaces

Auth is self-hosted better-auth (`src/lib/auth/auth.ts`, route handler
`src/app/api/auth/[...all]/route.ts`), email and password only, with the organization
plugin. There is no public sign-up: the first user is created by `pnpm bootstrap:admin`,
everyone else joins through an invitation link. `BETTER_AUTH_SECRET` is a secret; the
base URL lives in `src/lib/config.ts`.

Tenancy tables live in the `crm` schema: `organizations`, `organization_members` (roles
`owner` > `admin` > `member`), `organization_invitations`. The workspace slug lives in the
URL path, so pages sit under `src/app/(app)/[orgSlug]/...` and internal API routes under
`/api/internal/crm/[orgSlug]/...`. `src/lib/auth/orgContext.ts` resolves the request
once: `requireOrgContext(orgSlug)` redirects to `/login` without a session, `notFound()`
on an unknown slug, `/no-access` when the user is not a member; `requireRole(ctx, "admin")`
gates member management and org settings. `src/lib/nav.ts` `orgHref(slug, path)` builds
every internal link and `revalidatePath` target.

Every domain row carries `organization_id`, and every store function takes an `OrgScope`
(`{ orgId, actor }`) as its first argument; each query filters on `scope.orgId`. `Actor`
is `{ type: "user"; userId }` (server actions, from context), `{ type: "ai" }` (agent
writes, if you add one) or `{ type: "system" }` (internal API, scripts). Audited rows
record who acted: `activities.actor_type` + `actor_user_id`, and `created_by_user_id` on
the entities. Assignees are M2M (`ticket_assignees`, `deal_assignees`); the store
validates a target user is an org member before assigning.

## Enum číselníky (per workspace)

Enum options are per-org rows in `crm.enum_options`, not TypeScript unions. They are
seeded from `src/core/enumDefaults.ts` on org creation via `seedOrganizationDefaults`
(`src/lib/crm/store/orgDefaults.ts`, wired into the better-auth org-creation hook).
Domain types (`DealStage`, `TicketStatus`, ...) are plain `string`; values are validated
at the action and API boundary against the org's enum service
(`src/lib/crm/enums/service.ts`: `loadOrgEnums`, `listOptions`, `getBySemantic`,
`assertValidValue`).

Code branches only on a stable English `semantic`, never on a value slug, so a workspace
can rename or add options freely. Options whose semantic is required by code cannot be
archived. Colors stay the nine-token `ColorToken` palette; `src/lib/crm/config.ts`
`styleMap` maps a token to its dot and badge classes.

Required semantics per kind:

| kind | required semantics |
| --- | --- |
| deal_stage | one `parked`, one `won`, one `lost`; `open` is the default group |
| ticket_status | `done` (drives `done_at`) |
| ticket_priority | none |
| client_status | `active` |
| service_kind | none |
| project_status | `done` |
| doc_kind | `contract`, `offer`, `note` |
| activity_type | `note`, `call`, `meeting` are the loggable (user-editable) types |
| person_kind | `client`, `prospect` |
| rapport_entry_kind | `fact` |

Adding an enum value means editing one array in `src/core/enumDefaults.ts` for new
workspaces, or adding the row through Nastavení for an existing one. Never re-declare an
enum's members as a literal list in a second file.

## Data layer layout

- `src/core/types/crm.types.ts` holds domain types plus `Actor`, `OrgScope`, `EnumKind`,
  `EnumOption`, `OrgRole`. Enum fields are `string`, validated per org at the boundary,
  not literal unions.
- `src/lib/db/schema/*.ts` are drizzle `pgSchema("crm")` tables, all with
  `organization_id`. `src/lib/db/client.ts` exposes `db` (drizzle) and `getSql()` (for
  scripts). Keep the pool small and never open a second one.
- `src/lib/crm/store/*` is the per-entity data layer (queries + mutations) with
  row-to-domain mappers in `store/mappers.ts`. Every function takes an `OrgScope` first
  argument and scopes each query to `scope.orgId`; writes stamp the actor from
  `scope.actor`. This is the canonical write layer and it encodes the invariants: system
  activity on deal create and move, client delete refuses when related rows exist, ticket
  `clientId` denormalization on project reassignment, the one-primary-contact rule.
- Callers import a store function from the module that owns it
  (`@/lib/crm/store/clients`, ...). There are no facades or barrels: a re-export is a lint
  error.
- `src/core/listFields.ts` holds the sort and group keys of the store list queries. They
  travel in URLs, saved views and the API query string, so they are readonly tuples (see
  Conventions), shared by the pages and the API parsers.
- Server actions live in colocated `actions.ts` files returning `ActionState`
  (`src/app/_lib/actionState.ts`); the UI kit is `src/app/_ui/*`.
- Úkoly can be client-level: `tickets.project_id` is nullable, so a task hangs off a
  project (client derived from it) or directly off a client. A task can also carry
  `dealId` to hang off a deal. Board card position lives in the `order` column per status
  column; `reorderTicket` renumbers a whole board column in one transaction.

## List surfaces: the Browser

Every list and table surface runs on one shared component:
`src/app/_components/browser/` (`Browser.tsx`, `types.ts`, `queryHelpers.ts`). It is the
standard. Any new list surface uses it; do not hand-roll another table with its own
toolbar.

`Browser<R>` is generic over the row type and data-agnostic. It owns all the chrome and
interaction: URL-driven state (every filter, sort, group, page, q and view lives in
`searchParams`, pushed via `router.push` inside `useTransition` with a pending opacity),
per-column-header controls (tri-state sort button, filter popover with checkbox list,
single-select or date range), debounced fulltext with the "/" focus shortcut and a clear
button, removable filter chips plus "Vymazat vše", a consolidated FiltersPanel popover
mirroring the column filters, a GroupMenu with collapsible group header rows (counts,
pageSize disabled and pagination hidden while grouped), optional preset chips, optional
single-select view tabs with counts, Pagination, and empty states. Grouping is nested up
to two levels on every surface. Saved views (SavedViewsMenu, user-scoped rows in
`crm.user_saved_views`) capture the normalized query; a view starred as default is
auto-applied on a bare URL via `applyDefaultSavedView` in `src/app/_lib/defaultView.ts`,
called at the top of every list page RSC with the raw searchParams.

The server stays per page. Each RSC page parses `searchParams` with the helpers in
`queryHelpers.ts`, queries the store, and passes `rows` + `total` + filter option lists to
the page's client wrapper, which builds the typed `BrowserColumn<R>[]` (header, cell
renderer, `sortField`, optional `filter`), presets, `BrowserGroupConfig` (a pure
page-supplied bucketizer) and optional `viewTabs`, then renders `<Browser>`. When a group
is active the page passes all matching rows (Browser buckets them client-side); otherwise
it passes the page slice. Row click is `rowHref` (navigate) or `onRowClick` (open a
dialog, as the pipeline list does). Inline quick-edit cells are just cell renderers that
call server actions.

HOUSE RULE: all filtering and sorting live in the column headers, never in a toolbar
panel above the table.

Live examples to copy: `klienti/_components/ClientsTable.tsx`,
`ukoly/_components/TicketsTable.tsx`, `projekty/_components/ProjectsTable.tsx`,
`pipeline/_components/PipelineList.tsx`.

## Theme and visual language

Theme is light, dark or system. The preference lives in localStorage and is resolved
before first paint by the inline script in `src/app/layout.tsx` (`src/app/_lib/theme.ts`),
which writes `data-theme` on `<html>`. Dark values override the same semantic tokens under
`:root[data-theme="dark"]` in `globals.css`, so components keep using `bg-surface`,
`text-muted`, `border-hairline` and adapt on their own.

NEVER hardcode a color. There is a token for it. Everything clickable gets
`cursor-pointer` (Tailwind v4 preflight drops the button default in some cases, so it is
set explicitly on rows, headers, chips and popover items).

## Internal REST API and its auth

Token-authenticated machine API under `src/app/api/internal/crm/[orgSlug]/*`. Every
handler calls `requireInternalToken(request)` from `src/lib/auth/internalToken.ts`, which
compares the `x-internal-token` header against `INTERNAL_API_TOKEN` with
`timingSafeEqual`. Missing or mismatched token gives 401, an unset secret gives 503. After
the token check the handler resolves the workspace from the `orgSlug` path segment via
`resolveOrgScope(orgSlug)` (`_lib/orgScope.ts`): unknown slug 404, known slug a
`{ orgId, actor: { type: "system" } }` scope passed to every store call, so a token holder
only ever touches the addressed workspace. Enum values are validated per org: routes load
`loadOrgEnums(scope.orgId)` once and pass it into the body and query parsers, which reject
unknown values with a 400.

Shared helpers sit in `src/app/api/internal/crm/_lib/` (underscore-prefixed so Next does
not route them): `http.ts` (responses, body parsing, field coercion, `HttpError`),
`query.ts`, `parseBody.ts` (per-entity body validation mapped to the store
input types; dates are calendar-checked, not just pattern-matched), `reads.ts`. Routes
stay thin: auth, validate, call store, JSON.

Surface (all require the header; JSON in and out; 400 validation, 404 not found, 409 store
refusal, 500 unexpected): clients, deals (plus `POST /deals/[id]/move`), projects, tickets
(plus `POST /tickets/[id]/status`), people, rapport-entries, activities, documents,
`GET /search?q=`, `GET /dashboard`.

Deal stage changes go through `/move`, not PATCH, so the system activity log stays
truthful. PATCH bodies are partial: a JSON `null` clears a nullable column, an absent key
leaves it.

## CLI

`pnpm crm [--org slug] <entity> <verb> [--flag value ...]` (`src/scripts/cli.ts`) drives
the REST API using the token from the environment or `.env`. `--org` selects the workspace
and defaults to `CRM_ORG`. Pretty JSON by default, `--brief` for aligned columns. Exit 0 on
success, 1 on API or usage error.

HOUSE RULE: every important endpoint gets a CLI verb. If you add an endpoint and no CLI
command reaches it, the feature is not finished.

## Audit log and undo

Every INSERT, UPDATE and DELETE on a CRM domain table is logged by Postgres row triggers
into `crm.audit_log` with `before`/`after` jsonb snapshots (`drizzle/0002_audit_triggers.sql`),
regardless of code path. Attribution (actor, source, request_id) comes from
transaction-local GUCs set by `runAudited` (`src/lib/crm/audit/context.ts`); store
functions participate in the caller's transaction via the optional `OrgScope.db` handle
(`store/db.ts` `resolveDbc`/`withTx`). UI server actions wrap mutations in `withUiAudit`
(`src/app/_lib/auditedAction.ts`): one action is one `request_id` is one undoable batch.
`undoBatch` (`src/lib/crm/audit/undo.ts`) deterministically reverses a batch in one
transaction (verify then apply, whitelisted tables, conflict refusal when rows diverged);
undo itself is audited with `undo_of`.

Adding a new domain table means adding it to the `audited` array in a new migration and,
if it should be undoable, to `UNDO_TABLES` in `undo.ts`. This is separate from the
client-facing `crm.activities` feed, which stays as is.

Destructive UI actions return the audit `requestId` and show an undo toast
(`src/app/_lib/useUndoToast.ts` to `undoUiAction`). The admin "Historie" tab in Nastavení
lists audit batches with per-batch undo.

## Migrations

Hand-written idempotent SQL in `drizzle/`, applied by `pnpm db:migrate`
(`src/scripts/migrate.ts`), tracked in `crm._migrations`. The runner itself is
`applyMigrations` in `src/lib/db/migrations.ts`, shared with the integration test setup. Files run in filename order
inside a transaction each. Drizzle-kit is used only to read the schema
(`pnpm db:studio`), never to auto-apply.

A schema change means: edit `src/lib/db/schema/*.ts`, then hand-write the matching
numbered `.sql`. Do not let the two drift.

## Files

Document files upload via presigned URLs to a private S3 bucket (`src/lib/files/s3.ts`,
bucket and region in `config.files`, credentials from the default AWS provider chain).
Without AWS credentials the document module still works, it just cannot attach files.

## Quality gate and tests

`pnpm code:check` runs `eslint .`, `tsc --noEmit` and the vitest unit suite, and it has to
be green before every push. `eslint.config.mjs` is the shared GoldenPath gate:
typescript-eslint `recommendedTypeChecked`, no `any` and no casts to `any`, to `never` or
through `unknown`, no re-exports and no barrel files, no dynamic `import()` outside
`src/instrumentation.ts` and tests, explicit member accessibility, `no-floating-promises`,
`require-await`, `functional/immutable-data`, camelCase or PascalCase file names, the enum
rules below and the Next rules. A rule is never switched off for a file or a line; the code
changes instead. The one scoped exception: in `.tsx` files `functional/immutable-data` lets
`ref.current`, `document.title` and `element.style.*` be assigned, because React refs are
mutable by design and DOM properties only change by assignment.

Unit tests sit next to the code as `*.test.ts` (`vitest.config.ts`, `pnpm test`).
Integration tests are `src/**/*.integration.test.ts` (`vitest.integration.config.ts`) and
run with `DATABASE_URL=postgresql://.../crm_starter_test pnpm test:integration`. Vitest does
not read `.env`, so the URL comes from the shell. The setup refuses any database whose name
does not end in `_test`, migrates it first and runs the files one at a time.

**No test ever touches the outside world.** Both configs load a setup file from
`src/test-support` that deletes the outbound credentials (`RESEND_API_KEY`,
`INTERNAL_API_TOKEN`, the AWS keys) from the process and makes `fetch`, `http.request`,
`https.request` and every socket to a non-local host fail with
`OutboundRequestBlockedError`. The Postgres host of the `_test` database and servers a test
starts on localhost stay reachable. A new outbound integration therefore needs a mock
(`vi.mock`) in every suite that reaches it, otherwise the suite fails loudly.
`src/test-support/networkGuard.test.ts` is the proof that the guard holds; never weaken it
to make a suite pass.

## Conventions

- Env vars are ONLY for secrets. All other config lives in `src/lib/config.ts` or in code.
- Strict types: no `any`, avoid casting; `unknown` is used only at the HTTP input boundary
  with type guards. Import from source files, not barrels.
- Immutable patterns (spread, map, filter) over mutation, enforced by
  `functional/immutable-data`. `src/lib/collections.ts` has the copy-on-write helpers
  (`insertAt`, `toggleMember`, `recordFromKeys`); drizzle `and()` drops `undefined`
  conditions, so optional filters go in as `cond ? eq(...) : undefined`. State that
  genuinely has to mutate lives inside a small class. No empty catch blocks.
- Enums. A fixed set of values that never leaves the process (UI variants, internal
  states) is a TypeScript `enum` whose member key equals its PascalCase value
  (`ToastVariant.Error = "Error"`). A string-literal union type alias or a const object
  pseudo-enum is a lint error. Values stored in the database, carried in URLs and saved
  views, or exchanged over the API and CLI keep their spelling and are typed from a
  readonly tuple: `export const ORG_ROLES = ["owner", "admin", "member"] as const`,
  `type OrgRole = (typeof ORG_ROLES)[number]`, narrowed with `isOneOf`
  (`src/lib/literals.ts`). Each tuple has one home and every other file imports it.
  Per-workspace číselníky stay `string`, as described above.
- File names are camelCase for modules and PascalCase for components. A `"use server"`
  module exports only async functions; a type a client component needs lives in a plain
  module next to it (`pipeline/_lib/types.ts`).
- No em dashes anywhere, no emojis, no trailing period on headings or labels. Money is
  formatted `80 000 Kč` through `formatCzk` in `src/lib/money.ts`, the only formatter.
- Comment only non-trivial "why", never "what".
- Code artifacts are English, including file names and identifiers. Only user-facing copy
  is Czech, with diacritics. Enum value strings that are domain data may stay Czech, the
  code around them does not.
- Tickets are called "úkoly" in the UI. The rename is UI strings plus the route only: the
  page lives at `/ukoly`, the nav label is "Úkoly". Everything else stays "ticket": DB
  table `crm.tickets`, store and types (`Ticket`, `createTicket`), API route
  `/api/internal/crm/tickets`, CLI verb `tickets`.
- Before adding something, check whether it can be solved by removing or simplifying what
  is already there.
