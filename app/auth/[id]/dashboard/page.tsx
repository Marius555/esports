import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { verifyToken } from "@/lib/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { GameCard } from "@/components/game-card"
import { TournamentsTable } from "@/components/tournaments-table"

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get("esports_session")?.value
  if (!token) redirect("/login")

  const session = await verifyToken(token)
  if (!session || session.userId !== id) redirect("/login")

  return (
    <div className="[--header-height:3.5rem]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar />
          <SidebarInset>
            <div className="flex flex-1 flex-col gap-6 p-4">
              {/* Game cards */}
              <div className="grid gap-4 md:grid-cols-3 items-start">
                <GameCard game="dota2" />
                <GameCard game="leagueoflegends" />
                <GameCard game="counterstrike" />
              </div>

              {/* Tournaments table */}
              <TournamentsTable userId={session.userId} />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}
