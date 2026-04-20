import {
  Client,
  Account,
  TablesDB,
  Users,
  ID,
  Query,
  Permission,
  Role,
  AppwriteException,
  OAuthProvider,
  type Models,
} from "node-appwrite"

export function createAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_KEY!)

  return {
    account: new Account(client),
    tablesDB: new TablesDB(client),
    users: new Users(client),
  }
}

export interface UserRow {
  $id: string
  userId: string
  username: string
  email: string
  tier: "free" | "pro" | "max"
  totalPoints: number
  stripeCustomerId: string
}

export const DB_ID                 = process.env.DATABASE_ID!
export const USERS_TABLE_ID        = process.env.USERS_TABLE_ID!
export const MATCHES_TABLE_ID      = process.env.MATCHES_TABLE_ID!
export const PREDICTIONS_TABLE_ID  = process.env.PREDICTIONS_TABLE_ID!
export const QUESTIONS_TABLE_ID    = process.env.QUESTIONS_TABLE_ID!
export const USER_ANSWERS_TABLE_ID = process.env.USER_ANSWERS_TABLE_ID!

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isTransient =
        err instanceof AppwriteException && (err.code === 503 || err.code === 429 || err.code === 0);
      if (!isTransient) throw err;
      await new Promise((r) => setTimeout(r, delayMs * 2 ** i));
    }
  }
  throw lastError;
}

export { ID, Query, Permission, Role, AppwriteException, OAuthProvider }
export type { Models }
