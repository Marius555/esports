import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
  createAdminClient,
  DB_ID,
  QUESTIONS_TABLE_ID,
  USER_ANSWERS_TABLE_ID,
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
        const questionsRes = await withRetry(() =>
          tablesDB.listRows({
            databaseId: DB_ID,
            tableId: QUESTIONS_TABLE_ID,
            queries: [Query.equal("tournamentId", tournamentId), Query.limit(50)],
          })
        );

        const questions = questionsRes.rows as unknown as Question[];
        const tournamentAnswers = answers.filter((a) => a.tournamentId === tournamentId);
        const answerMap = new Map(tournamentAnswers.map((a) => [a.questionId, a.answer]));

        let correctAnswers = 0;
        let wrongAnswers = 0;
        let pending = 0;

        for (const q of questions) {
          const userAnswer = answerMap.get(q.$id);
          if (userAnswer === undefined) continue;

          if (q.correctAnswer === null || q.correctAnswer === undefined) {
            pending++;
          } else if (userAnswer === q.correctAnswer) {
            correctAnswers++;
          } else {
            wrongAnswers++;
          }
        }

        return {
          tournamentId,
          game: questions[0]?.game ?? tournamentId.split("-")[0],
          totalQuestions: questions.length,
          answeredQuestions: tournamentAnswers.length,
          correctAnswers,
          wrongAnswers,
          pending,
          resolveBy: questions[0]?.resolveBy ?? "",
        };
      })
    );

    return NextResponse.json({ tournaments: summaries });
  } catch (err) {
    console.error("Appwrite error in GET /api/user/tournaments:", err);
    return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
  }
}
