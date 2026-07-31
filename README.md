# CRM starter

A working, multi-workspace CRM you can fork and turn into your own. Not a demo: clients,
contacts, pipeline, projects, úkoly, activity timeline, documents, per-workspace
číselníky, a database-level audit log with one-click undo, a token-authenticated REST API
and a CLI over it are all real and wired together.

Next.js 15 App Router, React 19, Tailwind v4, strict TypeScript, Postgres via drizzle.
UI copy is Czech, the code is English.

## Co je uvnitř

**Moduly.** Přehled (dashboard), Klienti, Pipeline (kanban i tabulka), Projekty, Úkoly,
Raport (lidé za klienty), Nastavení.

**Datagrid.** Jedna sdílená komponenta (`src/app/_components/browser/`) pohání každý
seznam v aplikaci. URL-driven stav, filtry a řazení v hlavičkách sloupců, dvouúrovňové
seskupování, fulltext, uložené pohledy, stránkování. Nový seznam se staví z ní, nikdy
ručně.

**Design language.** Tokeny v `src/app/globals.css` (light i dark), třicet komponent
v `src/app/_ui/`. Nikde není natvrdo zapsaná barva.

**Číselníky.** Stavy dealů, úkolů, klientů, typy dokumentů a aktivit jsou řádky
v `crm.enum_options` per workspace, ne TypeScript uniony. Workspace si je přejmenuje a
rozšíří sám. Kód větví na stabilním anglickém `semantic`, nikdy na hodnotě.

**Audit a undo.** Každý INSERT, UPDATE i DELETE na doménové tabulce loguje Postgres
trigger se snapshotem před a po. Jedna akce v UI je jedna vratná dávka, undo je
deterministické, žádné LLM.

**API a CLI.** `/api/internal/crm/[orgSlug]/*` s tokenovou autentizací a `pnpm crm` nad
ním. Co jde udělat klikáním, jde udělat i z terminálu nebo skriptu.

**Multi-workspace.** Self-hosted better-auth s organization pluginem. Každý řádek nese
`organization_id`, každá funkce datové vrstvy bere `OrgScope` jako první argument.
Veřejná registrace neexistuje: první uživatel se založí skriptem, ostatní přijdou
pozvánkou.

## Quickstart

Potřebuješ Node 22+, pnpm a Postgres 17.

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm bootstrap:admin --email ty@firma.cz --name "Tvoje jméno" --password "..." --org firma
pnpm dev
```

Do `.env` patří `DATABASE_URL`, `BETTER_AUTH_SECRET` a `INTERNAL_API_TOKEN`.
`bootstrap:admin` založí workspace, prvního uživatele jako ownera a nasype do workspace
výchozí číselníky z `src/core/enum-defaults.ts`. Pak se přihlas na
`http://localhost:4325`.

CLI proti běžícímu serveru:

```bash
pnpm crm clients list --brief
pnpm crm deals move de_09 --stage nabidka
pnpm crm tickets dnes --brief
```

## Co si upravit jako první

`src/lib/config.ts` je název aplikace, timezone, měna, doména a S3 bucket.
`src/core/enum-defaults.ts` jsou fáze pipeline, stavy a typy služeb.
`src/app/globals.css` jsou barvy a fonty.
`src/core/won-checklist.ts` je seznam úkolů, který se založí, když deal vyhraješ.

`CLAUDE.md` popisuje architekturu a konvence tak, aby v tom Claude Code uměl stavět dál.
Skilly v `.claude/skills/` pokrývají přidání nového modulu, nového seznamu nad datagridem
a ověření změny v běžící aplikaci.

## Příkazy

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm code:check
pnpm db:migrate
pnpm db:studio
pnpm crm
pnpm bootstrap:admin
```
