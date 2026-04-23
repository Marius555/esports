import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
  createAdminClient,
  DB_ID,
  QUESTIONS_TABLE_ID,
  USER_ANSWERS_TABLE_ID,
  KNOWLEDGE_QUESTIONS_TABLE_ID,
  USER_ROUND_ASSIGNMENTS_TABLE_ID,
  ID,
  Query,
  AppwriteException,
} from "@/lib/appwrite";

const TIER_LIMITS: Record<string, number> = { free: 1, pro: 2, max: 3 };
const ROUND_INTERVAL_MS = 60 * 60 * 1000; // 1 hour between rounds
const QUESTIONS_PER_ROUND = 10;
const TOURNAMENT_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

import { pandaUpcoming, pandaRunning, pandaTeamWithPlayers } from "@/lib/pandascore";
import { getDota2RecentSeries, getDota2RecentHeroContext } from "@/lib/opendota";
import {
  generateTournamentQuestions,
  type EnrichedMatch,
  type EnrichedMatchTeam,
  type RecentResult,
  type TournamentInput,
} from "@/lib/gemini";
import type { MatchData } from "@/app/api/matches/[game]/route";

const VALID_GAMES = new Set(["dota2", "valorant", "counterstrike"]);

// knowledge_questions table uses the keys from the generate script
const KNOWLEDGE_GAME_KEY: Record<string, string> = {
  counterstrike: "counter-strike",
  dota2: "dota2",
  valorant: "valorant",
};

// ─── Exported types ───────────────────────────────────────────────────────────

export interface Question {
  $id: string;
  game: string;
  tournamentId: string;
  questionText: string;
  referenceType: string;
  referenceId: string;
  referenceName: string;
  referenceImageUrl: string;
  referenceImageUrlB?: string;
  correctAnswer?: boolean | null;
  resolveBy: string;
  matchScheduledAt?: string | null;
  roundNumber?: number | null;
}

export interface UserRoundAssignment {
  $id: string;
  userId: string;
  tournamentId: string;
  roundNumber: number;
  roundType: "skill" | "esports";
  questionIds: string; // JSON array
  startedAt: string;
  completedAt: string | null;
}

export interface TournamentResponse {
  tournamentId: string;
  questions: Question[];
  knowledgeCount: number;
  roundNumber: number;
  roundType: "skill" | "esports";
  tournamentEndsAt: string;
  nextRoundAvailableAt: string | null;
}

export interface TournamentWaitingResponse {
  waiting: true;
  tournamentId: string;
  roundNumber: number;
  nextRoundAvailableAt: string;
  tournamentEndsAt: string;
}

export interface TournamentExpiredResponse {
  expired: true;
  tournamentId: string;
  tournamentEndsAt: string;
}

export interface TournamentStatusResponse {
  tournamentId: string | null;
  hasEntered: boolean;
  tournamentEndsAt: string | null;
  isExpired: boolean;
  planLimitExceeded?: boolean;
  latestRound: {
    roundNumber: number;
    roundType: "skill" | "esports";
    completedAt: string | null;
    nextRoundAvailableAt: string | null;
  } | null;
}

interface KnowledgeQuestionRow {
  $id: string;
  game: string;
  questionText: string;
  correctAnswer: boolean;
  category: string;
  difficulty: string;
  explanation: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function matchDataToRecentResult(m: MatchData): RecentResult {
  const [a, b] = m.teams;
  const winner = a.won ? a.name : b.won ? b.name : "Draw";
  return {
    teamA: a.name,
    teamAScore: String(a.score),
    teamB: b.name,
    teamBScore: String(b.score),
    winner,
    tournament: m.tournament,
    date: m.date,
    bestof: m.bestof > 0 ? m.bestof : undefined,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function enrichMatches(
  rawMatches: Awaited<ReturnType<typeof pandaUpcoming>>,
  pandaGame: string
): Promise<EnrichedMatch[]> {
  const results: EnrichedMatch[] = [];
  for (const m of rawMatches.slice(0, 10)) {
    const [oppA, oppB] = m.opponents;
    if (!oppA || !oppB || oppA.type !== "Team" || oppB.type !== "Team") continue;
    const tA = oppA.opponent;
    const tB = oppB.opponent;

    const detailA = await pandaTeamWithPlayers(pandaGame, tA.id).catch(() => null);
    await sleep(200);
    const detailB = await pandaTeamWithPlayers(pandaGame, tB.id).catch(() => null);
    await sleep(200);

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

    results.push({
      matchId: String(m.id),
      tournament: m.tournament?.name ?? m.league?.name ?? "Unknown Tournament",
      scheduledAt: m.scheduled_at,
      teamA: toTeam(tA, detailA),
      teamB: toTeam(tB, detailB),
    });
  }
  return results;
}

async function buildTournamentInput(game: string): Promise<TournamentInput> {
  if (game === "dota2") {
    const [rawUpcoming, recentSeries, recentHeroData] = await Promise.all([
      pandaUpcoming("dota2"),
      getDota2RecentSeries().catch(() => [] as MatchData[]),
      getDota2RecentHeroContext().catch(() => []),
    ]);
    const upcomingMatches = await enrichMatches(rawUpcoming, "dota2");
    return {
      game,
      upcomingMatches,
      recentResults: recentSeries.map(matchDataToRecentResult),
      recentHeroData: recentHeroData.length > 0 ? recentHeroData : undefined,
    };
  }

  if (game === "counterstrike") {
    const [rawUpcoming, rawRunning] = await Promise.all([
      pandaUpcoming("csgo"),
      pandaRunning("csgo").catch(() => []),
    ]);
    const allMatches = [...rawRunning, ...rawUpcoming].slice(0, 10);
    const upcomingMatches = await enrichMatches(allMatches, "csgo");
    const recentResults: RecentResult[] = rawRunning.flatMap((m) => {
      const [oppA, oppB] = m.opponents;
      if (!oppA || !oppB || oppA.type !== "Team" || oppB.type !== "Team") return [];
      const scoreA = m.results.find((r) => r.team_id === oppA.opponent.id)?.score ?? 0;
      const scoreB = m.results.find((r) => r.team_id === oppB.opponent.id)?.score ?? 0;
      return [{
        teamA: oppA.opponent.name, teamAScore: String(scoreA),
        teamB: oppB.opponent.name, teamBScore: String(scoreB),
        winner: scoreA > scoreB ? oppA.opponent.name : scoreB > scoreA ? oppB.opponent.name : "Live",
        tournament: m.tournament?.name ?? m.league?.name ?? "Live Match",
        date: m.scheduled_at,
      }];
    });
    return { game, upcomingMatches, recentResults };
  }

  // Valorant
  const [rawUpcoming, rawRunning] = await Promise.all([
    pandaUpcoming("valorant"),
    pandaRunning("valorant").catch(() => []),
  ]);
  const allMatches = [...rawRunning, ...rawUpcoming].slice(0, 10);
  const upcomingMatches = await enrichMatches(allMatches, "valorant");
  const recentResults: RecentResult[] = rawRunning.flatMap((m) => {
    const [oppA, oppB] = m.opponents;
    if (!oppA || !oppB || oppA.type !== "Team" || oppB.type !== "Team") return [];
    const scoreA = m.results.find((r) => r.team_id === oppA.opponent.id)?.score ?? 0;
    const scoreB = m.results.find((r) => r.team_id === oppB.opponent.id)?.score ?? 0;
    return [{
      teamA: oppA.opponent.name, teamAScore: String(scoreA),
      teamB: oppB.opponent.name, teamBScore: String(scoreB),
      winner: scoreA > scoreB ? oppA.opponent.name : scoreB > scoreA ? oppB.opponent.name : "Live",
      tournament: m.tournament?.name ?? m.league?.name ?? "Live Match",
      date: m.scheduled_at,
    }];
  });
  return { game, upcomingMatches, recentResults };
}

/**
 * Derive the tournament end date from the tournament ID.
 * tournamentId format: "{game}-YYYY-MM-DD"
 * Accurate to the day; may be off by up to 24h from the real creation time.
 */
function computeTournamentEndsAt(tournamentId: string): string {
  const dateStr = tournamentId.slice(-10); // "YYYY-MM-DD"
  try {
    const start = new Date(dateStr + "T00:00:00.000Z");
    if (isNaN(start.getTime())) throw new Error("bad date");
    return new Date(start.getTime() + TOURNAMENT_DURATION_MS).toISOString();
  } catch {
    return new Date(Date.now() + TOURNAMENT_DURATION_MS).toISOString();
  }
}

/**
 * Find the active tournament for a game.
 * First checks the questions table (works once an esports round or anchor row exists).
 * Falls back to the current user's round assignments (handles skill-only tournaments).
 */
async function findActiveTournament(
  tablesDB: ReturnType<typeof createAdminClient>["tablesDB"],
  game: string,
  userId: string
): Promise<{ tournamentId: string; tournamentEndsAt: string } | null> {
  // Primary: questions table (includes anchor rows and esports questions)
  const questionsRes = await tablesDB.listRows({
    databaseId: DB_ID,
    tableId: QUESTIONS_TABLE_ID,
    queries: [
      Query.equal("game", game),
      Query.orderDesc("resolveBy"),
      Query.limit(1),
    ],
  }).catch(() => null);

  if (questionsRes && questionsRes.total > 0) {
    const q = questionsRes.rows[0] as unknown as Question;
    return { tournamentId: q.tournamentId, tournamentEndsAt: q.resolveBy };
  }

  // Fallback: scan the user's own assignments for a game-prefixed tournamentId
  const assignmentsRes = await tablesDB.listRows({
    databaseId: DB_ID,
    tableId: USER_ROUND_ASSIGNMENTS_TABLE_ID,
    queries: [
      Query.equal("userId", userId),
      Query.orderDesc("startedAt"),
      Query.limit(100),
    ],
  }).catch(() => null);

  if (!assignmentsRes || assignmentsRes.total === 0) return null;

  const gameAssignment = (assignmentsRes.rows as unknown as UserRoundAssignment[])
    .filter((a) => a.tournamentId.startsWith(game + "-"))
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

  if (!gameAssignment) return null;

  const tournamentEndsAt = computeTournamentEndsAt(gameAssignment.tournamentId);
  return { tournamentId: gameAssignment.tournamentId, tournamentEndsAt };
}

/**
 * Pick skill questions based on round progression.
 * Earlier rounds: easy+medium. Later rounds: medium+hard.
 */
function pickSkillQuestions(
  pool: KnowledgeQuestionRow[],
  skillRoundNumber: number // 1-indexed (1 = first skill round)
): KnowledgeQuestionRow[] {
  const easy   = pool.filter((q) => q.difficulty === "easy");
  const medium = pool.filter((q) => q.difficulty === "medium");
  const hard   = pool.filter((q) => q.difficulty === "hard");

  const shuffle = <T>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);

  let counts: [number, number, number]; // [easy, medium, hard]
  if      (skillRoundNumber <= 1) counts = [5, 5, 0];
  else if (skillRoundNumber <= 2) counts = [3, 4, 3];
  else if (skillRoundNumber <= 3) counts = [1, 4, 5];
  else                            counts = [0, 3, 7];

  const picked: KnowledgeQuestionRow[] = [
    ...shuffle(easy).slice(0, counts[0]),
    ...shuffle(medium).slice(0, counts[1]),
    ...shuffle(hard).slice(0, counts[2]),
  ];

  // If we don't have enough of a difficulty, fill from others
  while (picked.length < QUESTIONS_PER_ROUND) {
    const remaining = shuffle(pool).find((q) => !picked.includes(q));
    if (!remaining) break;
    picked.push(remaining);
  }

  return shuffle(picked).slice(0, QUESTIONS_PER_ROUND);
}

// ─── GET — tournament status for current user ─────────────────────────────────

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

  const found = await findActiveTournament(tablesDB, game, session.userId);

  if (!found) {
    return NextResponse.json({
      tournamentId: null,
      hasEntered: false,
      tournamentEndsAt: null,
      isExpired: false,
      latestRound: null,
    } satisfies TournamentStatusResponse);
  }

  const { tournamentId, tournamentEndsAt } = found;
  const now = new Date();
  const isExpired = new Date(tournamentEndsAt) < now;

  // Check user's round assignments for this tournament
  const assignments = await tablesDB.listRows({
    databaseId: DB_ID,
    tableId: USER_ROUND_ASSIGNMENTS_TABLE_ID,
    queries: [
      Query.equal("userId", session.userId),
      Query.equal("tournamentId", tournamentId),
      Query.orderDesc("roundNumber"),
      Query.limit(50),
    ],
  }).catch(() => null);

  if (!assignments || assignments.total === 0) {
    return NextResponse.json({
      tournamentId,
      hasEntered: false,
      tournamentEndsAt,
      isExpired,
      latestRound: null,
    } satisfies TournamentStatusResponse);
  }

  const latest = (assignments.rows[0] as unknown as UserRoundAssignment);
  const nextRoundAvailableAt = latest.completedAt
    ? new Date(new Date(latest.completedAt).getTime() + ROUND_INTERVAL_MS).toISOString()
    : null;

  // Check whether this tournament is within the user's current plan limit.
  // A user who downgrades keeps their oldest tournaments; newer ones are locked.
  let planLimitExceeded = false;
  if (!isExpired) {
    const tier = (session.tier ?? "free") as string;
    const limit = TIER_LIMITS[tier] ?? 1;

    const allUserRes = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: USER_ROUND_ASSIGNMENTS_TABLE_ID,
      queries: [Query.equal("userId", session.userId), Query.limit(200)],
    }).catch(() => null);

    if (allUserRes && allUserRes.total > 0) {
      const allRows = allUserRes.rows as unknown as UserRoundAssignment[];

      // Derive earliest entry date per tournament
      const entryDates = new Map<string, Date>();
      for (const a of allRows) {
        const d = new Date(a.startedAt);
        const existing = entryDates.get(a.tournamentId);
        if (!existing || d < existing) entryDates.set(a.tournamentId, d);
      }

      // Active tournaments sorted oldest-first (earliest entry = highest priority)
      const activeSorted = [...entryDates.entries()]
        .filter(([tid]) => new Date(computeTournamentEndsAt(tid)) > now)
        .sort((a, b) => a[1].getTime() - b[1].getTime())
        .map(([tid]) => tid);

      const rank = activeSorted.indexOf(tournamentId);
      planLimitExceeded = rank >= limit; // e.g. rank 1 with limit 1 → exceeded
    }
  }

  return NextResponse.json({
    tournamentId,
    hasEntered: true,
    tournamentEndsAt,
    isExpired,
    planLimitExceeded,
    latestRound: {
      roundNumber: latest.roundNumber,
      roundType: latest.roundType,
      completedAt: latest.completedAt,
      nextRoundAvailableAt,
    },
  } satisfies TournamentStatusResponse);
}

// ─── POST — enter tournament or get next round ────────────────────────────────

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
  const now = new Date();

  try {
    // ── Find or create the tournament ──────────────────────────────────────────

    const foundTournament = await findActiveTournament(tablesDB, game, session.userId);

    // Only use found tournament if it's still active
    const activeTournament = foundTournament && new Date(foundTournament.tournamentEndsAt) > now
      ? foundTournament
      : null;

    const tournamentId = activeTournament?.tournamentId ?? `${game}-${now.toISOString().slice(0, 10)}`;
    const tournamentEndsAt = activeTournament?.tournamentEndsAt ?? new Date(now.getTime() + TOURNAMENT_DURATION_MS).toISOString();

    // ── Check if tournament is expired ─────────────────────────────────────────
    if (new Date(tournamentEndsAt) < now) {
      return NextResponse.json({
        expired: true,
        tournamentId,
        tournamentEndsAt,
      } satisfies TournamentExpiredResponse);
    }

    // ── Load user's existing round assignments for this tournament ─────────────
    const assignmentsRes = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: USER_ROUND_ASSIGNMENTS_TABLE_ID,
      queries: [
        Query.equal("userId", session.userId),
        Query.equal("tournamentId", tournamentId),
        Query.orderDesc("roundNumber"),
        Query.limit(100),
      ],
    }).catch(() => null);

    const assignments = (assignmentsRes?.rows ?? []) as unknown as UserRoundAssignment[];

    // ── First entry — enforce tier limits, then create Round 1 ────────────────
    if (assignments.length === 0) {
      const tier = (session.tier ?? "free") as string;
      const limit = TIER_LIMITS[tier] ?? 1;

      // Count other active tournaments the user is in
      const allAssignments = await tablesDB.listRows({
        databaseId: DB_ID,
        tableId: USER_ROUND_ASSIGNMENTS_TABLE_ID,
        queries: [Query.equal("userId", session.userId), Query.limit(200)],
      }).catch(() => null);

      if (allAssignments && allAssignments.total > 0) {
        const otherTournamentIds = [
          ...new Set(
            (allAssignments.rows as unknown as UserRoundAssignment[])
              .map((r) => r.tournamentId)
              .filter((id) => id !== tournamentId)
          ),
        ];

        // Derive end dates from the embedded YYYY-MM-DD in each tournament ID
        // (avoids unreliable greaterThan string comparison on TablesDB)
        let activeOtherCount = 0;
        for (const tid of otherTournamentIds) {
          const endsAt = computeTournamentEndsAt(tid);
          if (new Date(endsAt) > now) activeOtherCount++;
        }

        if (activeOtherCount >= limit) {
          const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
          return NextResponse.json(
            {
              error: `${tierLabel} plan allows ${limit} active tournament${limit === 1 ? "" : "s"} at a time.`,
              limitReached: true,
            },
            { status: 403 }
          );
        }
      }

      // Create Round 1 (skill)
      return await createSkillRound(tablesDB, session.userId, tournamentId, game, 1, tournamentEndsAt, now);
    }

    const latestAssignment = assignments[0]; // highest roundNumber due to orderDesc

    // ── User has an incomplete round — return existing questions ───────────────
    if (!latestAssignment.completedAt) {
      return await loadExistingRound(tablesDB, latestAssignment, tournamentEndsAt);
    }

    // ── Round completed — check if next round is available ────────────────────
    const nextAvailableAt = new Date(
      new Date(latestAssignment.completedAt).getTime() + ROUND_INTERVAL_MS
    );

    if (now < nextAvailableAt) {
      return NextResponse.json({
        waiting: true,
        tournamentId,
        roundNumber: latestAssignment.roundNumber,
        nextRoundAvailableAt: nextAvailableAt.toISOString(),
        tournamentEndsAt,
      } satisfies TournamentWaitingResponse);
    }

    // ── Create the next round ──────────────────────────────────────────────────
    const nextRoundNumber = latestAssignment.roundNumber + 1;
    const isEsportsRound = nextRoundNumber % 2 === 0; // even rounds = esports

    if (isEsportsRound) {
      return await createOrJoinEsportsRound(
        tablesDB, session.userId, tournamentId, game, nextRoundNumber, tournamentEndsAt, now
      );
    } else {
      const skillRoundNumber = Math.ceil(nextRoundNumber / 2);
      return await createSkillRound(
        tablesDB, session.userId, tournamentId, game, nextRoundNumber, tournamentEndsAt, now, skillRoundNumber
      );
    }
  } catch (err) {
    if (err instanceof AppwriteException) {
      console.error("Appwrite error:", err.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Tournament error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Round creators ───────────────────────────────────────────────────────────

async function createSkillRound(
  tablesDB: ReturnType<typeof createAdminClient>["tablesDB"],
  userId: string,
  tournamentId: string,
  game: string,
  tournamentRoundNumber: number,
  tournamentEndsAt: string,
  now: Date,
  skillRoundNumber = 1
): Promise<NextResponse> {
  // Fetch the full knowledge question pool for this game
  const kqGame = KNOWLEDGE_GAME_KEY[game] ?? game;
  const poolRes = await tablesDB.listRows({
    databaseId: DB_ID,
    tableId: KNOWLEDGE_QUESTIONS_TABLE_ID,
    queries: [Query.equal("game", kqGame), Query.limit(300)],
  }).catch(() => null);

  const pool = (poolRes?.rows ?? []) as unknown as KnowledgeQuestionRow[];
  if (pool.length === 0) {
    return NextResponse.json({ error: "No knowledge questions available" }, { status: 503 });
  }

  const picked = pickSkillQuestions(pool, skillRoundNumber);
  const questionIds = JSON.stringify(picked.map((q) => q.$id));

  await tablesDB.createRow({
    databaseId: DB_ID,
    tableId: USER_ROUND_ASSIGNMENTS_TABLE_ID,
    rowId: ID.unique(),
    data: {
      userId,
      tournamentId,
      roundNumber: tournamentRoundNumber,
      roundType: "skill",
      questionIds,
      startedAt: now.toISOString(),
      completedAt: null,
    },
  });

  // For round 1: create a tournament anchor row in the questions table so that
  // the status and rankings endpoints can always find this tournament by game,
  // even before any esports round questions exist.
  if (tournamentRoundNumber === 1) {
    await tablesDB.createRow({
      databaseId: DB_ID,
      tableId: QUESTIONS_TABLE_ID,
      rowId: `anchor-${tournamentId}`,
      data: {
        game,
        tournamentId,
        questionText: "__tournament_anchor__",
        referenceType: "anchor",
        referenceId: tournamentId,
        referenceName: "anchor",
        referenceImageUrl: "",
        referenceImageUrlB: "",
        resolveBy: tournamentEndsAt,
        matchScheduledAt: null,
        roundNumber: 0,
      },
    }).catch((err: unknown) => {
      // 409 = anchor already exists (concurrent entry), that's fine
      if (!(err instanceof AppwriteException && err.code === 409)) {
        console.error("Failed to create tournament anchor:", err);
      }
    });
  }

  // Build Question-shaped objects from knowledge questions
  const questions: Question[] = picked.map((kq) => ({
    $id: kq.$id,
    game,
    tournamentId,
    questionText: kq.questionText,
    referenceType: "knowledge",
    referenceId: kq.$id,
    referenceName: kq.category,
    referenceImageUrl: "",
    referenceImageUrlB: "",
    correctAnswer: kq.correctAnswer,
    resolveBy: tournamentEndsAt,
    matchScheduledAt: null,
    roundNumber: tournamentRoundNumber,
  }));

  return NextResponse.json({
    tournamentId,
    questions,
    knowledgeCount: questions.length,
    roundNumber: tournamentRoundNumber,
    roundType: "skill",
    tournamentEndsAt,
    nextRoundAvailableAt: null,
  } satisfies TournamentResponse);
}

async function createOrJoinEsportsRound(
  tablesDB: ReturnType<typeof createAdminClient>["tablesDB"],
  userId: string,
  tournamentId: string,
  game: string,
  roundNumber: number,
  tournamentEndsAt: string,
  now: Date
): Promise<NextResponse> {
  // Check if esports questions for this round already exist (another user triggered it)
  const existingQs = await tablesDB.listRows({
    databaseId: DB_ID,
    tableId: QUESTIONS_TABLE_ID,
    queries: [
      Query.equal("tournamentId", tournamentId),
      Query.equal("roundNumber", roundNumber),
      Query.limit(QUESTIONS_PER_ROUND + 5),
    ],
  }).catch(() => null);

  let esportsQuestions: Question[];

  if (existingQs && existingQs.total >= QUESTIONS_PER_ROUND) {
    // Reuse existing questions — same for all users
    esportsQuestions = (existingQs.rows as unknown as Question[]).slice(0, QUESTIONS_PER_ROUND);
  } else {
    // Generate fresh esports questions for this round
    const tournamentInput = await buildTournamentInput(game);

    if (tournamentInput.upcomingMatches.length === 0) {
      return NextResponse.json(
        { error: "No upcoming matches found for esports round" },
        { status: 503 }
      );
    }

    const geminiQuestions = await generateTournamentQuestions(tournamentInput);
    const matchScheduleMap = new Map<string, string>(
      tournamentInput.upcomingMatches.map((m) => [m.matchId, m.scheduledAt])
    );

    // Pick the first QUESTIONS_PER_ROUND from Gemini output
    const toInsert = geminiQuestions.slice(0, QUESTIONS_PER_ROUND);

    const saved = await Promise.all(
      toInsert.map((q) =>
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
            referenceImageUrlB: q.referenceImageUrlB ?? "",
            resolveBy: tournamentEndsAt,
            matchScheduledAt: matchScheduleMap.get(q.referenceId) ?? null,
            roundNumber,
          },
        })
      )
    );

    esportsQuestions = saved as unknown as Question[];
  }

  const questionIds = JSON.stringify(esportsQuestions.map((q) => q.$id));

  // Create round assignment for this user
  await tablesDB.createRow({
    databaseId: DB_ID,
    tableId: USER_ROUND_ASSIGNMENTS_TABLE_ID,
    rowId: ID.unique(),
    data: {
      userId,
      tournamentId,
      roundNumber,
      roundType: "esports",
      questionIds,
      startedAt: now.toISOString(),
      completedAt: null,
    },
  }).catch(async (err) => {
    // 409 = assignment already created by concurrent request, that's fine
    if (!(err instanceof AppwriteException && err.code === 409)) throw err;
  });

  return NextResponse.json({
    tournamentId,
    questions: esportsQuestions,
    knowledgeCount: 0,
    roundNumber,
    roundType: "esports",
    tournamentEndsAt,
    nextRoundAvailableAt: null,
  } satisfies TournamentResponse);
}

async function loadExistingRound(
  tablesDB: ReturnType<typeof createAdminClient>["tablesDB"],
  assignment: UserRoundAssignment,
  tournamentEndsAt: string
): Promise<NextResponse> {
  const ids: string[] = JSON.parse(assignment.questionIds);

  let questions: Question[];

  if (assignment.roundType === "skill") {
    // Knowledge questions — fetch from knowledge_questions table
    const rows = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: KNOWLEDGE_QUESTIONS_TABLE_ID,
      queries: [Query.equal("$id", ids), Query.limit(ids.length + 5)],
    }).catch(() => null);

    const kqRows = (rows?.rows ?? []) as unknown as KnowledgeQuestionRow[];
    // Preserve original order
    const kqMap = new Map(kqRows.map((q) => [q.$id, q]));
    questions = ids
      .map((id) => kqMap.get(id))
      .filter(Boolean)
      .map((kq) => ({
        $id: kq!.$id,
        game: assignment.tournamentId.split("-")[0],
        tournamentId: assignment.tournamentId,
        questionText: kq!.questionText,
        referenceType: "knowledge",
        referenceId: kq!.$id,
        referenceName: kq!.category,
        referenceImageUrl: "",
        referenceImageUrlB: "",
        correctAnswer: kq!.correctAnswer,
        resolveBy: tournamentEndsAt,
        matchScheduledAt: null,
        roundNumber: assignment.roundNumber,
      }));
  } else {
    // Esports questions — fetch from questions table
    const rows = await tablesDB.listRows({
      databaseId: DB_ID,
      tableId: QUESTIONS_TABLE_ID,
      queries: [Query.equal("$id", ids), Query.limit(ids.length + 5)],
    }).catch(() => null);

    const qRows = (rows?.rows ?? []) as unknown as Question[];
    const qMap = new Map(qRows.map((q) => [q.$id, q]));
    questions = ids
      .map((id) => qMap.get(id))
      .filter(Boolean) as Question[];
  }

  const nextRoundAvailableAt = assignment.completedAt
    ? new Date(new Date(assignment.completedAt).getTime() + ROUND_INTERVAL_MS).toISOString()
    : null;

  return NextResponse.json({
    tournamentId: assignment.tournamentId,
    questions,
    knowledgeCount: assignment.roundType === "skill" ? questions.length : 0,
    roundNumber: assignment.roundNumber,
    roundType: assignment.roundType,
    tournamentEndsAt,
    nextRoundAvailableAt,
  } satisfies TournamentResponse);
}
