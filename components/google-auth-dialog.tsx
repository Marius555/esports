"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getGoogleOAuthUrl } from "@/app/actions/auth"

interface GoogleAuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
    </svg>
  )
}

export function GoogleAuthDialog({ open, onOpenChange }: GoogleAuthDialogProps) {
  const router = useRouter()
  const [state, setState] = useState<"idle" | "opening" | "waiting">("idle")
  const popupRef = useRef<Window | null>(null)
  const bcRef = useRef<BroadcastChannel | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function cleanup() {
    bcRef.current?.close()
    bcRef.current = null
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
  }

  useEffect(() => {
    return cleanup
  }, [])

  async function handleGoogleSignIn() {
    setState("opening")
    try {
      const url = await getGoogleOAuthUrl(window.location.origin)

      const width = 500
      const height = 640
      const left = Math.round(window.screenX + (window.outerWidth - width) / 2)
      const top = Math.round(window.screenY + (window.outerHeight - height) / 2)
      const popup = window.open(
        url,
        "google_oauth",
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
      )

      if (!popup) {
        // Popup was blocked — fall back to full-page redirect
        window.location.href = url
        return
      }

      popupRef.current = popup
      setState("waiting")

      // Listen for success broadcast from the popup
      const bc = new BroadcastChannel("oauth_google")
      bcRef.current = bc
      bc.onmessage = (e: MessageEvent) => {
        if (e.data?.type === "success") {
          cleanup()
          popupRef.current?.close()
          onOpenChange(false)
          router.push(`/auth/${e.data.userId}/dashboard`)
        } else if (e.data?.type === "error") {
          cleanup()
          popupRef.current?.close()
          setState("idle")
        }
      }

      // Poll for popup being closed manually (user dismissed it)
      pollRef.current = setInterval(() => {
        if (popupRef.current?.closed) {
          cleanup()
          setState("idle")
        }
      }, 600)
    } catch {
      setState("idle")
    }
  }

  function handleOpenChange(val: boolean) {
    if (state === "waiting") {
      // Close the popup if user dismisses the dialog
      popupRef.current?.close()
      cleanup()
    }
    setState("idle")
    onOpenChange(val)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={state !== "waiting"}>
        <DialogHeader>
          <DialogTitle className="text-center">
            {state === "waiting" ? "Waiting for Google…" : "Continue with Google"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {state === "waiting"
              ? "Complete sign-in in the popup window"
              : "Sign in or create an account using your Google profile"}
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
          {state !== "waiting" ? (
            <div className="flex flex-col items-center gap-4 py-2">
              
              <Button
                onClick={handleGoogleSignIn}
                loading={state === "opening"}
                className="w-full h-11 bg-white hover:bg-white/90 text-gray-800 border border-gray-200 font-medium gap-2 [&_[data-slot=button-loading-indicator]]:!text-gray-800"
              >
                {state === "idle" && <GoogleIcon />}
                Sign in with Google
              </Button>
              <p className="text-xs text-muted-foreground text-center px-4">
                By continuing, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 py-6">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-border border-t-white animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <GoogleIcon />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">Sign-in window is open</p>
                <p className="text-xs text-muted-foreground">
                  Complete the process in the popup, then return here
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  popupRef.current?.focus()
                }}
              >
                Bring window to front
              </Button>
            </div>
          )}
        </DialogPanel>
      </DialogContent>
    </Dialog>
  )
}
