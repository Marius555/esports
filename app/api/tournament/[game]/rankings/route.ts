import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
  createAdminClient,
  DB_ID,
  QUESTIONS_TABLE_ID,
  USER_ANSWERS_TABLE_ID,
  USERS_TABLE_ID,
  USER_ROUND_ASSIGNMENTS_TABLE_ID,
  KNOWLEDGE_QUESTIONS_TABLE_ID,
  Query,
  withRetry,
  type UserRow,
} from "@/lib/appwrite";
import type { Question, UserRoundAssignment } from "@/app/api/tournament/[game]/route";

interface KnowledgeQuestionRow {
  $id: string;
  correctAnswer: boolean;
}

interface UserAnswer {
  $id: string;
  userId: string;
  questionId: string;
  tournamentId: string;
  answer: boolean;
  timeTaken: number | null;
  roundNumber: number | null;
}

export interface RankingEntry {
  rank: number;
  userId: string;
  displayName: string;
  correctAnswers: number;
  totalAnswers: number;
  pending: number;
  totalTimeTakenMs: number;
  roundsCompleted: number;
}

export interface RankingsResponse {
  tournamentId: string | null;
  resolveBy: string;
  resolved: boolean;
  rankings: RankingEntry[];
}

const VALID_GAMES = new Set(["dota2", "valorant", "counterstrike"]);

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || !local) return "***";
  return `${local[0]}***@${domain}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ game: string }> }
): Promise<NextResponse> {
  const { game } = await params;
  if (!VALID_GAMES.has(game)) {
    return NextResponse.json({ error: "Invalid game" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("esports_session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifyToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tablesDB } = createAdminClient();

  // Get the latest tournament for this game.
  // Primary: questions table (anchor row or esports questions).
  // Fallback: user's own round assignments (handles skill-only tournaments).
  let latestTournamentId: string | null = null;
  let latestResolveBy = "";

  const latestQ = await withRetry(() =>
    tablesDB.listRows({
      databaseId: DB_ID,
      tableId: QUESTIONS_TABLE_ID,
      queries: [
        Query.equal("game", game),
        Query.orderDesc("resolveBy"),
        Query.limit(1),
      ],
    })
  ).catch(() => null);

  if (latestQ && latestQ.total > 0) {
    latestTournamentId = (latestQ.rows[0] as unknown as Question).tournamentId;
    latestResolveBy    = (latestQ.rows[0] as unknown as Question).resolveBy;
  } else {
    // Fallback: check the current user's own assignments for a game-prefixed tournament
    const userAssignmentsRes = await withRetry(() =>
      tablesDB.listRows({
        databaseId: DB_ID,
        tableId: USER_ROUND_ASSIGNMENTS_TABLE_ID,
        queries: [
          Query.equal("userId", session.userId),
          Query.orderDesc("startedAt"),
          Query.limit(100),
        ],
      })
    ).catch(() => null);

    if (userAssignmentsRes && userAssignmentsRes.total > 0) {
      const gameAssignment = (userAssignmentsRes.rows as unknown as UserRoundAssignment[])
        .filter((a) => a.tournamentId.startsWith(game + "-"))
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

      if (gameAssignment) {
        latestTournamentId = gameAssignment.tournamentId;
        // Approximate end date from the ID's embedded date
        const dateStr = gameAssignment.tournamentId.slice(-10);
        try {
          const start = new Date(dateStr + "T00:00:00.000Z");
          latestResolveBy = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        } catch {
          latestResolveBy = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        }
      }
    }
  }

  if (!latestTournamentId) {
    return NextResponse.json({
      tournamentId: null,
      resolveBy: "",
      resolved: false,
      rankings: [],
    } satisfies RankingsResponse);
  }

  const resolved = new Date(latestResolveBy) < new Date();

  // Fetch all esports questions for this tournament (to resolve correctAnswer)
  const questionsRes = await withRetry(() =>
    tablesDB.listRows({
      databaseId: DB_ID,
      tableId: QUESTIONS_TABLE_ID,
      queries: [
        Query.equal("tournamentId", latestTournamentId),
        Query.limit(500),
      ],
    })
  ).catch(() => null);

  const questions = (questionsRes?.rows ?? []) as unknown as Question[];
  // Start with esports questions (in the questions table)
  const correctAnswerMap = new Map<string, boolean | null | undefined>(
    questions.map((q) => [q.$id, q.correctAnswer])
  );

  // Also need correctAnswers for skill round questions (from knowledge_questions table).
  // These answers have questionId = knowledge_question $id, which won't be in the map above.
  // We fetch them lazily once we know which IDs are missing.
  const fetchKnowledgeCorrectAnswers = async (ids: string[]) => {
    if (ids.length === 0) return;
    const kqRes = await withRetry(() =>
      tablesDB.listRows({
        databaseId: DB_ID,
        tableId: KNOWLEDGE_QUESTIONS_TABLE_ID,
        queries: [Query.equal("$id", ids), Query.limit(ids.length + 5)],
      })
    ).catch(() => null);
    if (!kqRes) return;
    for (const row of kqRes.rows as unknown as KnowledgeQuestionRow[]) {
      correctAnswerMap.set(row.$id, row.correctAnswer);
    }
  };

  // Fetch all answers for this tournament
  const answersRes = await withRetry(() =>
    tablesDB.listRows({
      databaseId: DB_ID,
      tableId: USER_ANSWERS_TABLE_ID,
      queries: [Query.equal("tournamentId", latestTournamentId), Query.limit(5000)],
    })
  ).catch(() => null);

  if (!answersRes || answersRes.total === 0) {
    return NextResponse.json({
      tournamentId: latestTournamentId,
      resolveBy: latestResolveBy,
      resolved,
      rankings: [],
    } satisfies RankingsResponse);
  }

  const answers = answersRes.rows as unknown as UserAnswer[];

  // Find questionIds not in the correctAnswerMap (= skill round knowledge question IDs)
  const unknownIds = [...new Set(answers.map((a) => a.questionId).filter((id) => !correctAnswerMap.has(id)))];
  await fetchKnowledgeCorrectAnswers(unknownIds);

  // Fetch round completion counts per user
  const assignmentsRes = await withRetry(() =>
    tablesDB.listRows({
      databaseId: DB_ID,
      tableId: USER_ROUND_ASSIGNMENTS_TABLE_ID,
      queries: [
        Query.equal("tournamentId", latestTournamentId),
        Query.limit(5000),
      ],
    })
  ).catch(() => null);

  const roundsCompletedMap = new Map<string, number>();
  if (assignmentsRes) {
    for (const row of assignmentsRes.rows as unknown as UserRoundAssignment[]) {
      if (row.completedAt) {
        roundsCompletedMap.set(row.userId, (roundsCompletedMap.get(row.userId) ?? 0) + 1);
      }
    }
  }

  // Calculate scores per user
  // For skill round answers: questionId is a knowledge_question $id, correctAnswer is on the Question obj
  // For esports round answers: questionId is in the questions table
  const userScores = new Map<
    string,
    { correctAnswers: number; totalAnswers: number; pending: number; totalTimeTakenMs: number }
  >();

  for (const answer of answers) {
    const existing = userScores.get(answer.userId) ?? {
      correctAnswers: 0,
      totalAnswers: 0,
      pending: 0,
      totalTimeTakenMs: 0,
    };
    const correctAnswer = correctAnswerMap.get(answer.questionId);
    if (correctAnswer === null || correctAnswer === undefined) {
      existing.pending++;
    } else if (answer.answer === correctAnswer) {
      existing.correctAnswers++;
    }
    existing.totalAnswers++;
    existing.totalTimeTakenMs += answer.timeTaken ?? 0;
    userScores.set(answer.userId, existing);
  }

  const userIds = Array.from(userScores.keys());

  const usersRes = await withRetry(() =>
    tablesDB.listRows({
      databaseId: DB_ID,
      tableId: USERS_TABLE_ID,
      queries: [
        Query.equal("userId", userIds),
        Query.limit(userIds.length + 10),
      ],
    })
  ).catch(() => null);

  const userMap = new Map<string, UserRow>();
  if (usersRes) {
    for (const row of usersRes.rows as unknown as UserRow[]) {
      userMap.set(row.userId, row);
    }
  }

  const entries = userIds.map((uid) => {
    const scores = userScores.get(uid)!;
    const user = userMap.get(uid);
    const displayName =
      user?.username?.trim()
        ? user.username
        : user?.email
        ? maskEmail(user.email)
        : `Player ${uid.slice(0, 6)}`;
    return {
      userId: uid,
      displayName,
      roundsCompleted: roundsCompletedMap.get(uid) ?? 0,
      ...scores,
    };
  });

  entries.sort((a, b) => {
    if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
    if (a.totalTimeTakenMs !== b.totalTimeTakenMs) return a.totalTimeTakenMs - b.totalTimeTakenMs;
    return b.totalAnswers - a.totalAnswers;
  });

  const rankings: RankingEntry[] = [];
  let rank = 1;
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].correctAnswers < entries[i - 1].correctAnswers) {
      rank = i + 1;
    }
    rankings.push({ rank, ...entries[i] });
  }

  return NextResponse.json({
    tournamentId: latestTournamentId,
    resolveBy: latestResolveBy,
    resolved,
    rankings,
  } satisfies RankingsResponse);
}
