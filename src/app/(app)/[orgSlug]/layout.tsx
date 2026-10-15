import { CommandPalette } from "@/app/_components/command/CommandPalette";
import { DeploymentGuard } from "@/app/_components/DeploymentGuard";
import { OrgProvider } from "@/app/_components/org/OrgProvider";
import { Sidebar } from "@/app/_components/Sidebar";
import { TaskDetailProvider } from "@/app/_components/task-detail/TaskDetailProvider";
import { TitleSync } from "@/app/_components/TitleSync";
import { TopBar } from "@/app/_components/TopBar";
import { ToastProvider } from "@/app/_ui/Toast";
import { requireOrgContext } from "@/lib/auth/orgContext";
import { listUserMemberships } from "@/lib/crm/store/members";
import { config } from "@/lib/config";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const ctx = await requireOrgContext(orgSlug);
  const memberships = await listUserMemberships(ctx.user.id);

  return (
    <OrgProvider
      value={{
        orgSlug: ctx.org.slug,
        orgName: ctx.org.name,
        role: ctx.role,
        user: ctx.user,
      }}
    >
      <ToastProvider>
        <TaskDetailProvider>
          <TitleSync />
          <DeploymentGuard currentDeployId={config.deployId()} />
          <CommandPalette />
          <div className="grid h-[100dvh] min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[250px_1fr]">
            <Sidebar memberships={memberships} className="hidden lg:grid" />

            <div className="flex min-h-0 min-w-0 flex-col overflow-x-clip overflow-y-auto">
              <div className="lg:hidden">
                <TopBar memberships={memberships} />
              </div>

              <main className="flex-1">
                <div className="mx-auto w-full max-w-[1080px] px-5 pb-28 pt-8 has-[[data-wide]]:max-w-[1600px] sm:px-6 sm:pb-8 sm:pt-8 lg:px-10 lg:py-12 3xl:has-[[data-wide]]:max-w-[1840px] 4xl:px-16 4xl:has-[[data-wide]]:max-w-[2360px] 5xl:has-[[data-wide]]:max-w-[3400px]">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </TaskDetailProvider>
      </ToastProvider>
    </OrgProvider>
  );
}
