/**
 * scripts/submit-knowledge-questions.mts
 *
 * Reads JSON files from data/knowledge-questions/{game}/questions.json
 * and uploads them to the Appwrite knowledge_questions collection.
 *
 * Deduplication:
 *   - Before uploading each game, fetches all existing question texts from Appwrite.
 *   - Skips any question whose normalized text already exists in the collection.
 *
 * Run AFTER:
 *   npm run db:setup           (creates the knowledge_questions table)
 *   npm run knowledge:generate (generates the JSON files)
 *
 * Usage:
 *   node --experimental-strip-types --no-warnings scripts/submit-knowledge-questions.mts
 *
 * Or via npm:
 *   npm run knowledge:submit
 */

process.loadEnvFile(".env.local")

import { Client, TablesDB, ID, AppwriteException, Query } from "node-appwrite"
import { readFileSync, readdirSync, existsSync } from "fs"
import { join } from "path"

interface KnowledgeQuestion {
  id: string
  game: string
  questionText: string
  correctAnswer: boolean
  category: string
  difficulty: string
  explanation: string
}

interface AppwriteKQRow {
  $id: string
  game: string
  questionText: string
}

function createClient(): TablesDB {
  const required = [
    "NEXT_PUBLIC_APPWRITE_ENDPOINT",
    "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
    "APPWRITE_KEY",
    "DATABASE_ID",
    "KNOWLEDGE_QUESTIONS_TABLE_ID",
  ]
  const missing = required.filter((k) => !process.env[k])
  if (missing.length) {
    console.error(`\n❌  Missing env vars: ${missing.join(", ")}\n`)
    process.exit(1)
  }

  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_KEY!)
  return new TablesDB(client)
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim()
}

/** Fetch all existing question texts for a game from Appwrite (paginates automatically). */
async function fetchExistingTexts(
  db: TablesDB,
  databaseId: string,
  tableId: string,
  game: string
): Promise<Set<string>> {
  const texts = new Set<string>()
  const pageSize = 100
  let offset = 0

  while (true) {
    const page = await db.listRows({
      databaseId,
      tableId,
      queries: [
        Query.equal("game", game),
        Query.limit(pageSize),
        Query.offset(offset),
      ],
    }).catch(() => null)

    if (!page || page.rows.length === 0) break

    for (const row of page.rows as unknown as AppwriteKQRow[]) {
      texts.add(normalize(row.questionText))
    }

    if (page.rows.length < pageSize) break
    offset += pageSize
  }

  return texts
}

async function main() {
  const db = createClient()
  const databaseId = process.env.DATABASE_ID!
  const tableId = process.env.KNOWLEDGE_QUESTIONS_TABLE_ID!
  const dataDir = join(process.cwd(), "data", "knowledge-questions")

  if (!existsSync(dataDir)) {
    console.error(
      "\n❌  data/knowledge-questions/ not found. Run `npm run knowledge:generate` first.\n"
    )
    process.exit(1)
  }

  const games = readdirSync(dataDir).filter((g) => {
    const dir = join(dataDir, g)
    return existsSync(dir) && readdirSync(dir).some((f) => /^questions(-\d+)?\.json$/.test(f))
  })

  if (games.length === 0) {
    console.error("❌  No questions.json files found. Run `npm run knowledge:generate` first.")
    process.exit(1)
  }

  console.log("\n🎮  Uploading Knowledge Questions to Appwrite\n")

  let totalSubmitted = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (const game of games) {
    const gameDir = join(dataDir, game)
    const questions: KnowledgeQuestion[] = readdirSync(gameDir)
      .filter((f) => /^questions(-\d+)?\.json$/.test(f))
      .flatMap((f) => {
        try {
          const data = JSON.parse(readFileSync(join(gameDir, f), "utf8"))
          return Array.isArray(data) ? (data as KnowledgeQuestion[]) : []
        } catch {
          return []
        }
      })

    console.log(`\n📂  ${game}  (${questions.length} local questions)`)
    console.log("  🔍  Checking Appwrite for duplicates...")

    // Map "counter-strike" → "counter-strike" (key used as game field in JSON)
    const existingTexts = await fetchExistingTexts(db, databaseId, tableId, questions[0]?.game ?? game)
    console.log(`  –  ${existingTexts.size} already exist in Appwrite`)

    const toSubmit = questions.filter(
      (q) => !existingTexts.has(normalize(q.questionText))
    )
    const alreadyExist = questions.length - toSubmit.length

    if (alreadyExist > 0) {
      console.log(`  –  Skipping ${alreadyExist} duplicate(s)`)
      totalSkipped += alreadyExist
    }

    if (toSubmit.length === 0) {
      console.log("  ✓  Nothing new to upload for this game.")
      continue
    }

    console.log(`  ⬆  Uploading ${toSubmit.length} new questions...`)

    for (const q of toSubmit) {
      try {
        await db.createRow({
          databaseId,
          tableId,
          rowId: ID.unique(),
          data: {
            game: q.game,
            questionText: q.questionText.slice(0, 500),
            correctAnswer: q.correctAnswer,
            category: q.category.slice(0, 50),
            difficulty: q.difficulty.slice(0, 10),
            explanation: q.explanation.slice(0, 500),
          },
        })
        totalSubmitted++
        process.stdout.write(".")
      } catch (err) {
        if (err instanceof AppwriteException && err.code === 409) {
          // Race condition duplicate — treat as skipped
          totalSkipped++
          process.stdout.write("-")
        } else {
          totalFailed++
          process.stdout.write("✗")
          if (totalFailed <= 3) {
            console.error(
              `\n  ❌  "${q.questionText.slice(0, 50)}...": ${
                err instanceof Error ? err.message : err
              }`
            )
          }
        }
      }

      // Stay within Appwrite rate limits
      await new Promise((r) => setTimeout(r, 80))
    }

    console.log()
  }

  console.log(`\n✅  Done!`)
  console.log(`   Submitted : ${totalSubmitted}`)
  console.log(`   Skipped   : ${totalSkipped} (already existed)`)
  if (totalFailed > 0) console.log(`   Failed    : ${totalFailed}`)
  console.log()
}

main().catch((err) => {
  console.error("\n❌  Upload failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
