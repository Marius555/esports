"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { MoonIcon, SidebarLeft01Icon, Sun01Icon, ZapIcon } from "@hugeicons/core-free-icons"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useSidebar } from "@/components/ui/sidebar"

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  // resolvedTheme is undefined before hydration — render nothing to avoid mismatch
  if (!resolvedTheme) return <div className="h-8 w-8" />

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {resolvedTheme === "dark" ? <HugeiconsIcon icon={Sun01Icon} size={16} /> : <HugeiconsIcon icon={MoonIcon} size={16} />}
    </Button>
  )
}

export function SiteHeader() {
  const { toggleSidebar } = useSidebar()

  return (
    <header className="sticky top-0 z-50 flex w-full items-center border-b border-brand-purple/15 bg-background">
      <div className="flex h-(--header-height) w-full items-center gap-2 px-4">
        <Button
          className="h-8 w-8"
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
        >
          <HugeiconsIcon icon={SidebarLeft01Icon} size={16} />
        </Button>
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={ZapIcon} size={16} className="text-brand-purple" />
          <span className="font-heading font-black tracking-widest text-brand-purple uppercase text-sm">
            Gamery
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
