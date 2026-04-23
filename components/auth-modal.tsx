"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Award01Icon, SparklesIcon, Target01Icon, ZapIcon } from "@hugeicons/core-free-icons"
import { getGoogleOAuthUrl } from "@/app/actions/auth"
import { UsernameSetupModal } from "@/components/username-setup-modal"

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
  </svg>
)

const features = [
  {
    icon: Target01Icon,
    label: "Forecast matches & stack points every week",
    iconCls: "text-brand-cyan",
    bgCls: "bg-brand-cyan/10",
  },
  {
    icon: SparklesIcon,
    label: "AI Oracle insights unlock for Pro members",
    iconCls: "text-brand-purple",
    bgCls: "bg-brand-purple/10",
  },
  {
    icon: Award01Icon,
    label: "Top forecasters split the €50 monthly prize",
    iconCls: "text-yellow-400",
    bgCls: "bg-yellow-400/10",
  },
]

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const router = useRouter()
  const [googleState, setGoogleState] = useState<"idle" | "opening" | "waiting">("idle")
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const popupRef = useRef<Window | null>(null)
  const bcRef = useRef<BroadcastChannel | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function cleanup() {
    bcRef.current?.close()
    bcRef.current = null
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
  }

  useEffect(() => () => cleanup(), [])

  useEffect(() => {
    if (!open) {
      cleanup()
      setGoogleState("idle")
    }
  }, [open])

  async function handleGoogleSignIn() {
    setGoogleState("opening")
    try {
      const url = await getGoogleOAuthUrl(window.location.origin)
      const w = 500, h = 640
      const left = Math.round(window.screenX + (window.outerWidth - w) / 2)
      const top = Math.round(window.screenY + (window.outerHeight - h) / 2)
      const popup = window.open(url, "google_oauth", `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`)
      if (!popup) { window.location.href = url; return }
      popupRef.current = popup
      setGoogleState("waiting")
      const bc = new BroadcastChannel("oauth_google")
      bcRef.current = bc
      bc.onmessage = (e: MessageEvent) => {
        if (e.data?.type === "success") {
          cleanup(); popupRef.current?.close(); onOpenChange(false)
          router.push(`/auth/${e.data.userId}/dashboard`)
        } else if (e.data?.type === "needs_username") {
          cleanup(); setGoogleState("idle"); onOpenChange(false)
          setPendingUserId(e.data.userId); setShowUsernameModal(true)
        } else if (e.data?.type === "error") {
          cleanup(); popupRef.current?.close(); setGoogleState("idle")
        }
      }
      pollRef.current = setInterval(() => {
        if (popupRef.current?.closed) { cleanup(); setGoogleState("idle") }
      }, 600)
    } catch {
      setGoogleState("idle")
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPopup className="overflow-hidden border-brand-purple/25 p-0 gap-0">

          {/* ── Decorative hero header ─────────────────────────── */}
          <div className="relative flex flex-col items-center justify-center gap-3 px-8 pt-10 pb-8">
            {/* layered backgrounds */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_140%_at_50%_-10%,rgb(168_85_247/20%),transparent_70%)]" />
            <div className="absolute inset-0 bg-grid-purple opacity-[0.35] pointer-events-none" />
          
            {/* bottom divider */}
            <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-purple/30 to-transparent" />
         

            {/* icon with glow */}
            <div className="relative z-10">
              <div className="absolute inset-0 rounded-2xl bg-brand-purple/30 blur-xl scale-[1.8]" />
              <div className="relative size-[3.75rem] rounded-2xl bg-gradient-to-br from-brand-purple/25 to-brand-purple/5 border border-brand-purple/40 flex items-center justify-center shadow-[0_0_24px_rgb(168_85_247/30%)]">
                <HugeiconsIcon icon={ZapIcon} size={28} className="text-brand-purple" />
              </div>
            </div>

            {/* heading */}
            <div className="relative z-10 text-center space-y-1.5 mt-1">
              <DialogTitle className="font-heading font-black text-[1.6rem] uppercase tracking-tight leading-none text-foreground">
                Join the Arena
              </DialogTitle>
              <DialogDescription className="text-[0.8rem] text-muted-foreground leading-relaxed max-w-[22rem]">
                Skill-based esports forecasting. Predict matches, earn points,
                compete for real prizes.
              </DialogDescription>
            </div>
          </div>

          {/* ── Content ────────────────────────────────────────── */}
          <div className="px-6 py-5 flex flex-col gap-5">

            {/* sign-in block */}
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 gap-2.5 font-semibold text-sm border-border/70 bg-white/[0.03] hover:bg-white/[0.07] hover:border-border transition-colors"
                onClick={handleGoogleSignIn}
                loading={googleState !== "idle"}
                disabled={googleState !== "idle"}
              >
                {googleState === "idle" && <GoogleLogo />}
                {googleState === "idle"
                  ? "Continue with Google"
                  : googleState === "opening"
                    ? "Opening Google…"
                    : "Waiting for sign-in…"}
              </Button>

              <p className="text-center text-[0.68rem] text-muted-foreground/45 tracking-wide">
                Free forever · No credit card required
              </p>
            </div>
          </div>

        </DialogPopup>
      </Dialog>

      {showUsernameModal && pendingUserId && (
        <UsernameSetupModal
          open={showUsernameModal}
          userId={pendingUserId}
          onSuccess={(uid) => {
            setShowUsernameModal(false)
            router.push(`/auth/${uid}/dashboard`)
          }}
        />
      )}
    </>
  )
}
