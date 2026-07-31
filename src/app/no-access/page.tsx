import type { Metadata } from "next";
import { Card, CardContent } from "@/app/_ui/Card";
import { LogoutButton } from "./_components/LogoutButton";

export const metadata: Metadata = {
  title: "Bez přístupu",
};

export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const permissionDenied = (await searchParams).reason === "permission";

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-[420px]">
        <Card>
          <CardContent className="flex flex-col gap-5 px-7 py-8">
            <div className="flex flex-col gap-2">
              <h1 className="text-[20px] font-semibold tracking-tight text-foreground">
                {permissionDenied
                  ? "K této části nemáš oprávnění"
                  : "Nemáš přístup do žádné workspace"}
              </h1>
              <p className="text-[13px] leading-relaxed text-muted">
                {permissionDenied
                  ? "Tato část je dostupná pouze vlastníkovi workspace."
                  : "Tvůj účet zatím nepatří do žádné organizace. Přístup získáš pozvánkou od správce workspace. Až ti pozvánku pošle, otevři ji a připoj se."}
              </p>
            </div>
            <LogoutButton />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
