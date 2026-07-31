import type { ColorToken, EnumKind } from "@/core/types/crm.types"

export interface EnumOptionDefault {
  value: string
  label: string
  color: ColorToken
  semantic?: string
  defaultProbability?: number
}

export const DEFAULT_ENUM_OPTIONS: Record<EnumKind, ReadonlyArray<EnumOptionDefault>> = {
  deal_stage: [
    { value: "zaparkovano", label: "Zaparkováno", color: "slate", semantic: "parked", defaultProbability: 10 },
    { value: "novy", label: "Nový", color: "blue", semantic: "open", defaultProbability: 20 },
    { value: "kvalifikace", label: "Kvalifikace", color: "cyan", semantic: "open", defaultProbability: 40 },
    { value: "nabidka", label: "Nabídka", color: "indigo", semantic: "open", defaultProbability: 55 },
    { value: "vyjednavani", label: "Vyjednávání", color: "orange", semantic: "open", defaultProbability: 70 },
    { value: "vyhrano", label: "Vyhráno", color: "green", semantic: "won", defaultProbability: 100 },
    { value: "prohrano", label: "Prohráno", color: "red", semantic: "lost", defaultProbability: 0 },
  ],
  client_status: [
    { value: "aktivni", label: "Aktivní", color: "green", semantic: "active" },
    { value: "poptavka", label: "Poptávka", color: "blue", semantic: "inquiry" },
    { value: "pauza", label: "Pauza", color: "orange", semantic: "paused" },
    { value: "ukonceny", label: "Ukončený", color: "slate", semantic: "ended" },
  ],
  service_kind: [
    { value: "konzultace", label: "Konzultace", color: "blue", semantic: "consulting" },
    { value: "implementace", label: "Implementace", color: "indigo", semantic: "implementation" },
    { value: "vyvoj", label: "Vývoj", color: "green", semantic: "development" },
    { value: "skoleni", label: "Školení", color: "teal", semantic: "training" },
    { value: "podpora", label: "Podpora", color: "purple", semantic: "support" },
  ],
  project_status: [
    { value: "priprava", label: "Příprava", color: "blue", semantic: "prep" },
    { value: "bezi", label: "Běží", color: "green", semantic: "running" },
    { value: "review", label: "Review", color: "orange", semantic: "review" },
    { value: "hotovo", label: "Hotovo", color: "teal", semantic: "done" },
    { value: "udrzba", label: "Údržba", color: "purple", semantic: "maintenance" },
    { value: "pozastaveno", label: "Pozastaveno", color: "slate", semantic: "paused" },
  ],
  ticket_status: [
    { value: "backlog", label: "Backlog", color: "slate", semantic: "backlog" },
    { value: "todo", label: "To-do", color: "blue", semantic: "todo" },
    { value: "in_progress", label: "In progress", color: "orange", semantic: "in_progress" },
    { value: "review", label: "Review", color: "purple", semantic: "review" },
    { value: "done", label: "Hotovo", color: "green", semantic: "done" },
  ],
  ticket_priority: [
    { value: "kriticka", label: "Kritická", color: "red", semantic: "critical" },
    { value: "vysoka", label: "Vysoká", color: "orange", semantic: "high" },
    { value: "stredni", label: "Střední", color: "blue", semantic: "medium" },
    { value: "nizka", label: "Nízká", color: "slate", semantic: "low" },
  ],
  doc_kind: [
    { value: "smlouva", label: "Smlouva", color: "indigo", semantic: "contract" },
    { value: "nabidka", label: "Nabídka", color: "blue", semantic: "offer" },
    { value: "zapis", label: "Zápis", color: "teal", semantic: "note" },
  ],
  activity_type: [
    { value: "poznamka", label: "Poznámka", color: "slate", semantic: "note" },
    { value: "hovor", label: "Hovor", color: "teal", semantic: "call" },
    { value: "schuzka", label: "Schůzka", color: "indigo", semantic: "meeting" },
    { value: "email_out", label: "E-mail odeslaný", color: "blue", semantic: "email_out" },
    { value: "email_in", label: "E-mail přijatý", color: "green", semantic: "email_in" },
    { value: "system", label: "Systém", color: "slate", semantic: "system" },
  ],
  person_kind: [
    { value: "klient", label: "Klient", color: "green", semantic: "client" },
    { value: "potencialni", label: "Potenciální", color: "blue", semantic: "prospect" },
    { value: "tym", label: "Tým", color: "purple", semantic: "team" },
    { value: "spolupracovnik", label: "Spolupracovník", color: "teal", semantic: "partner" },
    { value: "jiny", label: "Jiný", color: "slate", semantic: "other" },
  ],
  rapport_entry_kind: [
    { value: "fakt", label: "Fakt", color: "blue", semantic: "fact" },
    { value: "schuzka", label: "Schůzka", color: "indigo", semantic: "meeting" },
    { value: "poznamka", label: "Poznámka", color: "slate", semantic: "note" },
  ],
}

export const DEFAULT_ORG_SETTINGS = { staleDealDays: 21 } as const

// Semantics the app branches on. An option carrying one of these cannot be archived
// or its kind would lose a value the code requires.
export const REQUIRED_SEMANTICS: Partial<Record<EnumKind, readonly string[]>> = {
  deal_stage: ["parked", "won", "lost"],
  client_status: ["active"],
  ticket_status: ["done"],
  activity_type: ["note", "call", "meeting", "system", "email_in", "email_out"],
  person_kind: ["client", "prospect"],
  rapport_entry_kind: ["fact"],
}

