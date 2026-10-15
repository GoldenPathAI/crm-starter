"use client"

import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/app/_ui/Button"
import { Spinner } from "@/app/_ui/Spinner"
import { authClient } from "@/lib/auth/authClient"

export function LogoutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const onClick = async (): Promise<void> => {
    setPending(true)
    await authClient.signOut()
    router.push("/login")
  }

  return (
    <Button type="button" variant="outline" size="md" onClick={() => void onClick()} disabled={pending} className="w-full cursor-pointer">
      {pending ? <Spinner className="size-4" /> : <LogOut className="size-4" />}
      Odhlásit se
    </Button>
  )
}
