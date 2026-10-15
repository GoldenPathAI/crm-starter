import type { Metadata } from "next"
import { ClientErrorReporter } from "@/app/_components/ClientErrorReporter"
import { themeInitScript } from "@/app/_lib/theme"
import { config } from "@/lib/config"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: config.appName,
    template: `%s - ${config.appName}`,
  },
  description: config.appTagline,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ClientErrorReporter />
        {children}
      </body>
    </html>
  )
}
