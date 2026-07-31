import type { ReactNode } from "react"
import { Card, CardContent } from "@/app/_ui/Card"

export function InviteShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-[14px] bg-primary shadow-soft">
            <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
              <path
                d="M21.3 11.9 A6.7 6.7 0 1 0 22.7 16.9 L16.7 16.9"
                fill="none"
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">CRM</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-5 px-7 py-8">{children}</CardContent>
        </Card>
      </div>
    </main>
  )
}
