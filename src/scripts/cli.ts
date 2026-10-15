import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { config } from "@/lib/config"

// Thin CLI over the token-authenticated internal REST API. Agents (and humans) drive
// the whole CRM through `pnpm crm <entity> <verb> [--flag value ...]`.

const BASE_URL = config.authBaseUrl
const API_PREFIX = "/api/internal/crm"
// Workspace slug prefixed onto every API path. Override per call with --org <slug>.
const DEFAULT_ORG = process.env.CRM_ORG ?? "default"

const NUMBER_FIELDS = new Set([
  "mrrCzk",
  "valueCzk",
  "probability",
  "budgetCzk",
  "amountCzk",
  "order",
])
const ARRAY_FIELDS = new Set(["services", "labels", "assignees"])
const BOOLEAN_FIELDS = new Set(["isPrimary"])
// Flags consumed by the CLI itself, never forwarded to the API.
const CONTROL_FLAGS = new Set(["brief", "limit", "help", "org"])
// Ergonomic aliases: the API speaks clientId/projectId/dealId, humans type
// --client/--project/--deal.
const FLAG_ALIASES: Record<string, string> = {
  client: "clientId",
  project: "projectId",
  deal: "dealId",
  parent: "parentId",
  person: "personId",
  amount: "amountCzk",
}

type Flags = Record<string, string[]>
type BodyValue = string | number | boolean | string[] | null | Record<string, string>

interface ParsedArgs {
  positionals: string[]
  flags: Flags
}

interface RequestSpec {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path: string
  body?: Record<string, BodyValue>
}

interface EntityHelp {
  summary: string
  usage: string[]
  examples: string[]
}

const ENTITIES: Record<string, EntityHelp> = {
  clients: {
    summary: "list | get <id> | create | update <id> | delete <id>",
    usage: [
      "clients list [--status s] [--service s] [--industry i] [--q text] [--sortField name|mrr|lastContactAt|pipeline] [--sortDir asc|desc] [--group status|service|industry] [--page n]",
      "clients get <id>",
      "clients create --name <t> --industry <t> --status <poptavka|aktivni|pauza|ukonceny> --services <a,b> --contactName <t> [--contactRole t] [--contactEmail t] [--contactPhone t] [--ico t] [--dic t] [--website t] [--street t] [--city t] [--zip t] [--billingEmail t] [--mrrCzk n] [--nextStep t] [--note t] [--labels a,b]",
      "clients update <id> [--name t] [--status s] [--services a,b] [--mrrCzk n] [--nextStep t] [--note t]",
      "clients delete <id>",
    ],
    examples: [
      "pnpm crm clients list --status aktivni --q logi --brief",
      'pnpm crm clients create --name "ZZZ Test s.r.o." --industry Výroba --status poptavka --services konzultace,vyvoj --contactName "Jan Novák" --contactEmail jan@zzz.cz',
      'pnpm crm clients update cl_06 --mrrCzk 30000 --nextStep "Poslat nabídku"',
    ],
  },
  people: {
    summary: "list | get <id> | create | update <id> | delete <id>",
    usage: [
      "people list [--client <id>] [--kind klient|potencialni|tym|spolupracovnik|jiny] [--q text] [--sortField name|createdAt|lastEntryAt] [--sortDir asc|desc]",
      "people get <id>",
      "people create --name <t> [--client <id>] [--kind k] [--role t] [--email t] [--phone t] [--note t] [--isPrimary true]",
      "people update <id> [--name t] [--kind k] [--client id|null] [--role t] [--email t] [--phone t] [--note t] [--isPrimary true]",
      "people delete <id>",
    ],
    examples: [
      "pnpm crm people list --client cl_06 --brief",
      "pnpm crm people list --kind potencialni --brief",
      'pnpm crm people create --client cl_06 --name "Jan Novák" --role Jednatel --email jan@firma.cz --isPrimary true',
    ],
  },
  rapport: {
    summary: "list --person <id> | add --person <id> --content <t> | delete <id>",
    usage: [
      "rapport list --person <id>",
      "rapport add --person <id> --content <t> [--kind fakt|schuzka|poznamka] [--happenedAt YYYY-MM-DD]",
      "rapport delete <id>",
    ],
    examples: [
      "pnpm crm rapport list --person pe_12 --brief",
      'pnpm crm rapport add --person pe_12 --content "Syn Tomáš (8), o víkendech na kole" --kind fakt',
    ],
  },
  deals: {
    summary: "list | create | update <id> | delete <id> | move <id> --stage <stage>",
    usage: [
      "deals list",
      "deals create --client <id> --title <t> --stage <zaparkovano|novy|kvalifikace|nabidka|vyjednavani|vyhrano|prohrano> --valueCzk <n> [--probability n] [--expectedClose YYYY-MM-DD] [--nextStep t] [--description t]",
      "deals update <id> [--title t] [--valueCzk n] [--probability n] [--expectedClose YYYY-MM-DD] [--nextStep t] [--lostReason t]",
      "deals move <id> --stage <stage>",
      "deals delete <id>",
    ],
    examples: [
      "pnpm crm deals list --brief",
      "pnpm crm deals move de_09 --stage vyjednavani",
      'pnpm crm deals create --client cl_06 --title "AI chatbot" --stage novy --valueCzk 120000',
    ],
  },
  projects: {
    summary: "list | get <id> | create | update <id> | delete <id>",
    usage: [
      "projects list",
      "projects get <id>",
      "projects create --client <id> --name <t> --status <priprava|bezi|review|hotovo|udrzba|pozastaveno> [--description t] [--startedAt YYYY-MM-DD] [--dueAt YYYY-MM-DD] [--budgetCzk n] [--deal <id>]",
      "projects update <id> [--name t] [--status s] [--description t] [--dueAt YYYY-MM-DD] [--budgetCzk n]",
      "projects delete <id>",
    ],
    examples: [
      "pnpm crm projects list --brief",
      'pnpm crm projects create --client cl_06 --name "Automatizace fakturace" --status priprava --dueAt 2026-08-01',
      "pnpm crm projects update pr_01 --status hotovo",
    ],
  },
  tickets: {
    summary:
      "list | overdue | dnes | tyden | create | update <id> | delete <id> | status <id> --status <s>",
    usage: [
      "tickets list [--client id] [--project id] [--deal id] [--status s] [--priority p] [--overdue 1] [--sortField dueAt|priority|createdAt] [--sortDir asc|desc] [--group status|client|priority] [--page n]",
      "tickets overdue   (po termínu)",
      "tickets dnes      (s termínem do dneška)",
      "tickets tyden     (s termínem do 7 dnů)",
      "tickets create (--project <id> | --client <id> | --deal <id>) --title <t> --priority <nizka|stredni|vysoka|kriticka> [--status s] [--description t] [--dueAt YYYY-MM-DD] [--labels a,b] [--parent id] [--assignees email1,email2]",
      "tickets update <id> [--title t] [--priority p] [--status s] [--dueAt YYYY-MM-DD] [--labels a,b]",
      "tickets status <id> --status <backlog|todo|in_progress|review|done>",
      "tickets delete <id>",
    ],
    examples: [
      "pnpm crm tickets overdue --brief",
      "pnpm crm tickets list --status todo --priority vysoka --brief",
      "pnpm crm tickets status ti_009 --status done",
    ],
  },
  activities: {
    summary:
      "list --client <id> | add --client <id> --type <poznamka|hovor|schuzka> --title <text> | move <id> --client <id>",
    usage: [
      "activities list --client <id>",
      "activities add --client <id> --type <poznamka|hovor|schuzka> --title <t> [--body t] [--deal id] [--project id]",
      "activities move <id> --client <id>  (přesun špatně přiřazené aktivity na jiného klienta)",
    ],
    examples: [
      "pnpm crm activities list --client cl_06 --brief",
      'pnpm crm activities add --client cl_06 --type hovor --title "Telefonát" --body "Domluven termín"',
      "pnpm crm activities move ac_123 --client cl_07",
    ],
  },
  documents: {
    summary: "list [--client <id>] | add | update <id> | delete <id>",
    usage: [
      "documents list [--client <id>]",
      "documents add --client <id> --kind <smlouva|nabidka|zapis> --title <t> [--url t] [--amountCzk n]",
      "documents update <id> [--kind k] [--title t] [--amountCzk n] [--url t]",
      "documents delete <id>",
    ],
    examples: [
      "pnpm crm documents list --client cl_06 --brief",
      'pnpm crm documents add --client cl_06 --kind nabidka --title "Nabídka automatizace" --amountCzk 180000',
      'pnpm crm documents update do_002 --title "Nabídka automatizace v2"',
    ],
  },
  search: {
    summary: "<text>",
    usage: ["search <text>   (klienti, dealy, projekty, úkoly a e-maily podle názvu)"],
    examples: ["pnpm crm search Logi --brief"],
  },
  dashboard: {
    summary: "(KPI a co hoří)",
    usage: ["dashboard"],
    examples: ["pnpm crm dashboard --brief"],
  },
}

const ENTITY_ORDER = [
  "clients",
  "people",
  "rapport",
  "deals",
  "projects",
  "tickets",
  "activities",
  "documents",
  "search",
  "dashboard",
]

const GLOBAL_NOTES = `Flagy jsou query parametry (list) nebo JSON tělo (create/update). Multi-value
flagy (services, labels) opakuj nebo odděl čárkou. --client/--project/--deal jsou
aliasy na clientId/projectId/dealId. Při update vymaže volitelné pole hodnota null (--note null).
--org <slug> vybere workspace (výchozí ${DEFAULT_ORG}). --brief tiskne zarovnané sloupce,
--limit N omezí počet vypsaných řádků. Konec 0 při úspěchu, 1 při chybě API nebo použití.`

const topLevelHelp = (): string => {
  const rows = ENTITY_ORDER.map((name) => `  ${name.padEnd(11)}${ENTITIES[name]?.summary ?? ""}`)

  return [
    "pnpm crm [--org slug] <entity> <verb> [--flag value ...]",
    "",
    ...rows,
    "",
    GLOBAL_NOTES,
    "",
    "Detail a příklady: pnpm crm <entity> help",
  ].join("\n")
}

const entityHelp = (name: string): string => {
  const help = ENTITIES[name]
  if (help === undefined) {
    return topLevelHelp()
  }

  return [`pnpm crm ${name}`, "", ...help.usage, "", "Příklady:", ...help.examples].join("\n")
}

const loadToken = (): string | undefined => {
  const fromEnv = process.env.INTERNAL_API_TOKEN
  if (fromEnv !== undefined && fromEnv.trim().length > 0) {
    return fromEnv.trim()
  }

  try {
    const envPath = fileURLToPath(new URL("../../.env", import.meta.url))
    const content = readFileSync(envPath, "utf8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (trimmed.length === 0 || trimmed.startsWith("#")) {
        continue
      }

      const eq = trimmed.indexOf("=")
      if (eq === -1) {
        continue
      }

      if (trimmed.slice(0, eq).trim() !== "INTERNAL_API_TOKEN") {
        continue
      }

      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      return value.length > 0 ? value : undefined
    }

    return undefined
  } catch {
    return undefined
  }
}

const parseArgs = (tokens: string[]): ParsedArgs => {
  const positionals: string[] = []
  const rawFlags: Flags = {}
  let index = 0
  while (index < tokens.length) {
    const token = tokens[index]
    if (token === undefined) {
      break
    }

    if (token.startsWith("--")) {
      const key = token.slice(2)
      const next = tokens[index + 1]
      if (next !== undefined && !next.startsWith("--")) {
        rawFlags[key] = [...(rawFlags[key] ?? []), next]
        index += 2
      } else {
        rawFlags[key] = [...(rawFlags[key] ?? []), "true"]
        index += 1
      }
    } else {
      positionals.push(token)
      index += 1
    }
  }

  const flags: Flags = {}
  for (const [key, values] of Object.entries(rawFlags)) {
    const canonical = FLAG_ALIASES[key] ?? key
    flags[canonical] = [...(flags[canonical] ?? []), ...values]
  }

  return { positionals, flags }
}

const lastValue = (flags: Flags, key: string): string | undefined => {
  const values = flags[key]

  return values !== undefined ? values[values.length - 1] : undefined
}

const buildQuery = (flags: Flags): string => {
  const params = new URLSearchParams()
  for (const [key, values] of Object.entries(flags)) {
    if (CONTROL_FLAGS.has(key)) {
      continue
    }

    for (const value of values) {
      params.append(key, value)
    }
  }

  const query = params.toString()

  return query.length > 0 ? `?${query}` : ""
}

const buildBody = (flags: Flags): Record<string, BodyValue> => {
  const body: Record<string, BodyValue> = {}
  for (const [key, values] of Object.entries(flags)) {
    if (CONTROL_FLAGS.has(key)) {
      continue
    }

    const raw = values[values.length - 1] ?? ""
    if (ARRAY_FIELDS.has(key)) {
      body[key] = values
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    } else if (raw === "null") {
      // Literal `null` clears a nullable column on update (PATCH), matching the
      // JSON null a raw API caller would send.
      body[key] = null
    } else if (NUMBER_FIELDS.has(key)) {
      body[key] = Number(raw)
    } else if (BOOLEAN_FIELDS.has(key)) {
      body[key] = raw === "true" || raw === "1"
    } else {
      body[key] = raw
    }
  }

  return body
}

// The API takes the primary contact as a nested object; the CLI exposes it as
// flat --contactName/--contactRole/--contactEmail/--contactPhone flags and folds
// them here so `clients create` covers the contact in one command.
const CONTACT_FLAGS: Record<string, string> = {
  contactName: "name",
  contactRole: "role",
  contactEmail: "email",
  contactPhone: "phone",
}

const buildClientBody = (flags: Flags): Record<string, BodyValue> => {
  const body = buildBody(flags)
  const contact: Record<string, string> = {}
  for (const [flag, field] of Object.entries(CONTACT_FLAGS)) {
    const value = body[flag]
    delete body[flag]
    if (typeof value === "string" && value.length > 0) {
      contact[field] = value
    }
  }

  if (contact.name !== undefined) {
    body.primaryContact = contact
  }

  return body
}

const fail = (message: string): never => {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

const resolveRequest = (args: ParsedArgs): RequestSpec => {
  const [entity, verb, id] = args.positionals
  const { flags } = args

  if (entity === "dashboard") {
    return { method: "GET", path: "/dashboard" }
  }

  if (entity === "search") {
    const query = verb ?? lastValue(flags, "q")
    if (query === undefined || query.trim().length === 0) {
      fail("search vyžaduje hledaný výraz: pnpm crm search <text>")
    }

    const params = new URLSearchParams({ q: query ?? "" })

    return { method: "GET", path: `/search?${params.toString()}` }
  }

  const requireId = (): string =>
    id !== undefined && id.length > 0 ? id : fail(`Chybí identifikátor pro '${entity} ${verb}'.`)

  const requirePerson = (label: string): string =>
    lastValue(flags, "personId") ?? fail(`${label} vyžaduje --person <id>.`)

  const requireClient = (label: string): void => {
    if (lastValue(flags, "clientId") === undefined) {
      fail(`${label} vyžaduje --client <id>.`)
    }
  }

  switch (entity) {
    case "clients":
      if (verb === "list") return { method: "GET", path: `/clients${buildQuery(flags)}` }
      if (verb === "get") return { method: "GET", path: `/clients/${requireId()}` }
      if (verb === "create") return { method: "POST", path: "/clients", body: buildClientBody(flags) }
      if (verb === "update")
        return { method: "PATCH", path: `/clients/${requireId()}`, body: buildBody(flags) }
      if (verb === "delete") return { method: "DELETE", path: `/clients/${requireId()}` }
      break
    case "deals":
      if (verb === "list") return { method: "GET", path: "/deals" }
      if (verb === "create") return { method: "POST", path: "/deals", body: buildBody(flags) }
      if (verb === "update")
        return { method: "PATCH", path: `/deals/${requireId()}`, body: buildBody(flags) }
      if (verb === "delete") return { method: "DELETE", path: `/deals/${requireId()}` }
      if (verb === "move")
        return { method: "POST", path: `/deals/${requireId()}/move`, body: buildBody(flags) }
      break
    case "projects":
      if (verb === "list") return { method: "GET", path: "/projects" }
      if (verb === "get") return { method: "GET", path: `/projects/${requireId()}` }
      if (verb === "create") return { method: "POST", path: "/projects", body: buildBody(flags) }
      if (verb === "update")
        return { method: "PATCH", path: `/projects/${requireId()}`, body: buildBody(flags) }
      if (verb === "delete") return { method: "DELETE", path: `/projects/${requireId()}` }
      break
    case "tickets":
      if (verb === "list") return { method: "GET", path: `/tickets${buildQuery(flags)}` }
      if (verb === "overdue") return { method: "GET", path: "/tickets?overdue=1" }
      if (verb === "dnes") return { method: "GET", path: "/tickets?due=dnes" }
      if (verb === "tyden") return { method: "GET", path: "/tickets?due=tyden" }
      if (verb === "create") return { method: "POST", path: "/tickets", body: buildBody(flags) }
      if (verb === "update")
        return { method: "PATCH", path: `/tickets/${requireId()}`, body: buildBody(flags) }
      if (verb === "delete") return { method: "DELETE", path: `/tickets/${requireId()}` }
      if (verb === "status")
        return { method: "POST", path: `/tickets/${requireId()}/status`, body: buildBody(flags) }
      break
    case "people":
      // Without --client this lists the whole raport (every person + rapport counters).
      if (verb === "list") return { method: "GET", path: `/people${buildQuery(flags)}` }
      if (verb === "get" || verb === "show") return { method: "GET", path: `/people/${requireId()}` }
      if (verb === "create") return { method: "POST", path: "/people", body: buildBody(flags) }
      if (verb === "update")
        return { method: "PATCH", path: `/people/${requireId()}`, body: buildBody(flags) }
      if (verb === "delete") return { method: "DELETE", path: `/people/${requireId()}` }
      break
    case "rapport":
      // The person id travels in the path; a personId left in the body is ignored.
      if (verb === "list") {
        return { method: "GET", path: `/people/${requirePerson("rapport list")}/rapport` }
      }

      if (verb === "add") {
        return {
          method: "POST",
          path: `/people/${requirePerson("rapport add")}/rapport`,
          body: buildBody(flags),
        }
      }

      if (verb === "delete") return { method: "DELETE", path: `/rapport-entries/${requireId()}` }
      break
    case "activities":
      if (verb === "list") {
        requireClient("activities list")

        return { method: "GET", path: `/activities${buildQuery(flags)}` }
      }

      if (verb === "add") return { method: "POST", path: "/activities", body: buildBody(flags) }
      if (verb === "move") {
        requireClient("activities move")

        return {
          method: "POST",
          path: `/activities/${requireId()}/move`,
          body: buildBody(flags),
        }
      }

      break
    case "documents":
      if (verb === "list") return { method: "GET", path: `/documents${buildQuery(flags)}` }
      if (verb === "add") return { method: "POST", path: "/documents", body: buildBody(flags) }
      if (verb === "update")
        return { method: "PATCH", path: `/documents/${requireId()}`, body: buildBody(flags) }
      if (verb === "delete") return { method: "DELETE", path: `/documents/${requireId()}` }
      break
    default:
      break
  }

  return fail(`Neznámý příkaz. Použití:\n\n${topLevelHelp()}`)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const MONEY_FIELDS = new Set([
  "valueCzk",
  "mrrCzk",
  "sumCzk",
  "budgetCzk",
  "amountCzk",
  "openPipelineCzk",
  "weightedPipelineCzk",
])

// Ordered column preference for --brief. Only fields present in a row are shown,
// so each entity naturally renders its own tight set of columns.
const BRIEF_FIELDS = [
  "id",
  "name",
  "title",
  "clientName",
  "subtitle",
  "role",
  "email",
  "phone",
  "status",
  "stage",
  "priority",
  "kind",
  "type",
  "valueCzk",
  "mrrCzk",
  "amountCzk",
  "budgetCzk",
  "sumCzk",
  "count",
  "probability",
  "dueAt",
  "occurredAt",
]

const formatValue = (key: string, value: unknown): string => {
  if (MONEY_FIELDS.has(key) && typeof value === "number") {
    return `${value.toLocaleString("cs-CZ")} Kč`
  }

  if (Array.isArray(value)) {
    return value.join(",")
  }

  return String(value)
}

const cellText = (item: Record<string, unknown>, key: string): string =>
  item[key] !== undefined && item[key] !== null ? formatValue(key, item[key]) : "-"

const briefColumns = (rows: Record<string, unknown>[]): string[] =>
  BRIEF_FIELDS.filter((field) =>
    rows.some((row) => row[field] !== undefined && row[field] !== null),
  )

const briefLine = (item: Record<string, unknown>): string =>
  briefColumns([item])
    .map((field) => cellText(item, field))
    .join("  ")

// Aligned table: every column padded to its widest cell so brief output reads
// like columns, not a run-on line. The last column is left unpadded.
const renderRows = (rows: Record<string, unknown>[], indent: string): string[] => {
  const columns = briefColumns(rows)
  if (columns.length === 0) {
    return rows.map((row) => `${indent}${JSON.stringify(row)}`)
  }

  const matrix = rows.map((row) => columns.map((field) => cellText(row, field)))
  const widths = columns.map((_, i) => Math.max(...matrix.map((cells) => cells[i]?.length ?? 0)))

  return matrix.map((cells) =>
    `${indent}${cells
      .map((cell, i) => (i === cells.length - 1 ? cell : cell.padEnd(widths[i] ?? 0)))
      .join("  ")}`.trimEnd(),
  )
}

const printDetail = (data: Record<string, unknown>): void => {
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      process.stdout.write(`${key} ${value.length}\n`)
    } else if (isRecord(value)) {
      process.stdout.write(`${briefLine(value)}\n`)
    } else if (value !== null && value !== undefined) {
      process.stdout.write(`${key}: ${formatValue(key, value)}\n`)
    }
  }
}

const printBrief = (data: unknown): void => {
  const rows = isRecord(data) && Array.isArray(data.items) ? data.items : data
  if (Array.isArray(rows)) {
    const grouped =
      rows.length > 0 && rows.every((row) => isRecord(row) && Array.isArray(row.deals))
    if (grouped) {
      for (const group of rows) {
        if (!isRecord(group)) {
          continue
        }

        process.stdout.write(`${briefLine(group)}\n`)
        const nested = Array.isArray(group.deals) ? group.deals.filter(isRecord) : []
        for (const line of renderRows(nested, "  ")) {
          process.stdout.write(`${line}\n`)
        }
      }
    } else {
      const records = rows.filter(isRecord)
      for (const line of renderRows(records, "")) {
        process.stdout.write(`${line}\n`)
      }

      for (const row of rows) {
        if (!isRecord(row)) {
          process.stdout.write(`${String(row)}\n`)
        }
      }
    }

    if (isRecord(data) && typeof data.total === "number") {
      process.stdout.write(`total ${data.total}\n`)
    }

    return
  }

  if (isRecord(data)) {
    // A detail/dashboard object nests entity records or arrays of records; a plain
    // created/updated entity is all scalars (plus string arrays like services) and
    // reads best as a single aligned row.
    const isDetail = Object.values(data).some(
      (value) => isRecord(value) || (Array.isArray(value) && value.some(isRecord)),
    )
    if (isDetail) {
      printDetail(data)
    } else {
      const line = briefLine(data)
      process.stdout.write(`${line.length > 0 ? line : JSON.stringify(data)}\n`)
    }

    return
  }

  process.stdout.write(`${String(data)}\n`)
}

const applyLimit = (data: unknown, limit: number): unknown => {
  if (isRecord(data) && Array.isArray(data.items)) {
    return { ...data, items: data.items.slice(0, limit), total: data.total ?? data.items.length }
  }

  if (Array.isArray(data)) {
    return data.slice(0, limit)
  }

  return data
}

const wantsHelp = (args: ParsedArgs): string | undefined => {
  const { positionals, flags } = args
  if (positionals.length === 0) {
    return topLevelHelp()
  }

  const asked = flags.help !== undefined || positionals.includes("help")
  if (!asked) {
    return undefined
  }

  const entity = positionals.find((token) => token in ENTITIES)

  return entity !== undefined ? entityHelp(entity) : topLevelHelp()
}

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2))

  const help = wantsHelp(args)
  if (help !== undefined) {
    process.stdout.write(`${help}\n`)
    process.exit(0)
  }

  const token = loadToken()
  if (token === undefined) {
    return fail("INTERNAL_API_TOKEN není nastaven (ani v prostředí, ani v .env).")
  }

  const orgFlag = lastValue(args.flags, "org")
  const org = orgFlag !== undefined && orgFlag !== "true" ? orgFlag : DEFAULT_ORG

  const spec = resolveRequest(args)
  const brief = args.flags.brief !== undefined
  const limitRaw = lastValue(args.flags, "limit")
  const limit = limitRaw !== undefined ? Number.parseInt(limitRaw, 10) : undefined

  const response = await fetch(`${BASE_URL}${API_PREFIX}/${org}${spec.path}`, {
    method: spec.method,
    headers: {
      "x-internal-token": token,
      ...(spec.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: spec.body !== undefined ? JSON.stringify(spec.body) : undefined,
  })

  const text = await response.text()
  let data: unknown = null
  if (text.length > 0) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    const message = isRecord(data) && typeof data.error === "string" ? data.error : text
    process.stderr.write(`${message.length > 0 ? message : `HTTP ${response.status}`}\n`)
    process.exit(1)
  }

  const shaped =
    limit !== undefined && Number.isFinite(limit) && limit >= 0 ? applyLimit(data, limit) : data

  if (brief) {
    printBrief(shaped)
  } else {
    process.stdout.write(`${JSON.stringify(shaped, null, 2)}\n`)
  }

  process.exit(0)
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
