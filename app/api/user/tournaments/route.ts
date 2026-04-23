import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
  createAdminClient,
  DB_ID,
  QUESTIONS_TABLE_ID,
  USER_ANSWERS_TABLE_ID,
  KNOWLEDGE_QUESTIONS_TABLE_ID,
  USER_ROUND_ASSIGNMENTS_TABLE_ID,
  Query,
  withRetry,
} from "@/lib/appwrite";
import type { Question } from "@/app/api/tournament/[game]/route";

interface UserAnswer {
  $id: string;
  userId: string;
  questionId: string;
  tournamentId: string;
  answer: boolean;
  roundNumber: number | null;
}

interface RoundAssignment {
  $id: string;
  userId: string;
  tournamentId: string;
  roundNumber: number;
  roundType: string;
  completedAt: string | null;
}

export interface TournamentSummary {
  tournamentId: string;
  game: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  pending: number;
  resolveBy: string;
  roundsCompleted: number;
}

export async function GET(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get("esports_session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifyToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tablesDB } = createAdminClient();

  try {
    // Fetch all user answers
    const answersRes = await withRetry(() =>
      tablesDB.listRows({
        databaseId: DB_ID,
        tableId: USER_ANSWERS_TABLE_ID,
        queries: [Query.equal("userId", session.userId), Query.limit(500)],
      })
    );

    const answers = answersRes.rows as unknown as UserAnswer[];
    if (answers.length === 0) {
      return NextResponse.json({ tournaments: [] });
    }

    const tournamentIds = [...new Set(answers.map((a) => a.tournamentId))];

    const summaries = await Promise.all(
      tournamentIds.map(async (tournamentId): Promise<TournamentSummary> => {
        const tournamentAnswers = answers.filter((a) => a.tournamentId === tournamentId);

        // Fetch esports questions (in questions table)
        const questionsRes = await withRetry(() =>
          tablesDB.listRows({
            databaseId: DB_ID,
            tableId: QUESTIONS_TABLE_ID,
            queries: [Query.equal("tournamentId", tournamentId), Query.limit(200)],
          })
        ).catch(() => null);

        const questions = (questionsRes?.rows ?? []) as unknown as Question[];
        const correctAnswerMap = new Map<string, boolean | null | undefined>(
          questions.map((q) => [q.$id, q.correctAnswer])
        );

        // Fetch knowledge question correctAnswers for skill round answers
        const unknownIds = tournamentAnswers
          .map((a) => a.questionId)
          .filter((id) => !correctAnswerMap.has(id));
        if (unknownIds.length > 0) {
          const kqRes = await withRetry(() =>
            tablesDB.listRows({
              databaseId: DB_ID,
              tableId: KNOWLEDGE_QUESTIONS_TABLE_ID,
              queries: [Query.equal("$id", unknownIds), Query.limit(unknownIds.length + 5)],
            })
          ).catch(() => null);
          if (kqRes) {
            for (const row of kqRes.rows as unknown as { $id: string; correctAnswer: boolean }[]) {
              correctAnswerMap.set(row.$id, row.correctAnswer);
            }
          }
        }

        // Fetch round assignments for rounds completed count
        const assignmentsRes = await withRetry(() =>
          tablesDB.listRows({
            databaseId: DB_ID,
            tableId: USER_ROUND_ASSIGNMENTS_TABLE_ID,
            queries: [
              Query.equal("userId", session.userId),
              Query.equal("tournamentId", tournamentId),
              Query.limit(100),
            ],
          })
        ).catch(() => null);

        const roundsCompleted = (assignmentsRes?.rows ?? []).filter(
          (r) => (r as unknown as RoundAssignment).completedAt !== null
        ).length;

        let correctAnswers = 0;
        let wrongAnswers = 0;
        let pending = 0;

        for (const ans of tournamentAnswers) {
          const correctAnswer = correctAnswerMap.get(ans.questionId);
          if (correctAnswer === null || correctAnswer === undefined) {
            pending++;
          } else if (ans.answer === correctAnswer) {
            correctAnswers++;
          } else {
            wrongAnswers++;
          }
        }

        const game = questions[0]?.game ?? tournamentId.split("-")[0];
        const resolveBy = questions[0]?.resolveBy ?? "";

        return {
          tournamentId,
          game,
          totalQuestions: tournamentAnswers.length,
          answeredQuestions: tournamentAnswers.length,
          correctAnswers,
          wrongAnswers,
          pending,
          resolveBy,
          roundsCompleted,
        };
      })
    );

    return NextResponse.json({ tournaments: summaries });
  } catch (err) {
    console.error("Appwrite error in GET /api/user/tournaments:", err);
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }
}
