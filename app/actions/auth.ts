"use server"

import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import {
  createAdminClient,
  DB_ID,
  USERS_TABLE_ID,
  Query,
  Permission,
  Role,
  AppwriteException,
  OAuthProvider,
  type UserRow,
} from "@/lib/appwrite"
import { signToken, COOKIE_NAME, COOKIE_MAX_AGE } from "@/lib/auth"

const PENDING_COOKIE_NAME = "pending_setup"
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

// ─── getGoogleOAuthUrl ────────────────────────────────────────────────────────

export async function getGoogleOAuthUrl(origin: string): Promise<string> {
  const { account } = createAdminClient()
  const url = await account.createOAuth2Token({
    provider: OAuthProvider.Google,
    success: `${origin}/oauth/callback`,
    failure: `${origin}/`,
  })
  return url.toString()
}

// ─── processOAuthCallback ──────────────────────────────────────────────────────

export async function processOAuthCallback(
  userId: string,
  secret: string,
): Promise<{ userId: string; isNew: boolean }> {
  const { account, tablesDB, users } = createAdminClient()

  await account.createSession({ userId, secret })

  const appwriteUser = await users.get({ userId })

  const rows = await tablesDB.listRows({
    databaseId: DB_ID,
    tableId: USERS_TABLE_ID,
    queries: [Query.equal("userId", userId), Query.limit(1)],
  })

  if (rows.total === 0) {
    const pendingToken = await new SignJWT({ userId, email: appwriteUser.email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(SECRET)

    const cookieStore = await cookies()
    cookieStore.set(PENDING_COOKIE_NAME, pendingToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    })

    return { userId, isNew: true }
  }

  const userRow = rows.rows[0] as unknown as UserRow

  const token = await signToken({
    userId: userRow.userId,
    username: userRow.username,
    email: userRow.email,
    tier: userRow.tier,
  })

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  })

  return { userId: userRow.userId, isNew: false }
}

// ─── setupUsername ─────────────────────────────────────────────────────────────

const usernameSchema = z
  .string()
  .min(3, "At least 3 characters")
  .max(20, "At most 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only")

export async function setupUsername(
  userId: string,
  username: string,
): Promise<{ success: true; userId: string } | { success: false; error: string }> {
  const cookieStore = await cookies()
  const pendingToken = cookieStore.get(PENDING_COOKIE_NAME)?.value

  if (!pendingToken) {
    return { success: false, error: "Session expired. Please sign in again." }
  }

  let email: string
  try {
    const { payload } = await jwtVerify(pendingToken, SECRET)
    if (payload.userId !== userId) {
      return { success: false, error: "Invalid session." }
    }
    email = payload.email as string
  } catch {
    return { success: false, error: "Invalid session." }
  }

  const parsed = usernameSchema.safeParse(username)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { tablesDB } = createAdminClient()

  try {
    const existing = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: USERS_TABLE_ID,
      queries: [Query.equal("username", username), Query.limit(1)],
    })

    if (existing.total > 0) {
      return { success: false, error: "Username already taken" }
    }

    await tablesDB.createRow({
      databaseId: DB_ID,
      tableId: USERS_TABLE_ID,
      rowId: userId,
      data: {
        userId,
        username,
        email,
        tier: "free",
        totalPoints: 0,
        stripeCustomerId: "",
      },
      permissions: [
        Permission.read(Role.user(userId)),
        Permission.write(Role.user(userId)),
      ],
    })

    const token = await signToken({ userId, username, email, tier: "free" })
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    })
    cookieStore.delete(PENDING_COOKIE_NAME)

    return { success: true, userId }
  } catch (err) {
    if (err instanceof AppwriteException) {
      if (err.code === 409) return { success: false, error: "Username already taken" }
      return { success: false, error: err.message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

// ─── logout ────────────────────────────────────────────────────────────────────

export async function logout(): Promise<never> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
  redirect("/")
}
