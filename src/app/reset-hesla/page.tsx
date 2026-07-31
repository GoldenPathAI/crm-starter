import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent } from "@/app/_ui/Card"
import { ResetPasswordForm } from "./_components/ResetPasswordForm"

export const metadata: Metadata = {
  title: "Nové heslo",
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-[380px]">
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
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Nové heslo</h1>
          <p className="mt-1.5 text-[13px] text-muted">Nastav si nové heslo k účtu</p>
        </div>
        <Card>
          <CardContent className="px-7 py-7">{children}</CardContent>
        </Card>
      </div>
    </main>
  )
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (token === undefined || token.length === 0) {
    return (
      <Shell>
        <div className="flex flex-col gap-5">
          <p className="text-[13px] leading-relaxed text-muted">
            Odkaz na obnovení hesla není platný nebo vypršel. Požádej o nový.
          </p>
          <Link
            href="/zapomenute-heslo"
            className="text-center text-[13px] font-medium text-primary hover:underline"
          >
            Požádat o nový odkaz
          </Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <ResetPasswordForm token={token} />
    </Shell>
  )
}
