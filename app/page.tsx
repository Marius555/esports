"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardPanel,
  CardFooter,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { Award01Icon, BrainCogIcon, ArrowRight01Icon, CheckmarkCircle01Icon, Crown02Icon, Shield01Icon, SparklesIcon, Target01Icon, UserAdd01Icon, ZapIcon } from "@hugeicons/core-free-icons"
import { AuthModal } from "@/components/auth-modal"

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar({ onAuthOpen }: { onAuthOpen: () => void }) {
  return (
    <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2">
          <HugeiconsIcon icon={ZapIcon} size={20} className="text-brand-purple" />
          <span className="font-heading text-xl font-black tracking-widest text-brand-purple text-glow-purple uppercase">
            Gamery
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
          <Link href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</Link>
          <Link href="#pricing" className="hover:text-foreground transition-colors">Pricing</Link>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onAuthOpen}>Login</Button>
          <Button
            size="sm"
            className="bg-brand-purple hover:bg-brand-purple-hover text-foreground glow-purple border-0"
            onClick={onAuthOpen}
          >
            Sign Up Free
          </Button>
        </div>
      </div>
    </nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ onAuthOpen }: { onAuthOpen: () => void }) {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16 bg-background">
      {/* Background */}
      <div className="absolute inset-0 bg-grid-purple opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_0%_50%,rgb(168_85_247/18%),transparent)]" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(ellipse_80%_60%_at_100%_40%,rgb(34_211_238/8%),transparent)]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left — text */}
          <div className="flex flex-col">
            {/* Label */}
            <div className="flex items-center gap-3 mb-8">
              <div className="h-px w-8 bg-brand-purple" />
              <span className="text-brand-purple text-xs font-semibold uppercase tracking-[0.2em]">
                Season 1 — Live Now
              </span>
            </div>

            <h1 className="font-heading font-black leading-[0.9] tracking-tight mb-8">
              <span className="block text-5xl sm:text-6xl lg:text-7xl xl:text-8xl text-foreground uppercase">
                Predict.
              </span>
              <span className="block text-5xl sm:text-6xl lg:text-7xl xl:text-8xl text-brand-purple text-glow-purple uppercase">
                Compete.
              </span>
              <span className="block text-5xl sm:text-6xl lg:text-7xl xl:text-8xl text-brand-cyan text-glow-cyan uppercase">
                Win.
              </span>
            </h1>

            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mb-10 max-w-lg">
              Forecast CS2 and LoL match outcomes through skill and game knowledge.
              Every correct prediction earns points — top forecasters take the{" "}
              <span className="text-foreground font-semibold">€50 monthly prize</span>.
            </p>

            <div className="flex flex-wrap gap-3 mb-12">
              <Button
                size="lg"
                className="bg-brand-purple hover:bg-brand-purple-hover text-foreground glow-purple border-0 h-12 px-7 font-semibold"
                onClick={onAuthOpen}
              >
                Start for Free
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="ml-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-border text-foreground/70 hover:bg-accent hover:border-border h-12 px-7"
                render={<Link href="#how-it-works" />}
              >
                How It Works
              </Button>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-8 pt-8 border-t border-border">
              {[
                { value: "2,400+", label: "Players" },
                { value: "€50", label: "Monthly Prize" },
                { value: "CS2 & LoL", label: "Games" },
              ].map((s, i) => (
                <div key={s.label}>
                  {i > 0 && <div className="h-6 w-px bg-border absolute" style={{ marginLeft: "-1rem" }} />}
                  <div className="text-xl font-heading font-black text-foreground">{s.value}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — image placeholder */}
          <div className="relative hidden lg:flex items-center justify-center">
            {/* Outer glow ring */}
            <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_center,rgb(168_85_247/20%),transparent_70%)]" />

            {/* Placeholder frame */}
            <div className="relative w-full aspect-[4/3] rounded-2xl border border-brand-purple/20 bg-card overflow-hidden flex items-center justify-center">
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-brand-purple rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-brand-purple rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-brand-cyan rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-brand-cyan rounded-br-2xl" />

              <div className="text-center p-8 select-none pointer-events-none">
                <div className="size-16 rounded-xl bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center mx-auto mb-4">
                  <HugeiconsIcon icon={ZapIcon} size={32} className="text-brand-purple/40" />
                </div>
                <p className="text-muted-foreground/60 text-sm">Hero image</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </section>
  )
}

// ─── Built for Competitors ────────────────────────────────────────────────────

function FeaturesDetail({ onAuthOpen }: { onAuthOpen: () => void }) {
  const features = [
    {
      num: "01",
      icon: <HugeiconsIcon icon={Target01Icon} size={20} />,
      title: "Skill-Based Forecasting",
      description: "Points are earned through game knowledge and analytical skill — not luck. Every correct call is yours.",
      color: "text-brand-cyan",
    },
    {
      num: "02",
      icon: <HugeiconsIcon icon={BrainCogIcon} size={20} />,
      title: "AI Oracle Insights",
      description: "Premium members unlock Gemini AI analysis: win probabilities, tactical breakdowns, head-to-head history.",
      color: "text-brand-purple",
    },
    {
      num: "03",
      icon: <HugeiconsIcon icon={Award01Icon} size={20} />,
      title: "Fixed Monthly Prize",
      description: "The €50 prize pool is fixed and shared between top forecasters. Climb the leaderboard and take it.",
      color: "text-yellow-400",
    },
    {
      num: "04",
      icon: <HugeiconsIcon icon={Shield01Icon} size={20} />,
      title: "Skill Contest, Not Gambling",
      description: "Fully legal skill-based competition. We use Forecasts and Points — no odds, no bets, no wagers.",
      color: "text-emerald-400",
    },
  ]

  return (
    <section id="features" className="py-28 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section label */}
        <div className="flex items-center gap-3 mb-16">
          <div className="h-px w-8 bg-brand-cyan" />
          <span className="text-brand-cyan text-xs font-semibold uppercase tracking-[0.2em]">
            Platform
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">

          {/* Left — image placeholder */}
          <div className="relative order-2 lg:order-1">
            <div className="sticky top-24">
              {/* Placeholder frame */}
              <div className="relative aspect-[3/4] rounded-2xl border border-border bg-card overflow-hidden flex items-center justify-center">
                {/* Grid overlay */}
                <div className="absolute inset-0 bg-grid-purple opacity-40" />
                {/* Horizontal accent line */}
                <div className="absolute top-1/3 left-0 right-0 h-px bg-gradient-to-r from-brand-cyan/40 via-brand-cyan/10 to-transparent" />
                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-brand-cyan rounded-tl-2xl" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-brand-purple rounded-br-2xl" />

                <div className="relative z-10 text-center p-8 select-none pointer-events-none">
                  <div className="size-14 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center mx-auto mb-3">
                    <HugeiconsIcon icon={Target01Icon} size={24} className="text-brand-cyan/40" />
                  </div>
                  <p className="text-muted-foreground/60 text-sm">Feature image</p>
                </div>
              </div>

              {/* Floating stat card */}
              <div className="absolute -bottom-4 -right-4 bg-card border border-brand-purple/30 rounded-xl px-5 py-3 glow-purple">
                <div className="text-2xl font-heading font-black text-foreground">18k+</div>
                <div className="text-xs text-muted-foreground uppercase tracking-widest">Forecasts made</div>
              </div>
            </div>
          </div>

          {/* Right — feature list */}
          <div className="order-1 lg:order-2 flex flex-col">
            <h2 className="font-heading text-4xl sm:text-5xl font-black uppercase text-foreground mb-4 leading-tight">
              Built for{" "}
              <span className="text-brand-cyan text-glow-cyan">Competitors</span>
            </h2>
            <p className="text-muted-foreground text-base mb-12 leading-relaxed max-w-md">
              Every feature is designed around one goal: rewarding players who put in the work to study the game.
            </p>

            <div className="flex flex-col">
              {features.map((f, i) => (
                <div key={f.num} className="group relative">
                  {/* Connector line between items */}
                  {i < features.length - 1 && (
                    <div className="absolute left-[1.1rem] top-14 bottom-0 w-px bg-border z-0" />
                  )}
                  <div className="relative z-10 flex gap-5 pb-10">
                    {/* Number/icon column */}
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <div className={`size-9 rounded-lg bg-card border border-border flex items-center justify-center ${f.color} group-hover:border-current transition-colors duration-300`}>
                        {f.icon}
                      </div>
                    </div>
                    {/* Text */}
                    <div className="pt-1">
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="text-xs font-mono text-muted-foreground/60">{f.num}</span>
                        <h3 className="font-heading font-bold text-foreground text-lg">{f.title}</h3>
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              className="self-start border-border text-foreground/70 hover:bg-accent mt-2"
              onClick={onAuthOpen}
            >
              Start competing
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="ml-1" />
            </Button>
          </div>

        </div>
      </div>
    </section>
  )
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

function Pricing({ onAuthOpen }: { onAuthOpen: () => void }) {
  const freeFeatures = [
    "1 active tournament at a time",
    "Unlimited match forecasts",
    "Live match data",
    "Monthly leaderboard",
    "10 points per correct forecast",
    "Compete for €50 monthly prize",
  ]

  const premiumFeatures = [
    "2 active tournaments at a time",
    "Everything in Free",
    "AI-powered win probability",
    "Tactical team breakdowns",
    "Historical team performance",
    "Head-to-head analysis",
  ]

  const maxFeatures = [
    "3 active tournaments at a time",
    "Everything in Oracle",
    "Priority AI processing",
    "Fastest answer tiebreaker edge",
    "Early access to new features",
    "Dedicated priority support",
  ]

  return (
    <section id="pricing" className="py-28 bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex items-center gap-3 mb-16">
          <div className="h-px w-8 bg-brand-purple" />
          <span className="text-brand-purple text-xs font-semibold uppercase tracking-[0.2em]">Pricing</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Free */}
          <Card className="bg-card border border-border flex flex-col flex-1">
            <CardHeader>
              <Badge variant="secondary" className="w-fit mb-3 text-xs uppercase tracking-widest">Free</Badge>
              <CardTitle className="font-heading text-3xl font-black text-foreground uppercase">Recruit</CardTitle>
              <CardDescription className="text-muted-foreground text-sm">Everything you need to compete</CardDescription>
              <div className="pt-3">
                <span className="text-4xl font-heading font-black text-foreground">€0</span>
                <span className="text-muted-foreground ml-1 text-sm">forever</span>
              </div>
            </CardHeader>
            <CardPanel className="flex flex-col gap-2.5 flex-1">
              {freeFeatures.map((f) => (
                <div key={f} className="flex items-start gap-2.5 text-sm text-foreground/70">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} className="text-brand-cyan shrink-0 mt-0.5" />
                  {f}
                </div>
              ))}
            </CardPanel>
            <CardFooter>
              <Button variant="outline" className="w-full border-border text-foreground hover:bg-accent" onClick={onAuthOpen}>
                Get Started Free
              </Button>
            </CardFooter>
          </Card>

          {/* Oracle (Pro) */}
          <Card className="bg-card border border-brand-purple/40 glow-purple flex flex-col flex-1 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-purple to-transparent" />
            <CardHeader>
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-brand-purple text-foreground text-xs uppercase tracking-widest hover:bg-brand-purple">
                  <HugeiconsIcon icon={SparklesIcon} size={12} className="mr-1" />Pro
                </Badge>
              </div>
              <CardTitle className="font-heading text-3xl font-black text-foreground uppercase">Oracle</CardTitle>
              <CardDescription className="text-muted-foreground text-sm">AI edge for serious forecasters</CardDescription>
              <div className="pt-3">
                <span className="text-4xl font-heading font-black text-brand-purple text-glow-purple">$20</span>
                <span className="text-muted-foreground ml-1 text-sm">/ month</span>
              </div>
            </CardHeader>
            <CardPanel className="flex flex-col gap-2.5 flex-1">
              {premiumFeatures.map((f) => (
                <div key={f} className="flex items-start gap-2.5 text-sm text-foreground/70">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} className="text-brand-purple shrink-0 mt-0.5" />
                  {f}
                </div>
              ))}
            </CardPanel>
            <CardFooter>
              <Button className="w-full bg-brand-purple hover:bg-brand-purple-hover text-foreground border-0" onClick={onAuthOpen}>
                Start with Oracle
              </Button>
            </CardFooter>
          </Card>

          {/* Legend (Max) */}
          <Card className="bg-card border border-amber-500/40 flex flex-col flex-1 relative overflow-hidden" style={{ boxShadow: "0 0 24px rgba(245,158,11,0.12)" }}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
            <CardHeader>
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-amber-500 text-black text-xs uppercase tracking-widest hover:bg-amber-400">
                  <HugeiconsIcon icon={Crown02Icon} size={12} className="mr-1" />Max
                </Badge>
              </div>
              <CardTitle className="font-heading text-3xl font-black text-foreground uppercase">Legend</CardTitle>
              <CardDescription className="text-muted-foreground text-sm">Maximum competitive advantage</CardDescription>
              <div className="pt-3">
                <span className="text-4xl font-heading font-black text-amber-400">$35</span>
                <span className="text-muted-foreground ml-1 text-sm">/ month</span>
              </div>
            </CardHeader>
            <CardPanel className="flex flex-col gap-2.5 flex-1">
              {maxFeatures.map((f) => (
                <div key={f} className="flex items-start gap-2.5 text-sm text-foreground/70">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  {f}
                </div>
              ))}
            </CardPanel>
            <CardFooter>
              <Button className="w-full text-black border-0 font-bold hover:opacity-90" style={{ background: "#f59e0b" }} onClick={onAuthOpen}>
                Go Legend
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </section>
  )
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorks({ onAuthOpen }: { onAuthOpen: () => void }) {
  const steps = [
    {
      num: "01",
      title: "Create Your Account",
      description: "Sign up in under a minute. Free forever — no credit card, no commitment. Pick your tag and enter the arena.",
      icon: <HugeiconsIcon icon={UserAdd01Icon} size={20} />,
    },
    {
      num: "02",
      title: "Make Your Forecasts",
      description: "Browse upcoming CS2 and LoL matches. Lock in your pick before the game starts. Every correct forecast earns 10 points.",
      icon: <HugeiconsIcon icon={Target01Icon} size={20} />,
    },
    {
      num: "03",
      title: "Climb & Collect",
      description: "Points stack across the month. Top forecasters at the end of the season split the €50 fixed prize. Skill pays.",
      icon: <HugeiconsIcon icon={Award01Icon} size={20} />,
    },
  ]

  return (
    <section id="how-it-works" className="py-28 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex items-center gap-3 mb-16">
          <div className="h-px w-8 bg-brand-purple" />
          <span className="text-brand-purple text-xs font-semibold uppercase tracking-[0.2em]">Process</span>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">

          {/* Left — vertical steps */}
          <div className="flex flex-col">
            <h2 className="font-heading text-4xl sm:text-5xl font-black uppercase text-foreground mb-4 leading-tight">
              Three Steps to{" "}
              <span className="text-brand-purple text-glow-purple">Victory</span>
            </h2>
            <p className="text-muted-foreground text-base mb-14 leading-relaxed max-w-md">
              No complicated systems. No paywalls on the core game. Just your knowledge against everyone else&apos;s.
            </p>

            <div className="flex flex-col">
              {steps.map((step, i) => (
                <div key={step.num} className="relative flex gap-6">
                  {/* Left column: number + line */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className="size-10 rounded-xl bg-brand-purple/10 border border-brand-purple/30 flex items-center justify-center text-brand-purple font-heading font-black text-xs shrink-0">
                      {i + 1}
                    </div>
                    {i < steps.length - 1 && (
                      <div className="w-px flex-1 bg-gradient-to-b from-brand-purple/30 to-transparent mt-3 mb-3 min-h-12" />
                    )}
                  </div>
                  {/* Content */}
                  <div className={i < steps.length - 1 ? "pb-12" : ""}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-brand-purple">{step.icon}</span>
                      <h3 className="font-heading font-black text-foreground text-xl uppercase">{step.title}</h3>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              size="lg"
              className="self-start mt-10 bg-brand-purple hover:bg-brand-purple-hover text-foreground glow-purple border-0 h-12 px-7 font-semibold"
              onClick={onAuthOpen}
            >
              Join Free
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="ml-1" />
            </Button>
          </div>

          {/* Right — image placeholder */}
          <div className="hidden lg:block">
            <div className="relative aspect-[3/4] rounded-2xl border border-border bg-card overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-grid-purple opacity-30" />
              <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-brand-purple/10 to-transparent" />
              {/* Corner accents */}
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-brand-purple rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-brand-cyan rounded-bl-2xl" />

              <div className="relative z-10 text-center p-8 select-none pointer-events-none">
                <div className="size-14 rounded-xl bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center mx-auto mb-3">
                  <HugeiconsIcon icon={Award01Icon} size={24} className="text-brand-purple/40" />
                </div>
                <p className="text-muted-foreground/60 text-sm">Process image</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}

// ─── CTA ─────────────────────────────────────────────────────────────────────

function CTASection({ onAuthOpen }: { onAuthOpen: () => void }) {
  return (
    <section className="py-28 bg-card relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_100%,rgb(168_85_247/12%),transparent)]" />
      <div className="absolute inset-0 bg-grid-purple opacity-30" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-px w-8 bg-brand-purple" />
          <span className="text-brand-purple text-xs font-semibold uppercase tracking-[0.2em]">Get started</span>
          <div className="h-px w-8 bg-brand-purple" />
        </div>

        <h2 className="font-heading text-5xl sm:text-6xl font-black uppercase text-foreground mb-5 leading-tight">
          Enter the Arena
        </h2>
        <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
          Free forever. Upgrade for the AI edge when you&apos;re ready.
          Your first forecast is one click away.
        </p>

        <Button
          size="lg"
          className="bg-brand-purple hover:bg-brand-purple-hover text-foreground glow-purple border-0 h-12 px-10 font-semibold"
          onClick={onAuthOpen}
        >
          Join Free — No Card Needed
          <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="ml-1.5" />
        </Button>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-background border-t border-border py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={ZapIcon} size={16} className="text-brand-purple" />
            <span className="font-heading font-black tracking-widest text-brand-purple uppercase text-sm">Gamery</span>
          </div>
          <div className="flex items-center gap-8 text-sm text-muted-foreground/60">
            <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
          <p className="text-xs text-muted-foreground/40">
            © 2026 Gamery. Skill-based contest — not gambling.
          </p>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false)
  const openAuth = () => setAuthOpen(true)

  return (
    <div className="min-h-screen bg-background">
      <Navbar onAuthOpen={openAuth} />
      <Hero onAuthOpen={openAuth} />
      <FeaturesDetail onAuthOpen={openAuth} />
      <Pricing onAuthOpen={openAuth} />
      <HowItWorks onAuthOpen={openAuth} />
      <CTASection onAuthOpen={openAuth} />
      <Footer />
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  )
}
