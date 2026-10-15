"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { animate, motion, useReducedMotion } from "framer-motion"
import { Repeat, TrendingUp, Users, type LucideIcon } from "lucide-react"
import { StatCard, type StatHue } from "@/app/_ui/Stat"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { orgHref } from "@/lib/nav"
import { formatCzk } from "./format"

interface DashboardStatsProps {
  activeClientsCount: number
  mrrCzk: number
  openDealsCount: number
  openPipelineCzk: number
  weightedPipelineCzk: number
}

interface StatItem {
  key: string
  label: string
  value: number
  hint?: string
  hue: StatHue
  icon: LucideIcon
  href: string
  format?: (value: number) => string
}

const dealWord = (count: number): string => {
  if (count === 1) {
    return "deal"
  }

  if (count >= 2 && count <= 4) {
    return "dealy"
  }

  return "dealů"
}

function CountUp({ value, format }: { value: number; format?: (value: number) => string }) {
  const reduceMotion = useReducedMotion()
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (reduceMotion === true) {
      setDisplay(value)

      return
    }

    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(latest),
    })

    return () => controls.stop()
  }, [value, reduceMotion])

  return <>{format ? format(display) : Math.round(display)}</>
}

export function DashboardStats({
  activeClientsCount,
  mrrCzk,
  openDealsCount,
  openPipelineCzk,
  weightedPipelineCzk,
}: DashboardStatsProps) {
  const reduceMotion = useReducedMotion()
  const { orgSlug } = useOrg()

  const items: StatItem[] = [
    {
      key: "clients",
      label: "Aktivní klienti",
      value: activeClientsCount,
      hue: "green",
      icon: Users,
      href: orgHref(orgSlug, "/klienti?status=aktivni"),
    },
    {
      key: "mrr",
      label: "MRR",
      value: mrrCzk,
      hint: `Ročně ${formatCzk(mrrCzk * 12)}`,
      hue: "teal",
      icon: Repeat,
      format: formatCzk,
      href: orgHref(orgSlug, "/klienti"),
    },
    {
      key: "pipeline",
      label: "Otevřená pipeline",
      value: openPipelineCzk,
      hint: `${openDealsCount} ${dealWord(openDealsCount)}, vážená ${formatCzk(weightedPipelineCzk)}`,
      hue: "blue",
      icon: TrendingUp,
      format: formatCzk,
      href: orgHref(orgSlug, "/pipeline"),
    },
  ]

  return (
    <motion.div
      className="grid grid-cols-2 gap-4 lg:grid-cols-3"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.05 } },
      }}
    >
      {items.map((item) => (
        <motion.div
          key={item.key}
          variants={{
            hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link
            href={item.href}
            className="block h-full rounded-2xl transition duration-200 hover:-translate-y-0.5 hover:shadow-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <StatCard
              label={item.label}
              value={<CountUp value={item.value} format={item.format} />}
              hint={item.hint}
              hue={item.hue}
              icon={item.icon}
            />
          </Link>
        </motion.div>
      ))}
    </motion.div>
  )
}
