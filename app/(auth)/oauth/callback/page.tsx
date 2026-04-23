"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { processOAuthCallback } from "@/app/actions/auth"
import { UsernameSetupModal } from "@/components/username-setup-modal"

function OAuthCallbackInner() {
  const router = useRouter()
  const params = useSearchParams()
  const called = useRef(false)
  const [inlineSetup, setInlineSetup] = useState<{ userId: string } | null>(null)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const userId = params.get("userId")
    const secret = params.get("secret")

    const isPopup = Boolean(window.opener)

    function broadcast(type: "success" | "error" | "needs_username", data?: Record<string, string>) {
      const bc = new BroadcastChannel("oauth_google")
      bc.postMessage({ type, ...data })
      bc.close()
    }

    function fail() {
      if (isPopup) {
        broadcast("error")
        window.close()
      } else {
        router.replace("/")
      }
    }

    if (!userId || !secret) {
      fail()
      return
    }

    const timeout = setTimeout(fail, 15_000)

    processOAuthCallback(userId, secret)
      .then((result) => {
        clearTimeout(timeout)
        if (result.isNew) {
          if (isPopup) {
            broadcast("needs_username", { userId: result.userId })
            window.close()
          } else {
            setInlineSetup({ userId: result.userId })
          }
        } else {
          if (isPopup) {
            broadcast("success", { userId: result.userId })
            window.close()
          } else {
            router.replace(`/auth/${result.userId}/dashboard`)
          }
        }
      })
      .catch(() => {
        clearTimeout(timeout)
        fail()
      })
  }, [params, router])

  if (inlineSetup) {
    return (
      <UsernameSetupModal
        open={true}
        userId={inlineSetup.userId}
        onSuccess={(uid) => router.replace(`/auth/${uid}/dashboard`)}
      />
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-border border-t-white animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
          </svg>
        </div>
      </div>
      <div className="text-center space-y-1">
        <h1 className="text-xl font-semibold font-heading">Completing sign-in</h1>
        <p className="text-sm text-muted-foreground">Verifying your account with Google…</p>
      </div>
    </div>
  )
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="w-8 h-8 rounded-full border-2 border-border border-t-white animate-spin" />
        </div>
      }
    >
      <OAuthCallbackInner />
    </Suspense>
  )
}
