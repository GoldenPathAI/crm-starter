import type { Metadata } from "next"
import { ClientErrorReporter } from "@/app/_components/ClientErrorReporter"
import { themeInitScript } from "@/app/_lib/theme"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "CRM",
    template: "%s - CRM",
  },
  description: "Interní CRM pro klienty, dealy a projekty",
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
