import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { verifyToken } from "@/lib/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { DashboardContent } from "@/components/dashboard-content"

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get("esports_session")?.value
  if (!token) redirect("/")

  const session = await verifyToken(token)
  if (!session || session.userId !== id) redirect("/")

  return (
    <div className="[--header-height:3.5rem]">
      <SidebarProvider className="flex flex-col">
        <div className="pointer-events-none fixed inset-0 bg-dashboard" aria-hidden="true" />
        <div className="pointer-events-none fixed inset-0 bg-dashboard-radial" aria-hidden="true" />
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar userId={session.userId} user={{ email: session.email, tier: session.tier }} />
          <SidebarInset>
            <DashboardContent userId={session.userId} tier={session.tier} />
          </SidebarInset>

        </div>
      </SidebarProvider>
    </div>
  )
}
