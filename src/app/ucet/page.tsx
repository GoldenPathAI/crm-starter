import type { Metadata } from "next"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ToastProvider } from "@/app/_ui/Toast"
import { getSessionUser } from "@/lib/auth/orgContext"
import { PasswordCard } from "./_components/PasswordCard"
import { ProfileCard } from "./_components/ProfileCard"

export const metadata: Metadata = {
  title: "Můj účet",
}

export default async function AccountPage() {
  const user = await getSessionUser()
  if (user === null) {
    redirect("/login")
  }

  return (
    <main className="flex min-h-[100dvh] justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-[560px]">
        <Link
          href="/"
          className="mb-6 inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Zpět do CRM
        </Link>
        <div className="mb-7">
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Můj účet</h1>
          <p className="mt-1 text-[13px] text-muted">Správa profilu a hesla</p>
        </div>
        <ToastProvider>
          <div className="flex flex-col gap-6">
            <ProfileCard name={user.name} email={user.email} />
            <PasswordCard />
          </div>
        </ToastProvider>
      </div>
    </main>
  )
}
