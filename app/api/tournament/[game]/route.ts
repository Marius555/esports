import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
  createAdminClient,
  DB_ID,
  QUESTIONS_TABLE_ID,
  ID,
  Query,
  AppwriteException,
} from "@/lib/appwrite";
import { pandaUpcoming, pandaRunning, pandaTeamWithPlayers } from "@/lib/pandascore";
import { getLolSchedule } from "@/lib/riot-esports";
import { getDota2RecentSeries, getDota2RecentHeroContext } from "@/lib/opendota";
import {
  generateTournamentQuestions,
  type EnrichedMatch,
  type EnrichedMatchTeam,
  type RecentResult,
  type TournamentInput,
} from "@/lib/gemini";
import type { MatchData } from "@/app/api/matches/[game]/route";

const VALID_GAMES = new Set(["dota2", "leagueoflegends", "counterstrike"]);

// ─── Exported types (imported by tournament-modal.tsx) ────────────────────────

export interface Question {
  $id: string;
  game: string;
  tournamentId: string;
  questionText: string;
  referenceType: string;
  referenceId: string;
  referenceName: string;
  referenceImageUrl: string;
  correctAnswer?: boolean | null;
  resolveBy: string;
  matchScheduledAt?: string | null;
}

export interface TournamentResponse {
  tournamentId: string;
  questions: Question[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function matchDataToRecentResult(m: MatchData): RecentResult {
  const [a, b] = m.teams;
  const winner = a.won ? a.name : b.won ? b.name : "Draw";
  return {
    teamA: a.name,
    teamAScore: a.score,
    teamB: b.name,
    teamBScore: b.score,
    winner,
    tournament: m.tournament,
    date: m.date,
    bestof: m.bestof > 0 ? m.bestof : undefined,
  };
}

async function buildTournamentInput(game: string): Promise<TournamentInput> {
  // ── Dota 2 ──────────────────────────────────────────────────────────────────
  if (game === "dota2") {
    const [rawUpcoming, recentSeries, recentHeroData] = await Promise.all([
      pandaUpcoming("dota2"),
      getDota2RecentSeries().catch(() => [] as MatchData[]),
      getDota2RecentHeroContext().catch(() => []),
    ]);

    const upcomingMatches = (
      await Promise.all(
        rawUpcoming.slice(0, 10).map(async (m): Promise<EnrichedMatch | null> => {
          const [oppA, oppB] = m.opponents;
          if (!oppA || !oppB || oppA.type !== "Team" || oppB.type !== "Team") return null;
          const tA = oppA.opponent;
          const tB = oppB.opponent;

          const [detailA, detailB] = await Promise.all([
            pandaTeamWithPlayers("dota2", tA.id).catch(() => null),
            pandaTeamWithPlayers("dota2", tB.id).catch(() => null),
          ]);

          const toTeam = (t: typeof tA, d: typeof detailA): EnrichedMatchTeam => ({
            id: String(t.id),
            name: t.name,
            imageUrl: t.image_url ?? "",
            players: (d?.players ?? []).map((p) => ({
              name: p.name,
              role: p.role,
              imageUrl: p.image_url,
            })),
          });

          return {
            matchId: String(m.id),
            tournament: m.tournament?.name ?? m.league?.name ?? "Unknown Tournament",
            scheduledAt: m.scheduled_at,
            teamA: toTeam(tA, detailA),
            teamB: toTeam(tB, detailB),
          };
        })
      )
    ).filter((m): m is EnrichedMatch => m !== null);

    return {
      game,
      upcomingMatches,
      recentResults: recentSeries.map(matchDataToRecentResult),
      recentHeroData: recentHeroData.length > 0 ? recentHeroData : undefined,
    };
  }

  // ── CS2 ─────────────────────────────────────────────────────────────────────
  if (game === "counterstrike") {
    const [rawUpcoming, rawRunning] = await Promise.all([
      pandaUpcoming("csgo"),
      pandaRunning("csgo").catch(() => []),
    ]);

    const allMatches = [...rawRunning, ...rawUpcoming].slice(0, 10);

    const upcomingMatches = (
      await Promise.all(
        allMatches.map(async (m): Promise<EnrichedMatch | null> => {
          const [oppA, oppB] = m.opponents;
          if (!oppA || !oppB || oppA.type !== "Team" || oppB.type !== "Team") return null;
          const tA = oppA.opponent;
          const tB = oppB.opponent;

          const [detailA, detailB] = await Promise.all([
            pandaTeamWithPlayers("csgo", tA.id).catch(() => null),
            pandaTeamWithPlayers("csgo", tB.id).catch(() => null),
          ]);

          const toTeam = (t: typeof tA, d: typeof detailA): EnrichedMatchTeam => ({
            id: String(t.id),
            name: t.name,
            imageUrl: t.image_url ?? "",
            players: (d?.players ?? []).map((p) => ({
              name: p.name,
              role: p.role,
              imageUrl: p.image_url,
            })),
          });

          return {
            matchId: String(m.id),
            tournament: m.tournament?.name ?? m.league?.name ?? "Unknown Tournament",
            scheduledAt: m.scheduled_at,
            teamA: toTeam(tA, detailA),
            teamB: toTeam(tB, detailB),
          };
        })
      )
    ).filter((m): m is EnrichedMatch => m !== null);

    // Running matches act as "recent form" context for CS2
    const recentResults: RecentResult[] = rawRunning
      .flatMap((m) => {
        const [oppA, oppB] = m.opponents;
        if (!oppA || !oppB || oppA.type !== "Team" || oppB.type !== "Team") return [];
        const scoreA = m.results.find((r) => r.team_id === oppA.opponent.id)?.score ?? 0;
        const scoreB = m.results.find((r) => r.team_id === oppB.opponent.id)?.score ?? 0;
        return [{
          teamA: oppA.opponent.name,
          teamAScore: String(scoreA),
          teamB: oppB.opponent.name,
          teamBScore: String(scoreB),
          winner: scoreA > scoreB ? oppA.opponent.name : scoreB > scoreA ? oppB.opponent.name : "Live",
          tournament: m.tournament?.name ?? m.league?.name ?? "Live Match",
          date: m.scheduled_at,
        }];
      });

    return { game, upcomingMatches, recentResults };
  }

  // ── League of Legends ────────────────────────────────────────────────────────
  const { upcoming, recent } = await getLolSchedule();

  const upcomingMatches: EnrichedMatch[] = upcoming.slice(0, 10).map((m) => ({
    matchId: m.matchId,
    tournament: m.tournament,
    scheduledAt: m.date,
    teamA: {
      id: m.teams[0].name,
      name: m.teams[0].name,
      imageUrl: m.teams[0].iconPath ?? "",
      players: [],
    },
    teamB: {
      id: m.teams[1].name,
      name: m.teams[1].name,
      imageUrl: m.teams[1].iconPath ?? "",
      players: [],
    },
  }));

  return {
    game,
    upcomingMatches,
    recentResults: recent.map(matchDataToRecentResult),
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(
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
  const now = new Date().toISOString();

  try {
    // Return existing active questions if they exist
    const existing = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: QUESTIONS_TABLE_ID,
      queries: [
        Query.equal("game", game),
        Query.greaterThan("resolveBy", now),
        Query.limit(30),
      ],
    });

    if (existing.total > 0) {
      const rows = existing.rows as unknown as Question[];
      return NextResponse.json({
        tournamentId: rows[0].tournamentId,
        questions: rows,
      } satisfies TournamentResponse);
    }

    // Generate new questions
    const tournamentId = `${game}-${new Date().toISOString().slice(0, 10)}`;
    const resolveBy = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const tournamentInput = await buildTournamentInput(game);

    if (tournamentInput.upcomingMatches.length === 0) {
      return NextResponse.json(
        { error: "No upcoming matches found to generate questions from" },
        { status: 503 }
      );
    }

    const geminiQuestions = await generateTournamentQuestions(tournamentInput);

    const matchScheduleMap = new Map<string, string>(
      tournamentInput.upcomingMatches.map((m) => [m.matchId, m.scheduledAt])
    );

    const saved = await Promise.all(
      geminiQuestions.map((q) =>
        tablesDB.createRow({
          databaseId: DB_ID,
          tableId: QUESTIONS_TABLE_ID,
          rowId: ID.unique(),
          data: {
            game,
            tournamentId,
            questionText: q.questionText,
            referenceType: q.referenceType,
            referenceId: q.referenceId,
            referenceName: q.referenceName,
            referenceImageUrl: q.referenceImageUrl ?? "",
            resolveBy,
            matchScheduledAt: matchScheduleMap.get(q.referenceId) ?? null,
          },
        })
      )
    );

    return NextResponse.json({
      tournamentId,
      questions: saved as unknown as Question[],
    } satisfies TournamentResponse);
  } catch (err) {
    if (err instanceof AppwriteException) {
      console.error("Appwrite error:", err.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Tournament generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
