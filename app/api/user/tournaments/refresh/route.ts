import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
  createAdminClient,
  DB_ID,
  QUESTIONS_TABLE_ID,
  USER_ANSWERS_TABLE_ID,
  Query,
  AppwriteException,
} from "@/lib/appwrite";
import { pandaMatchById, type PandaMatch } from "@/lib/pandascore";
import type { Question } from "@/app/api/tournament/[game]/route";

interface UserAnswer {
  $id: string;
  userId: string;
  questionId: string;
  tournamentId: string;
  answer: boolean;
}

// PandaScore-backed games only — LoL uses a different API with incompatible IDs
const PANDA_GAMES = new Set(["dota2", "counterstrike"]);

/**
 * Attempt to resolve a match-referencing question from PandaScore data.
 * Handles three families:
 *   1. Winner  — "Will X defeat/beat Y?"
 *   2. Sweep   — "Will X win without dropping / clean sweep / 2-0 / 3-0?"
 *   3. Deciding game — "Will X vs Y go to a deciding game/map / full distance?"
 * Returns true/false if resolvable, null otherwise.
 */
function resolveMatchQuestion(
  questionText: string,
  match: PandaMatch
): boolean | null {
  if (match.status !== "finished") return null;

  // Derive series scores from results array
  const scores = match.results.map((r) => r.score);
  const minScore = scores.length >= 2 ? Math.min(...scores) : null;

  // ── Sweep / "without dropping" ────────────────────────────────────────────
  const isSweepQuestion =
    /clean sweep|won.?t drop|without dropping|without losing a (game|map|match)|2-0|3-0/i.test(
      questionText
    );

  if (isSweepQuestion) {
    if (minScore === null || !match.winner_id) return null;
    // Extract the team expected to sweep
    const m = questionText.match(/Will (.+?) (?:win|sweep|defeat|beat)/i);
    if (!m) return minScore === 0; // no team name: just report whether a sweep happened
    const expectedTeam = m[1].trim().toLowerCase();
    const winner = match.opponents.find(
      (o) => o.opponent.id === match.winner_id
    );
    if (!winner) return null;
    const actualWinner = winner.opponent.name.toLowerCase();
    const expectedWon =
      actualWinner.includes(expectedTeam) ||
      expectedTeam.includes(actualWinner);
    return expectedWon && minScore === 0;
  }

  // ── Deciding / full-distance game ─────────────────────────────────────────
  const isDecidingQuestion =
    /deciding (game|map|match)|go (the )?full (distance|[0-9])|full (three|five|3|5) (game|map)|go to (game|map) [35]|series (goes?|went) (to )?(game|map) [35]|(game|map) [35]$/i.test(
      questionText
    );

  if (isDecidingQuestion) {
    if (minScore === null) return null;
    return minScore > 0; // both teams won at least one game
  }

  // ── Winner ────────────────────────────────────────────────────────────────
  if (!match.winner_id) return null;
  const m = questionText.match(/Will (.+?) (?:defeat|beat)\s/i);
  if (!m) return null;

  const expectedWinner = m[1].trim().toLowerCase();
  const winner = match.opponents.find(
    (o) => o.opponent.id === match.winner_id
  );
  if (!winner) return null;

  const actualWinner = winner.opponent.name.toLowerCase();
  return (
    actualWinner.includes(expectedWinner) ||
    expectedWinner.includes(actualWinner)
  );
}

export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get("esports_session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifyToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tablesDB } = createAdminClient();

  // Get all user answers to find their tournamentIds
  const answersRes = await tablesDB.listRows({
    databaseId: DB_ID,
    tableId: USER_ANSWERS_TABLE_ID,
    queries: [Query.equal("userId", session.userId), Query.limit(500)],
  });

  const answers = answersRes.rows as unknown as UserAnswer[];
  if (answers.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  const tournamentIds = [...new Set(answers.map((a) => a.tournamentId))];

  // Fetch all unresolved questions across all user tournaments
  const allUnresolved: Question[] = [];
  for (const tid of tournamentIds) {
    const res = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: QUESTIONS_TABLE_ID,
      queries: [
        Query.equal("tournamentId", tid),
        Query.isNull("correctAnswer"),
        Query.limit(50),
      ],
    });
    allUnresolved.push(...(res.rows as unknown as Question[]));
  }

  // Handle "match"-type questions for PandaScore games
  // (winner questions, sweep questions, deciding-game questions all use referenceType="match")
  const resolvable = allUnresolved.filter(
    (q) => q.referenceType === "match" && PANDA_GAMES.has(q.game)
  );

  let updated = 0;

  await Promise.all(
    resolvable.map(async (question) => {
      try {
        const match = await pandaMatchById(question.referenceId);
        if (!match) return;

        const correctAnswer = resolveMatchQuestion(
          question.questionText,
          match
        );
        if (correctAnswer === null) return;

        await (
          tablesDB as unknown as {
            updateRow: (args: {
              databaseId: string;
              tableId: string;
              rowId: string;
              data: Record<string, unknown>;
            }) => Promise<unknown>;
          }
        ).updateRow({
          databaseId: DB_ID,
          tableId: QUESTIONS_TABLE_ID,
          rowId: question.$id,
          data: { correctAnswer },
        });

        updated++;
      } catch (err) {
        if (!(err instanceof AppwriteException)) {
          console.error(`Failed to resolve question ${question.$id}:`, err);
        }
      }
    })
  );

  return NextResponse.json({ updated });
}
