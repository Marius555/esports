"use client"

import * as React from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Award01Icon, Certificate01Icon, CreditCardIcon, DashboardSquare01Icon, Logout01Icon, ZapIcon } from "@hugeicons/core-free-icons"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { logout } from "@/app/actions/auth"

type Tier = "free" | "pro" | "max"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userId: string
  user: {
    email: string
    tier: Tier
  }
}

const tierLabel: Record<Tier, string> = { free: "Free", pro: "Pro", max: "Max" }
const tierClass: Record<"pro" | "max", string> = {
  pro: "text-primary border-primary/50",
  max: "text-amber-400 border-amber-400/50",
}

const navItems = (userId: string): { title: string; url: string; icon: IconSvgElement }[] => [
  { title: "Dashboard", url: `/auth/${userId}/dashboard`, icon: DashboardSquare01Icon },
  { title: "Leaderboard", url: "#", icon: Award01Icon },
]

export function AppSidebar({ userId, user, ...props }: AppSidebarProps) {
  return (
    <Sidebar
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<a href={`/auth/${userId}/dashboard`} />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
                <HugeiconsIcon icon={ZapIcon} size={16} />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                <span className="truncate font-medium text-sm">{user.email}</span>
                {user.tier === "free" ? (
                  <span className="text-[10px] font-semibold tracking-widest uppercase mt-0.5 text-muted-foreground">
                    {tierLabel[user.tier]}
                  </span>
                ) : (
                  <span className={`text-[10px] font-semibold tracking-widest uppercase border rounded px-1.5 py-0.5 w-fit mt-0.5 ${tierClass[user.tier]}`}>
                    {tierLabel[user.tier]}
                  </span>
                )}
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="overflow-x-hidden">
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems(userId).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton render={<a href={item.url} />}>
                    <HugeiconsIcon icon={item.icon} size={16} />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<a href="#" />}>
                  <HugeiconsIcon icon={Certificate01Icon} size={16} />
                  <span>Account</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<a href="#" />}>
                  <HugeiconsIcon icon={CreditCardIcon} size={16} />
                  <span>Billing</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-muted-foreground hover:text-foreground"
              onClick={() => logout()}
            >
              <HugeiconsIcon icon={Logout01Icon} size={16} />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
