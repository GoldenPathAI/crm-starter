import { Card, CardContent, CardHeader, CardTitle } from "@/app/_ui/Card"
import { CommandLine } from "./CommandLine"

interface DataCommand {
  command: string
  note: string
}

const commands: ReadonlyArray<DataCommand> = [
  {
    command: "pnpm db:migrate",
    note: "Aplikuje migrace schématu crm",
  },
  {
    command: "pnpm db:seed-demo",
    note: "Naplní demo data",
  },
  {
    command: "pnpm db:wipe-demo --yes",
    note: "Smaže všechna data ve schématu crm",
  },
]

export function CommandsPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {commands.map((item) => (
          <CommandLine key={item.command} command={item.command} note={item.note} />
        ))}
      </CardContent>
    </Card>
  )
}
