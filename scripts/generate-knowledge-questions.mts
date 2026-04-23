/**
 * scripts/generate-knowledge-questions.mts
 *
 * Queries Gemini to generate yes/no knowledge questions per game.
 * Saves (and appends) results to data/knowledge-questions/{game}/questions.json
 *
 * Deduplication:
 *   - Reads any previously generated questions for the game before prompting.
 *   - Tells Gemini to avoid already-generated questions.
 *   - Appends only new questions to the JSON file (never overwrites existing ones).
 *
 * Model: gemini-3.1-flash-lite-preview (500 RPD free tier)
 *
 * Usage:
 *   node --experimental-strip-types --no-warnings scripts/generate-knowledge-questions.mts
 *
 * Or via npm:
 *   npm run knowledge:generate
 */

process.loadEnvFile(".env.local")

import { GoogleGenAI } from "@google/genai"
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs"
import { join } from "path"
import { randomUUID } from "crypto"

const MODEL = "gemini-3.1-flash-lite-preview"
const TARGET_TOTAL = 100 // desired question count per game

const GAMES = [
  {
    key: "counter-strike" as const,
    label: "Counter-Strike 2 (CS2)",
    context:
      "Weapons (AK-47, AWP, M4A4/M4A1-S, Desert Eagle, etc.), bomb sites (A/B), maps (Dust2, Mirage, Inferno, Nuke, Vertigo, Ancient, Anubis), economy system (buy rounds, eco rounds, force-buy), utility (smokes, flashes, molotovs/incendiaries, HE grenades), mechanics (spray control, movement, angles, defusing), pro scene history, CS:GO/CS2 Majors, legendary teams (Astralis, NaVi, Vitality, FaZe Clan, Team Liquid) and players (s1mple, ZywOo, device, sh1ro, NiKo).",
  },
  {
    key: "dota2" as const,
    label: "Dota 2",
    context:
      "Heroes (Pudge, Invoker, Tiny, Anti-Mage, Phantom Assassin, Earthshaker, Axe, etc.), items (Black King Bar, Blink Dagger, Daedalus, Aghanim's Scepter, etc.), game mechanics (creep denial, stacking, Roshan, Aegis of Immortal, bounty runes, outposts), roles (hard carry, support, offlaner/pos3, mid-laner, soft-support), draft phase (bans/picks, Captain's Mode), The International (TI) tournament history, legendary teams (OG, Team Secret, Evil Geniuses, Team Liquid) and players (Dendi, Miracle-, Puppey, N0tail, ana).",
  },
  {
    key: "valorant" as const,
    label: "Valorant",
    context:
      "Agents and their abilities (Jett, Sage, Reyna, Cypher, Sova, Killjoy, Omen, Fade, Harbor, etc.), weapon classes (Vandal, Phantom, Operator, Sheriff, Spectre, Odin, etc.), maps (Bind, Haven, Split, Ascent, Icebox, Breeze, Fracture, Pearl, Lotus, Sunset, Abyss), game mechanics (spike planting/defusing, buy phase, ultimate orbs, agent roles), VCT (Valorant Champions Tour) history, legendary teams (Sentinels, Team Liquid, NRG, Paper Rex, LOUD) and players (TenZ, Yay, Aspas, Leo, Derke).",
  },
] as const

type GameKey = "counter-strike" | "dota2" | "valorant"

interface KnowledgeQuestion {
  id: string
  game: GameKey
  questionText: string
  correctAnswer: boolean
  category: string
  difficulty: "easy" | "medium" | "hard"
  explanation: string
}

function loadExisting(filePath: string): KnowledgeQuestion[] {
  if (!existsSync(filePath)) return []
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as KnowledgeQuestion[]
  } catch {
    return []
  }
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim()
}

async function generateBatch(
  ai: GoogleGenAI,
  game: (typeof GAMES)[number],
  count: number,
  existingTexts: string[]
): Promise<KnowledgeQuestion[]> {
  const avoidSection =
    existingTexts.length > 0
      ? `\n\nDo NOT generate any of the following questions or anything extremely similar to them:\n${existingTexts
          .slice(0, 80) // keep prompt manageable
          .map((t, i) => `${i + 1}. ${t}`)
          .join("\n")}`
      : ""

  const prompt = `You are a professional esports quiz creator for ${game.label}.

Generate exactly ${count} yes/no trivia questions about ${game.label}.
Topic areas: ${game.context}

RULES:
1. Every question MUST be a clear YES or NO (true/false) question.
2. All facts must be accurate and verifiable — no speculation about current or future events.
3. Mix difficulty: roughly ${Math.round(count * 0.35)} easy, ${Math.round(count * 0.40)} medium, ${Math.round(count * 0.25)} hard.
4. Spread across categories: mechanics, weapons/agents/heroes, maps, economy/items, strategy, history, tournaments, players.
5. Do NOT ask about events after 2024.
6. Each question must be unambiguous — exactly one correct answer.
7. Explanation must be 1-2 sentences clarifying the correct answer.${avoidSection}

Return ONLY a JSON array of exactly ${count} objects. No markdown, no code blocks, no extra text.

Format:
[
  {
    "questionText": "Is the AWP able to one-shot a full-health armored player with a body shot in CS2?",
    "correctAnswer": false,
    "category": "weapons",
    "difficulty": "easy",
    "explanation": "The AWP only one-shots unarmored players in the chest; armored players survive a body shot."
  }
]`

  let responseText = ""
  let lastErr: unknown

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: { temperature: 0.85, maxOutputTokens: 16384 },
      })
      responseText = result.text ?? ""
      break
    } catch (err) {
      lastErr = err
      const msg = String(err)
      const retryMatch = msg.match(/retry.*?(\d+)s/i) || msg.match(/(\d+)s/i)
      const waitSec = retryMatch ? parseInt(retryMatch[1], 10) + 5 : 65

      if (attempt < 3) {
        console.log(`  ⚠️  Attempt ${attempt} failed. Waiting ${waitSec}s before retry...`)
        await new Promise((r) => setTimeout(r, waitSec * 1000))
      }
    }
  }

  if (!responseText) {
    throw lastErr ?? new Error("All attempts failed")
  }

  // Strip markdown fences if present
  const cleaned = responseText
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim()

  let raw: unknown
  try {
    raw = JSON.parse(cleaned)
  } catch {
    throw new Error(`JSON parse failed. Preview: ${cleaned.slice(0, 300)}`)
  }

  if (!Array.isArray(raw)) throw new Error(`Expected array, got ${typeof raw}`)

  const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"])

  return (raw as Record<string, unknown>[])
    .filter((item) => typeof item === "object" && item !== null)
    .map((item) => ({
      id: randomUUID(),
      game: game.key,
      questionText: String(item.questionText ?? "").trim(),
      correctAnswer: item.correctAnswer === true,
      category: String(item.category ?? "general").toLowerCase().trim(),
      difficulty: VALID_DIFFICULTIES.has(String(item.difficulty))
        ? (String(item.difficulty) as "easy" | "medium" | "hard")
        : "medium",
      explanation: String(item.explanation ?? "").trim(),
    }))
    .filter((q) => q.questionText.length > 15 && q.explanation.length > 10)
}

async function main() {
  const apiKey = process.env.GEMINI_KEY
  if (!apiKey) {
    console.error("\n❌  Missing GEMINI_KEY in .env.local\n")
    process.exit(1)
  }

  const ai = new GoogleGenAI({ apiKey })
  const outputBase = join(process.cwd(), "data", "knowledge-questions")

  console.log(`\n🎮  Generating Knowledge Questions  (model: ${MODEL})\n`)

  for (const game of GAMES) {
    const outputDir = join(outputBase, game.key)
    mkdirSync(outputDir, { recursive: true })
    const filePath = join(outputDir, "questions.json")

    const existing = loadExisting(filePath)
    const existingTexts = existing.map((q) => q.questionText)
    const existingNorm = new Set(existingTexts.map(normalizeText))

    const needed = TARGET_TOTAL - existing.length
    if (needed <= 0) {
      console.log(`✅  ${game.label}: already has ${existing.length} questions, skipping.`)
      continue
    }

    console.log(
      `⏳  ${game.label}: ${existing.length} existing, generating ${needed} more...`
    )

    let newQuestions: KnowledgeQuestion[] = []
    try {
      newQuestions = await generateBatch(ai, game, needed, existingTexts)
    } catch (err) {
      console.error(`  ❌  Failed: ${err instanceof Error ? err.message : err}`)
      continue
    }

    // Deduplicate against existing questions
    const deduped = newQuestions.filter(
      (q) => !existingNorm.has(normalizeText(q.questionText))
    )
    const skipped = newQuestions.length - deduped.length
    if (skipped > 0) console.log(`  ⚠️  Skipped ${skipped} duplicate(s) returned by Gemini`)

    const combined = [...existing, ...deduped]
    writeFileSync(filePath, JSON.stringify(combined, null, 2), "utf8")

    console.log(
      `  ✓  ${deduped.length} new questions saved → ${filePath}  (total: ${combined.length})`
    )

    // Pause between games to stay within free-tier RPM limits
    if (game !== GAMES[GAMES.length - 1]) {
      console.log("  ⏸  Waiting 5s before next game...")
      await new Promise((r) => setTimeout(r, 5000))
    }
  }

  console.log(
    "\n✅  Done! Review data/knowledge-questions/ then run: npm run knowledge:submit\n"
  )
}

main().catch((err) => {
  console.error("\n❌  Generation failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
