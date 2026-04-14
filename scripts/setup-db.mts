/**
 * scripts/setup-db.mts
 *
 * Creates or updates the Appwrite database schema for the GAMERY platform.
 * Idempotent — safe to re-run; existing tables/columns are skipped.
 *
 * Usage:
 *   node --experimental-strip-types --no-warnings scripts/setup-db.mts
 *
 * Or via npm:
 *   npm run db:setup
 */

// Load .env.local before anything else
process.loadEnvFile(".env.local")

import {
  Client,
  TablesDB,
  ID,
  AppwriteException,
  TablesDBIndexType,
  OrderBy,
} from "node-appwrite"

// ─── Client ──────────────────────────────────────────────────────────────────

function createClient(): TablesDB {
  const required = [
    "NEXT_PUBLIC_APPWRITE_ENDPOINT",
    "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
    "APPWRITE_KEY",
  ]
  const missing = required.filter((k) => !process.env[k])
  if (missing.length) {
    console.error(`\n❌  Missing env vars: ${missing.join(", ")}`)
    console.error("    Fill in .env.local and re-run.\n")
    process.exit(1)
  }

  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_KEY!)

  return new TablesDB(client)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Skip if already exists (409), rethrow anything else. */
async function safe(label: string, fn: () => Promise<unknown>): Promise<unknown> {
  try {
    const result = await fn()
    console.log(`  ✓  ${label}`)
    return result
  } catch (err) {
    if (err instanceof AppwriteException && err.code === 409) {
      console.log(`  –  ${label} (already exists, skipped)`)
      return null
    }
    throw err
  }
}

// ─── Database ────────────────────────────────────────────────────────────────

async function ensureDatabase(db: TablesDB): Promise<string> {
  const envId = process.env.DATABASE_ID

  if (envId) {
    // Verify it exists
    try {
      await db.get({ databaseId: envId })
      console.log(`  –  Database "${envId}" (already exists, skipped)`)
      return envId
    } catch (err) {
      if (err instanceof AppwriteException && err.code === 404) {
        // Doesn't exist yet — create it with this ID
      } else {
        throw err
      }
    }
  }

  const databaseId = envId ?? ID.unique()
  await safe(`Database: gamery-db (${databaseId})`, () =>
    db.create({ databaseId, name: "gamery-db" })
  )

  if (!envId) {
    console.log(`\n  ⚠️  Add to .env.local:\n  DATABASE_ID=${databaseId}\n`)
  }

  return databaseId
}

// ─── Table helpers ───────────────────────────────────────────────────────────

type TableDef = {
  tableId: string
  name: string
  envKey: string
  columns: ColumnDef[]
  indexes: IndexDef[]
}

type ColumnDef =
  | { type: "varchar";   key: string; size: number;  required: boolean }
  | { type: "integer";   key: string;                required: boolean; min?: number; max?: number; xdefault?: number }
  | { type: "boolean";   key: string;                required: boolean; xdefault?: boolean }
  | { type: "datetime";  key: string;                required: boolean }

type IndexDef = {
  key: string
  type: TablesDBIndexType
  columns: string[]
  orders?: OrderBy[]
}

async function createTableWithSchema(
  db: TablesDB,
  databaseId: string,
  def: TableDef
): Promise<string> {
  const envId = process.env[def.envKey]
  const tableId = envId ?? def.tableId

  console.log(`\n  Table: ${def.name} (${tableId})`)

  // Create table
  await safe(`Table: ${def.name}`, () =>
    db.createTable({ databaseId, tableId, name: def.name })
  )

  // Create columns
  for (const col of def.columns) {
    const label = `  Column: ${col.key} (${col.type})`
    await safe(label, () => {
      if (col.type === "varchar") {
        return db.createVarcharColumn({
          databaseId,
          tableId,
          key: col.key,
          size: col.size,
          required: col.required,
        })
      }
      if (col.type === "integer") {
        return db.createIntegerColumn({
          databaseId,
          tableId,
          key: col.key,
          required: col.required,
          min: col.min,
          max: col.max,
          xdefault: col.xdefault,
        })
      }
      if (col.type === "boolean") {
        return db.createBooleanColumn({
          databaseId,
          tableId,
          key: col.key,
          required: col.required,
          xdefault: col.xdefault,
        })
      }
      if (col.type === "datetime") {
        return db.createDatetimeColumn({
          databaseId,
          tableId,
          key: col.key,
          required: col.required,
        })
      }
      throw new Error(`Unknown column type: ${(col as ColumnDef).type}`)
    })
  }

  // Create indexes
  for (const idx of def.indexes) {
    await safe(`  Index: ${idx.key} (${idx.type})`, () =>
      db.createIndex({
        databaseId,
        tableId,
        key: idx.key,
        type: idx.type,
        columns: idx.columns,
        orders: idx.orders ?? idx.columns.map(() => OrderBy.Asc),
      })
    )
  }

  if (!envId) {
    console.log(`\n  ⚠️  Add to .env.local:\n  ${def.envKey}=${tableId}\n`)
  }

  return tableId
}

// ─── Schema definitions ───────────────────────────────────────────────────────

const TABLES: TableDef[] = [
  // ── Users ──────────────────────────────────────────────────────────────────
  {
    tableId:   "users",
    name:      "users",
    envKey:    "USERS_TABLE_ID",
    columns: [
      { type: "varchar",  key: "userId",          size: 36,  required: true  },
      { type: "varchar",  key: "username",         size: 20,  required: true  },
      { type: "varchar",  key: "email",            size: 255, required: true  },
      { type: "varchar",  key: "tier",             size: 10,  required: true  }, // free | premium
      { type: "integer",  key: "totalPoints",                 required: true, min: 0 },
      { type: "varchar",  key: "stripeCustomerId", size: 64,  required: false },
    ],
    indexes: [
      { key: "idx_userId",    type: TablesDBIndexType.Unique, columns: ["userId"]    },
      { key: "idx_username",  type: TablesDBIndexType.Unique, columns: ["username"]  },
      { key: "idx_email",     type: TablesDBIndexType.Unique, columns: ["email"]     },
      { key: "idx_points",    type: TablesDBIndexType.Key,    columns: ["totalPoints"], orders: [OrderBy.Desc] },
    ],
  },

  // ── Matches ────────────────────────────────────────────────────────────────
  {
    tableId:   "matches",
    name:      "matches",
    envKey:    "MATCHES_TABLE_ID",
    columns: [
      { type: "varchar",  key: "matchId",    size: 64,  required: true  }, // PandaScore ID
      { type: "varchar",  key: "game",       size: 10,  required: true  }, // cs2 | lol
      { type: "varchar",  key: "teamA",      size: 100, required: true  },
      { type: "varchar",  key: "teamB",      size: 100, required: true  },
      { type: "datetime", key: "startTime",             required: true  },
      { type: "varchar",  key: "status",     size: 10,  required: true  }, // upcoming | live | finished
      { type: "varchar",  key: "winnerTeam", size: 100, required: false }, // null until finished
    ],
    indexes: [
      { key: "idx_matchId",   type: TablesDBIndexType.Unique, columns: ["matchId"]              },
      { key: "idx_status",    type: TablesDBIndexType.Key,    columns: ["status"]               },
      { key: "idx_game",      type: TablesDBIndexType.Key,    columns: ["game"]                 },
      { key: "idx_startTime", type: TablesDBIndexType.Key,    columns: ["startTime"], orders: [OrderBy.Asc] },
    ],
  },

  // ── Predictions ────────────────────────────────────────────────────────────
  {
    tableId:   "predictions",
    name:      "predictions",
    envKey:    "PREDICTIONS_TABLE_ID",
    columns: [
      { type: "varchar",  key: "userId",        size: 36,  required: true  },
      { type: "varchar",  key: "matchId",        size: 64,  required: true  },
      { type: "varchar",  key: "prediction",     size: 100, required: true  }, // team name picked
      { type: "boolean",  key: "isCorrect",                 required: false }, // null until match finishes
      { type: "integer",  key: "pointsAwarded",             required: true, min: 0 },
    ],
    indexes: [
      { key: "idx_userId",        type: TablesDBIndexType.Key,    columns: ["userId"]           },
      { key: "idx_matchId",       type: TablesDBIndexType.Key,    columns: ["matchId"]          },
      { key: "idx_user_match",    type: TablesDBIndexType.Unique, columns: ["userId", "matchId"] }, // one prediction per user per match
    ],
  },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🎮  GAMERY — Appwrite Schema Setup\n")

  const db = createClient()

  // 1. Database
  console.log("📦  Database")
  const databaseId = await ensureDatabase(db)

  // 2. Tables
  for (const def of TABLES) {
    await createTableWithSchema(db, databaseId, def)
  }

  console.log("\n✅  Schema setup complete!\n")
  console.log("If you saw ⚠️  messages above, copy the generated IDs into .env.local.\n")
}

main().catch((err) => {
  console.error("\n❌  Setup failed:", err.message ?? err)
  process.exit(1)
})
