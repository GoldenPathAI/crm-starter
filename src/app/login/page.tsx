import type { Metadata } from "next"
import { BrandMark } from "@/app/_components/BrandMark"
import { Card, CardContent } from "@/app/_ui/Card"
import { config } from "@/lib/config"
import { LoginForm } from "./_components/LoginForm"

export const metadata: Metadata = {
  title: "Přihlášení",
}

export default function LoginPage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 text-center">
          <BrandMark className="mx-auto mb-5 size-14" />
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{config.appName}</h1>
          <p className="mt-1.5 text-[13px] text-muted">{config.appTagline}</p>
        </div>
        <Card>
          <CardContent className="px-7 py-7">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
