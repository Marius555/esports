import { SignJWT, jwtVerify } from "jose"

export interface SessionPayload {
  userId: string
  username: string
  email: string
  tier: "free" | "pro" | "max"
}

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)
const ALG = "HS256"

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET)
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export const COOKIE_NAME    = "esports_session"
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
