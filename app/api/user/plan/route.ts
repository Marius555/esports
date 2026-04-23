import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyToken, signToken, COOKIE_NAME, COOKIE_MAX_AGE } from "@/lib/auth";
import {
  createAdminClient,
  DB_ID,
  USERS_TABLE_ID,
  USER_ROUND_ASSIGNMENTS_TABLE_ID,
  Query,
  AppwriteException,
  type UserRow,
} from "@/lib/appwrite";
import type { UserRoundAssignment } from "@/app/api/tournament/[game]/route";

const TIER_LIMITS: Record<string, number> = { free: 1, pro: 2, max: 3 };

const PlanSchema = z.object({
  tier: z.enum(["free", "pro", "max"]),
  cancelTournamentIds: z.array(z.string().min(1).max(100)).max(10).optional(),
});

function computeTournamentEndsAt(tournamentId: string): string {
  const dateStr = tournamentId.slice(-10);
  try {
    const start = new Date(dateStr + "T00:00:00.000Z");
    if (isNaN(start.getTime())) throw new Error("bad date");
    return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  } catch {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }
}

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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const { tier, cancelTournamentIds } = parsed.data;
  const newLimit = TIER_LIMITS[tier] ?? 1;
  const now = new Date();
  const { tablesDB } = createAdminClient();

  try {
    // Fetch all user round assignments to find active tournaments
    const allAssignmentsRes = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: USER_ROUND_ASSIGNMENTS_TABLE_ID,
      queries: [Query.equal("userId", session.userId), Query.limit(200)],
    }).catch(() => null);

    const activeTournamentIds = [
      ...new Set(
        ((allAssignmentsRes?.rows ?? []) as unknown as UserRoundAssignment[])
          .map((r) => r.tournamentId)
          .filter((tid) => new Date(computeTournamentEndsAt(tid)) > now)
      ),
    ];

    // If downgrading puts user over the new limit
    if (activeTournamentIds.length > newLimit) {
      if (!cancelTournamentIds || cancelTournamentIds.length === 0) {
        // Return the list so the frontend can show a selection modal
        return NextResponse.json({
          requiresDowngrade: true,
          activeTournaments: activeTournamentIds.map((tid) => ({
            tournamentId: tid,
            game: tid.split("-")[0],
            endsAt: computeTournamentEndsAt(tid),
          })),
          newLimit,
          currentCount: activeTournamentIds.length,
        });
      }

      // Validate that the user is actually canceling enough
      const remainingAfterCancel = activeTournamentIds.filter(
        (tid) => !cancelTournamentIds.includes(tid)
      ).length;
      if (remainingAfterCancel > newLimit) {
        return NextResponse.json(
          { error: `You must cancel at least ${activeTournamentIds.length - newLimit} tournament(s) to match your new plan.` },
          { status: 400 }
        );
      }

      // Cancel the specified tournaments by removing the user's round assignments
      for (const tid of cancelTournamentIds) {
        if (!activeTournamentIds.includes(tid)) continue; // Only cancel tournaments the user is in

        const tidAssignmentsRes = await tablesDB.listRows({
          databaseId: DB_ID,
          tableId: USER_ROUND_ASSIGNMENTS_TABLE_ID,
          queries: [
            Query.equal("userId", session.userId),
            Query.equal("tournamentId", tid),
            Query.limit(50),
          ],
        }).catch(() => null);

        if (!tidAssignmentsRes) continue;
        for (const row of tidAssignmentsRes.rows) {
          const rowId = (row as unknown as { $id: string }).$id;
          await tablesDB.deleteRow({
            databaseId: DB_ID,
            tableId: USER_ROUND_ASSIGNMENTS_TABLE_ID,
            rowId,
          }).catch(() => null);
        }
      }
    }

    // Find user row
    const usersRes = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: USERS_TABLE_ID,
      queries: [Query.equal("userId", session.userId), Query.limit(1)],
    });

    if (usersRes.total === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userRow = usersRes.rows[0] as unknown as UserRow;

    // Update tier
    await tablesDB.updateRow({
      databaseId: DB_ID,
      tableId: USERS_TABLE_ID,
      rowId: userRow.$id,
      data: { tier },
    });

    // Re-issue JWT with new tier
    const newToken = await signToken({
      userId: session.userId,
      username: session.username,
      email: session.email,
      tier,
    });

    const response = NextResponse.json({ success: true, tier });
    response.cookies.set(COOKIE_NAME, newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (err) {
    if (err instanceof AppwriteException) {
      console.error("Appwrite error updating plan:", err.message);
    }
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}
