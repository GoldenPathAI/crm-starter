import { CopyButton } from "./CopyButton"

export function CommandLine({ command, note }: { command: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface-2 py-1.5 pl-3 pr-1.5">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[12.5px] text-foreground">
          {command}
        </code>
        <CopyButton value={command} />
      </div>
      {note ? <p className="text-xs text-muted">{note}</p> : null}
    </div>
  )
}
