"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle01Icon, Crown02Icon, SparklesIcon, ZapIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardPanel,
  CardFooter,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "@/components/ui/dialog"

type Tier = "free" | "pro" | "max"

interface ActiveTournamentInfo {
  tournamentId: string
  game: string
  endsAt: string
}

const GAME_LABEL: Record<string, string> = {
  dota2: "Dota 2",
  valorant: "Valorant",
  counterstrike: "CS2",
}

const PLANS: {
  tier: Tier
  name: string
  tagline: string
  price: string
  period: string
  color: string
  glowClass: string
  borderClass: string
  badgeBg: string
  badgeText: string
  icon: React.ReactNode
  features: string[]
}[] = [
  {
    tier: "free",
    name: "Recruit",
    tagline: "Everything you need to compete",
    price: "€0",
    period: "forever",
    color: "text-brand-cyan",
    glowClass: "",
    borderClass: "border-border",
    badgeBg: "bg-secondary",
    badgeText: "text-foreground",
    icon: <HugeiconsIcon icon={ZapIcon} size={14} />,
    features: [
      "1 active tournament at a time",
      "Unlimited match forecasts",
      "Live match data",
      "Monthly leaderboard",
      "10 points per correct forecast",
      "Compete for €50 monthly prize",
    ],
  },
  {
    tier: "pro",
    name: "Oracle",
    tagline: "AI edge for serious forecasters",
    price: "$20",
    period: "/ month",
    color: "text-brand-purple text-glow-purple",
    glowClass: "glow-purple",
    borderClass: "border-brand-purple/40",
    badgeBg: "bg-brand-purple",
    badgeText: "text-foreground",
    icon: <HugeiconsIcon icon={SparklesIcon} size={14} />,
    features: [
      "2 active tournaments at a time",
      "Everything in Free",
      "AI-powered win probability",
      "Tactical team breakdowns",
      "Historical team performance",
      "Head-to-head analysis",
    ],
  },
  {
    tier: "max",
    name: "Legend",
    tagline: "Maximum competitive advantage",
    price: "$35",
    period: "/ month",
    color: "text-amber-400",
    glowClass: "",
    borderClass: "border-amber-500/40",
    badgeBg: "bg-amber-500",
    badgeText: "text-black",
    icon: <HugeiconsIcon icon={Crown02Icon} size={14} />,
    features: [
      "3 active tournaments at a time",
      "Everything in Oracle",
      "Priority AI processing",
      "Fastest answer tiebreaker edge",
      "Early access to new features",
      "Dedicated priority support",
    ],
  },
]

export function BillingContent({
  currentTier,
}: {
  userId: string
  currentTier: Tier
}) {
  const router = useRouter()
  const [activeTier, setActiveTier] = useState<Tier>(currentTier)
  const [loading, setLoading] = useState<Tier | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Downgrade modal state
  const [downgradeOpen, setDowngradeOpen] = useState(false)
  const [pendingTier, setPendingTier] = useState<Tier | null>(null)
  const [downgradeInfo, setDowngradeInfo] = useState<{
    activeTournaments: ActiveTournamentInfo[]
    newLimit: number
    currentCount: number
  } | null>(null)
  const [cancelIds, setCancelIds] = useState<Set<string>>(new Set())
  const [confirmLoading, setConfirmLoading] = useState(false)

  const selectPlan = async (tier: Tier) => {
    if (tier === activeTier || loading) return
    setLoading(tier)
    setError(null)
    try {
      const res = await fetch("/api/user/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      })
      const body = await res.json().catch(() => ({})) as {
        error?: string
        requiresDowngrade?: boolean
        activeTournaments?: ActiveTournamentInfo[]
        newLimit?: number
        currentCount?: number
        success?: boolean
      }

      if (body.requiresDowngrade) {
        // Show selection modal
        setPendingTier(tier)
        setDowngradeInfo({
          activeTournaments: body.activeTournaments ?? [],
          newLimit: body.newLimit ?? 1,
          currentCount: body.currentCount ?? 0,
        })
        setCancelIds(new Set())
        setDowngradeOpen(true)
        return
      }

      if (!res.ok) {
        throw new Error(body.error ?? "Failed to update plan")
      }

      setActiveTier(tier)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(null)
    }
  }

  const confirmDowngrade = async () => {
    if (!pendingTier || !downgradeInfo) return
    const needed = downgradeInfo.currentCount - downgradeInfo.newLimit
    if (cancelIds.size < needed) return

    setConfirmLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/user/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: pendingTier,
          cancelTournamentIds: Array.from(cancelIds),
        }),
      })
      const body = await res.json().catch(() => ({})) as { error?: string; success?: boolean }
      if (!res.ok) throw new Error(body.error ?? "Failed to update plan")
      setActiveTier(pendingTier)
      setDowngradeOpen(false)
      setPendingTier(null)
      setDowngradeInfo(null)
      setCancelIds(new Set())
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setConfirmLoading(false)
    }
  }

  const toggleCancel = (tid: string) => {
    setCancelIds((prev) => {
      const next = new Set(prev)
      if (next.has(tid)) next.delete(tid)
      else next.add(tid)
      return next
    })
  }

  const needed = downgradeInfo ? downgradeInfo.currentCount - downgradeInfo.newLimit : 0
  const canConfirm = cancelIds.size >= needed

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-black uppercase text-foreground mb-1">
          Plan & Billing
        </h1>
        <p className="text-muted-foreground text-sm">
          Select your plan. Payment via Stripe & Bitcoin — coming soon.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-5">
        {PLANS.map((plan) => {
          const isCurrent = plan.tier === activeTier
          const isLoading = loading === plan.tier

          return (
            <Card
              key={plan.tier}
              className={`flex flex-col relative overflow-hidden transition-all ${plan.glowClass} ${
                isCurrent
                  ? `${plan.borderClass} ring-2 ring-offset-2 ring-offset-background`
                  : "border-border opacity-80 hover:opacity-100"
              }`}
              style={
                isCurrent && plan.tier === "max"
                  ? { boxShadow: "0 0 0 2px #f59e0b, 0 0 24px rgba(245,158,11,0.15)" }
                  : isCurrent && plan.tier === "pro"
                  ? { boxShadow: "0 0 0 2px hsl(var(--brand-purple)), 0 0 24px rgba(168,85,247,0.15)" }
                  : {}
              }
            >
              {/* Top accent line */}
              {isCurrent && (
                <div
                  className="absolute top-0 left-0 right-0 h-px"
                  style={{
                    background:
                      plan.tier === "max"
                        ? "linear-gradient(to right, transparent, #f59e0b, transparent)"
                        : plan.tier === "pro"
                        ? "linear-gradient(to right, transparent, var(--brand-purple), transparent)"
                        : "linear-gradient(to right, transparent, hsl(var(--brand-cyan)), transparent)",
                  }}
                />
              )}

              <CardHeader>
                <div className="flex items-center justify-between mb-3">
                  <Badge
                    className={`${plan.badgeBg} ${plan.badgeText} text-xs uppercase tracking-widest hover:${plan.badgeBg} flex items-center gap-1`}
                  >
                    {plan.icon}
                    {plan.tier === "free" ? "Free" : plan.tier === "pro" ? "Pro" : "Max"}
                  </Badge>
                  {isCurrent && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border border-border rounded px-1.5 py-0.5">
                      Current
                    </span>
                  )}
                </div>
                <CardTitle className="font-heading text-2xl font-black text-foreground uppercase">
                  {plan.name}
                </CardTitle>
                <CardDescription className="text-muted-foreground text-xs">
                  {plan.tagline}
                </CardDescription>
                <div className="pt-2">
                  <span className={`text-3xl font-heading font-black ${plan.color}`}>
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground ml-1 text-xs">{plan.period}</span>
                </div>
              </CardHeader>

              <CardPanel className="flex flex-col gap-2 flex-1">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-xs text-foreground/70">
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      size={14}
                      className={`${plan.color} shrink-0 mt-0.5`}
                    />
                    {f}
                  </div>
                ))}
              </CardPanel>

              <CardFooter>
                {isCurrent ? (
                  <Button
                    variant="outline"
                    className="w-full border-border text-muted-foreground cursor-default"
                    disabled
                  >
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    className="w-full font-bold"
                    style={
                      plan.tier === "max"
                        ? { background: "#f59e0b", color: "#000", border: "none" }
                        : plan.tier === "pro"
                        ? { background: "var(--brand-purple)", color: "white", border: "none" }
                        : {}
                    }
                    variant={plan.tier === "free" ? "outline" : "default"}
                    loading={isLoading}
                    onClick={() => selectPlan(plan.tier)}
                  >
                    {plan.tier === "free"
                      ? "Downgrade to Free"
                      : plan.tier === "pro"
                      ? "Upgrade to Oracle"
                      : "Upgrade to Legend"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>

      <p className="mt-6 text-xs text-muted-foreground/60">
        Stripe & Bitcoin payments coming soon. Plans update immediately for now.
      </p>

      {/* Downgrade selection modal */}
      <Dialog open={downgradeOpen} onOpenChange={(open) => { if (!open) setDowngradeOpen(false) }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Cancel tournaments to downgrade</DialogTitle>
            <DialogDescription>
              Your new plan allows{" "}
              <span className="font-semibold text-foreground">{downgradeInfo?.newLimit}</span>{" "}
              active tournament{downgradeInfo?.newLimit === 1 ? "" : "s"}, but you&apos;re
              currently in{" "}
              <span className="font-semibold text-foreground">{downgradeInfo?.currentCount}</span>.
              {" "}Select <span className="font-semibold text-foreground">{needed}</span> tournament{needed === 1 ? "" : "s"} to cancel. Your existing answers and score will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <div className="flex flex-col gap-2">
              {downgradeInfo?.activeTournaments.map((t) => {
                const checked = cancelIds.has(t.tournamentId)
                return (
                  <label
                    key={t.tournamentId}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                      checked
                        ? "border-destructive/60 bg-destructive/8"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-destructive h-4 w-4 shrink-0"
                      checked={checked}
                      onChange={() => toggleCancel(t.tournamentId)}
                    />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-semibold text-foreground">
                        {GAME_LABEL[t.game] ?? t.game}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {t.tournamentId}
                      </span>
                    </div>
                    {checked && (
                      <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-destructive shrink-0">
                        Cancel
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDowngradeOpen(false)
                setPendingTier(null)
                setDowngradeInfo(null)
                setCancelIds(new Set())
              }}
            >
              Keep current plan
            </Button>
            <Button
              variant="destructive"
              disabled={!canConfirm || confirmLoading}
              loading={confirmLoading}
              onClick={confirmDowngrade}
            >
              Confirm downgrade
              {needed > 0 && !canConfirm && ` (${needed - cancelIds.size} more)`}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
