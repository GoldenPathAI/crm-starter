"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { motion, useReducedMotion } from "framer-motion"
import { Menu, X } from "lucide-react"
import { useState } from "react"
import { Sidebar } from "@/app/_components/Sidebar"
import type { UserMembership } from "@/lib/crm/store/members"

export function MobileNav({ memberships }: { memberships: ReadonlyArray<UserMembership> }) {
  const [open, setOpen] = useState(false)
  const reduceMotion = useReducedMotion()

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
        <Menu className="size-5" />
        <span className="sr-only">Otevřít navigaci</span>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay asChild>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-scrim backdrop-blur-md"
          />
        </DialogPrimitive.Overlay>
        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] focus:outline-none">
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-full flex-col shadow-lifted"
          >
            <DialogPrimitive.Title className="sr-only">Navigace</DialogPrimitive.Title>
            <DialogPrimitive.Close className="absolute right-3 top-3 z-10 flex size-8 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <X className="size-4" />
              <span className="sr-only">Zavřít</span>
            </DialogPrimitive.Close>
            <Sidebar memberships={memberships} onNavigate={() => setOpen(false)} />
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
