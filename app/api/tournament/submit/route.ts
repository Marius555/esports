import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/lib/auth";
import {
  createAdminClient,
  DB_ID,
  USER_ANSWERS_TABLE_ID,
  ID,
  AppwriteException,
} from "@/lib/appwrite";

const SubmitBodySchema = z.object({
  tournamentId: z.string().min(1).max(100),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1).max(36),
        answer: z.boolean(),
      })
    )
    .min(1)
    .max(30),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify session
  const cookieStore = await cookies();
  const token = cookieStore.get("esports_session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session = await verifyToken(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate body
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

  const { tournamentId, answers } = parsed.data;
  const { tablesDB } = createAdminClient();

  // Insert all answers; silently skip 409 duplicates (user re-entering)
  const results = await Promise.allSettled(
    answers.map(({ questionId, answer }) =>
      tablesDB.createRow({
        databaseId: DB_ID,
        tableId: USER_ANSWERS_TABLE_ID,
        rowId: ID.unique(),
        data: {
          userId: session.userId,
          questionId,
          tournamentId,
          answer,
        },
      })
    )
  );

  const saved = results.filter((r) => r.status === "fulfilled").length;

  // Log any unexpected failures (409 duplicates are expected and silent)
  results.forEach((r) => {
    if (
      r.status === "rejected" &&
      !(r.reason instanceof AppwriteException && r.reason.code === 409)
    ) {
      console.error("Unexpected error saving answer:", r.reason);
    }
  });

  return NextResponse.json({ success: true, saved });
}
