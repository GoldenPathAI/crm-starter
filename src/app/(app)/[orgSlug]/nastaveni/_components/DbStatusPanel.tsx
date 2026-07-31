import { Card, CardContent, CardHeader, CardTitle } from "@/app/_ui/Card"
import { cn } from "@/lib/cn"
import type { CrmDbStatus, InternalApiStatus } from "../_lib/status"

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        ok ? "bg-green-soft text-green-text" : "bg-red-soft text-red-text",
      )}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", ok ? "bg-green" : "bg-red")} />
      {label}
    </span>
  )
}

export function DbStatusPanel({
  db,
  internalApi,
}: {
  db: CrmDbStatus
  internalApi: InternalApiStatus
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Databáze</CardTitle>
        <StatusPill ok={db.ok} label={db.ok ? "Připojeno" : "Chyba"} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {db.ok ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {db.tables.map((table) => (
                <span
                  key={table.key}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-foreground"
                >
                  <span className="text-muted">{table.label}</span>
                  <span className="font-semibold tabular-nums">{table.count}</span>
                </span>
              ))}
            </div>
            <p className="text-xs text-muted">Celkem {db.totalRows} řádků ve schématu crm</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-sm text-red-text">Databáze právě není dostupná</p>
            {db.errorMessage !== null ? (
              <p className="text-xs text-muted">{db.errorMessage}</p>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
          <span className="text-sm text-foreground">Token pro CLI a interní API</span>
          <StatusPill
            ok={internalApi.configured}
            label={internalApi.configured ? "Nastaven" : "Chybí"}
          />
        </div>
      </CardContent>
    </Card>
  )
}
