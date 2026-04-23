"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function RefreshOnMount() {
  const router = useRouter()
  useEffect(() => {
    fetch("/api/user/tournaments/refresh", { method: "POST" })
      .then(() => router.refresh())
  }, [router])
  return null
}
