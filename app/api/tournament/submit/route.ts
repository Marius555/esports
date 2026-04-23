import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/lib/auth";
import {
  createAdminClient,
  DB_ID,
  USER_ANSWERS_TABLE_ID,
  USER_ROUND_ASSIGNMENTS_TABLE_ID,
  ID,
  Query,
  AppwriteException,
} from "@/lib/appwrite";
import type { UserRoundAssignment } from "@/app/api/tournament/[game]/route";

const SubmitBodySchema = z.object({
  tournamentId: z.string().min(1).max(100),
  roundNumber: z.number().int().min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1).max(36),
        answer: z.boolean(),
        timeTaken: z.number().int().min(0).max(60000).optional(),
      })
    )
    .min(1)
    .max(10),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get("esports_session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await verifyToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SubmitBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { tournamentId, roundNumber, answers } = parsed.data;
  const { tablesDB } = createAdminClient();

  // --- Backend hardening ---
  // 1. Verify this round was actually assigned to the user
  const assignmentRes = await tablesDB.listRows({
    databaseId: DB_ID,
    tableId: USER_ROUND_ASSIGNMENTS_TABLE_ID,
    queries: [
      Query.equal("userId", session.userId),
      Query.equal("tournamentId", tournamentId),
      Query.equal("roundNumber", roundNumber),
      Query.limit(1),
    ],
  }).catch(() => null);

  if (!assignmentRes || assignmentRes.total === 0) {
    return NextResponse.json({ error: "Round not assigned to you" }, { status: 403 });
  }

  const assignment = assignmentRes.rows[0] as unknown as UserRoundAssignment;

  // 2. Prevent double-submission
  if (assignment.completedAt) {
    return NextResponse.json({ error: "Round already submitted" }, { status: 409 });
  }

  // 3. Verify submitted questionIds match the assigned ones
  let assignedIds: string[] = [];
  try {
    assignedIds = JSON.parse(assignment.questionIds) as string[];
  } catch {
    return NextResponse.json({ error: "Assignment data corrupted" }, { status: 500 });
  }
  const submittedIds = answers.map((a) => a.questionId);
  const assignedSet = new Set(assignedIds);
  const unauthorizedId = submittedIds.find((id) => !assignedSet.has(id));
  if (unauthorizedId) {
    return NextResponse.json({ error: "Unauthorized questionId in answers" }, { status: 403 });
  }
  // --- End backend hardening ---

  // Insert all answers
  const results = await Promise.allSettled(
    answers.map(({ questionId, answer, timeTaken }) =>
      tablesDB.createRow({
        databaseId: DB_ID,
        tableId: USER_ANSWERS_TABLE_ID,
        rowId: ID.unique(),
        data: {
          userId: session.userId,
          questionId,
          tournamentId,
          answer,
          timeTaken: timeTaken ?? null,
          roundNumber,
        },
      })
    )
  );

  const saved = results.filter((r) => r.status === "fulfilled").length;

  results.forEach((r) => {
    if (
      r.status === "rejected" &&
      !(r.reason instanceof AppwriteException && r.reason.code === 409)
    ) {
      console.error("Unexpected error saving answer:", r.reason);
    }
  });

  // Mark round as completed (use already-fetched assignment)
  await tablesDB.updateRow({
    databaseId: DB_ID,
    tableId: USER_ROUND_ASSIGNMENTS_TABLE_ID,
    rowId: assignment.$id,
    data: { completedAt: new Date().toISOString() },
  }).catch((err) => console.error("Failed to mark round complete:", err));

  const nextRoundAvailableAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  return NextResponse.json({ success: true, saved, nextRoundAvailableAt });
}
