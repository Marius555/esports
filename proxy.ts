import { NextRequest, NextResponse } from "next/server"
import { verifyToken, COOKIE_NAME } from "@/lib/auth"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(COOKIE_NAME)?.value

  if (!token) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  const payload = await verifyToken(token)

  if (!payload) {
    const res = NextResponse.redirect(new URL("/login", request.url))
    res.cookies.delete(COOKIE_NAME)
    return res
  }

  if (pathname.startsWith("/premium") && payload.tier === "free") {
    return NextResponse.redirect(new URL("/dashboard?upgrade=true", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/premium/:path*"],
}
