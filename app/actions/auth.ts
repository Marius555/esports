"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import {
  createAdminClient,
  DB_ID,
  USERS_TABLE_ID,
  ID,
  Query,
  Permission,
  Role,
  AppwriteException,
  type UserRow,
} from "@/lib/appwrite"
import { signToken, COOKIE_NAME, COOKIE_MAX_AGE } from "@/lib/auth"

type ActionResult = { success: boolean; error?: string }

// ─── Zod Schemas ───────────────────────────────────────────────────────────────

const signUpSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

// ─── signUp ────────────────────────────────────────────────────────────────────

export async function signUp(fd: FormData): Promise<ActionResult> {
  const raw = {
    username: fd.get("username") as string,
    email: fd.get("email") as string,
    password: fd.get("password") as string,
  }

  const parsed = signUpSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { success: false, error: first.message }
  }

  const { username, email, password } = parsed.data

  try {
    const { account, tablesDB } = createAdminClient()
    const userId = ID.unique()

    await account.create({ userId, email, password, name: username })

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

    return { success: true }
  } catch (err) {
    if (err instanceof AppwriteException) {
      if (err.code === 409) return { success: false, error: "Email already registered" }
      return { success: false, error: err.message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }
}

// ─── login ─────────────────────────────────────────────────────────────────────

export async function login(fd: FormData): Promise<ActionResult> {
  const raw = {
    email: fd.get("email") as string,
    password: fd.get("password") as string,
  }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { success: false, error: first.message }
  }

  const { email, password } = parsed.data

  let redirectPath = "/dashboard"

  try {
    const { account, tablesDB } = createAdminClient()

    const session = await account.createEmailPasswordSession({ email, password })

    const rows = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: USERS_TABLE_ID,
      queries: [Query.equal("userId", session.userId), Query.limit(1)],
    })

    if (rows.total === 0) {
      return { success: false, error: "User profile not found" }
    }

    const userRow = rows.rows[0] as unknown as UserRow

    const token = await signToken({
      userId: userRow.userId,
      username: userRow.username,
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
  } catch (err) {
    if (err instanceof AppwriteException) {
      if (err.code === 401) return { success: false, error: "Invalid email or password" }
      return { success: false, error: err.message }
    }
    return { success: false, error: "An unexpected error occurred" }
  }

  redirect(redirectPath)
}

// ─── logout ────────────────────────────────────────────────────────────────────

export async function logout(): Promise<never> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
  redirect("/login")
}
