import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/lib/auth";
import {
  createAdminClient,
  DB_ID,
  QUESTIONS_TABLE_ID,
  USER_ANSWERS_TABLE_ID,
  USERS_TABLE_ID,
  USER_ROUND_ASSIGNMENTS_TABLE_ID,
  KNOWLEDGE_QUESTIONS_TABLE_ID,
  WINNERS_TABLE_ID,
  ID,
  Query,
  withRetry,
  AppwriteException,
  type UserRow,
} from "@/lib/appwrite";
import type { Question, UserRoundAssignment } from "@/app/api/tournament/[game]/route";

const PRIZES = ["€25", "€15", "€10"];

const BodySchema = z.object({
  tournamentId: z.string().min(1).max(100),
});

interface UserAnswer {
  userId: string;
  questionId: string;
  answer: boolean;
  timeTaken: number | null;
}

interface KnowledgeQuestionRow {
  $id: string;
  correctAnswer: boolean;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get("esports_session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifyToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { tournamentId } = parsed.data;
  const { tablesDB } = createAdminClient();

  // Verify tournament has actually ended
  const questionsRes = await withRetry(() =>
    tablesDB.listRows({
      databaseId: DB_ID,
      tableId: QUESTIONS_TABLE_ID,
      queries: [Query.equal("tournamentId", tournamentId), Query.limit(1)],
    })
  ).catch(() => null);

  if (!questionsRes || questionsRes.total === 0) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  const firstQ = questionsRes.rows[0] as unknown as Question;
  if (new Date(firstQ.resolveBy) > new Date()) {
    return NextResponse.json({ error: "Tournament has not ended yet" }, { status: 400 });
  }

  const game = firstQ.game;

  // Check if winners already saved
  const existingWinners = await tablesDB.listRows({
    databaseId: DB_ID,
    tableId: WINNERS_TABLE_ID,
    queries: [Query.equal("tournamentId", tournamentId), Query.limit(1)],
  }).catch(() => null);

  if (existingWinners && existingWinners.total > 0) {
    return NextResponse.json({ message: "Already finalized", winners: existingWinners.rows });
  }

  // Fetch all esports questions
  const allQRes = await withRetry(() =>
    tablesDB.listRows({
      databaseId: DB_ID,
      tableId: QUESTIONS_TABLE_ID,
      queries: [Query.equal("tournamentId", tournamentId), Query.limit(500)],
    })
  ).catch(() => null);

  const allQuestions = (allQRes?.rows ?? []) as unknown as Question[];
  const correctAnswerMap = new Map<string, boolean | null | undefined>(
    allQuestions.map((q) => [q.$id, q.correctAnswer])
  );

  // Fetch all answers
  const answersRes = await withRetry(() =>
    tablesDB.listRows({
      databaseId: DB_ID,
      tableId: USER_ANSWERS_TABLE_ID,
      queries: [Query.equal("tournamentId", tournamentId), Query.limit(10000)],
    })
  ).catch(() => null);

  const answers = (answersRes?.rows ?? []) as unknown as UserAnswer[];

  // Fetch knowledge question correctAnswers for skill round answers
  const unknownIds = [...new Set(answers.map((a) => a.questionId).filter((id) => !correctAnswerMap.has(id)))];
  if (unknownIds.length > 0) {
    const kqRes = await withRetry(() =>
      tablesDB.listRows({
        databaseId: DB_ID,
        tableId: KNOWLEDGE_QUESTIONS_TABLE_ID,
        queries: [Query.equal("$id", unknownIds), Query.limit(unknownIds.length + 5)],
      })
    ).catch(() => null);
    if (kqRes) {
      for (const row of kqRes.rows as unknown as KnowledgeQuestionRow[]) {
        correctAnswerMap.set(row.$id, row.correctAnswer);
      }
    }
  }

  // Fetch rounds completed per user
  const assignmentsRes = await withRetry(() =>
    tablesDB.listRows({
      databaseId: DB_ID,
      tableId: USER_ROUND_ASSIGNMENTS_TABLE_ID,
      queries: [Query.equal("tournamentId", tournamentId), Query.limit(5000)],
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

  // Calculate scores
  const userScores = new Map<string, { correctAnswers: number; totalAnswers: number; totalTimeTakenMs: number }>();
  for (const answer of answers) {
    const existing = userScores.get(answer.userId) ?? { correctAnswers: 0, totalAnswers: 0, totalTimeTakenMs: 0 };
    const correctAnswer = correctAnswerMap.get(answer.questionId);
    if (correctAnswer !== null && correctAnswer !== undefined && answer.answer === correctAnswer) {
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
      queries: [Query.equal("userId", userIds), Query.limit(userIds.length + 10)],
    })
  ).catch(() => null);

  const userMap = new Map<string, UserRow>();
  if (usersRes) {
    for (const row of usersRes.rows as unknown as UserRow[]) {
      userMap.set(row.userId, row);
    }
  }

  const entries = userIds.map((uid) => ({
    userId: uid,
    username: userMap.get(uid)?.username ?? `Player ${uid.slice(0, 6)}`,
    roundsCompleted: roundsCompletedMap.get(uid) ?? 0,
    ...userScores.get(uid)!,
  }));

  entries.sort((a, b) => {
    if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
    if (a.totalTimeTakenMs !== b.totalTimeTakenMs) return a.totalTimeTakenMs - b.totalTimeTakenMs;
    return b.totalAnswers - a.totalAnswers;
  });

  const resolvedAt = new Date().toISOString();

  // Save winners
  const savedWinners = await Promise.allSettled(
    entries.map((entry, i) =>
      tablesDB.createRow({
        databaseId: DB_ID,
        tableId: WINNERS_TABLE_ID,
        rowId: ID.unique(),
        data: {
          tournamentId,
          userId: entry.userId,
          username: entry.username,
          game,
          rank: i + 1,
          correctAnswers: entry.correctAnswers,
          totalAnswers: entry.totalAnswers,
          totalTimeTakenMs: entry.totalTimeTakenMs,
          prize: PRIZES[i] ?? "",
          resolvedAt,
          roundsCompleted: entry.roundsCompleted,
        },
      })
    )
  );

  const saved = savedWinners.filter((r) => r.status === "fulfilled").length;
  savedWinners.forEach((r) => {
    if (r.status === "rejected" && !(r.reason instanceof AppwriteException && r.reason.code === 409)) {
      console.error("Failed to save winner:", r.reason);
    }
  });

  return NextResponse.json({
    success: true,
    saved,
    topThree: entries.slice(0, 3).map((e, i) => ({
      rank: i + 1,
      username: e.username,
      correctAnswers: e.correctAnswers,
      prize: PRIZES[i] ?? "",
    })),
  });
}
