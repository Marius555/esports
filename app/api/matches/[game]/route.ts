import { NextRequest, NextResponse } from "next/server";
import { pandaUpcoming, pandaPast, pandaRunning, type PandaMatch } from "@/lib/pandascore";
import { getDota2RecentSeries } from "@/lib/opendota";

const VALID_GAMES = new Set(["dota2", "valorant", "counterstrike"]);

export interface TeamData {
  name: string;
  score: string;
  won: boolean;
  iconPath: string;
}

export interface MatchData {
  matchId: string;
  date: string;
  tournament: string;
  finished: boolean;
  bestof: number;
  teams: [TeamData, TeamData];
}

export interface MatchesResponse {
  game: string;
  recent: MatchData[];
  upcoming: MatchData[];
}

function transformPandaMatch(m: PandaMatch): MatchData | null {
  const [oppA, oppB] = m.opponents;
  if (!oppA || !oppB || oppA.type !== "Team" || oppB.type !== "Team") return null;

  const teamA = oppA.opponent;
  const teamB = oppB.opponent;
  const scoreA = m.results.find((r) => r.team_id === teamA.id)?.score ?? 0;
  const scoreB = m.results.find((r) => r.team_id === teamB.id)?.score ?? 0;

  return {
    matchId: String(m.id),
    date: m.scheduled_at,
    tournament: m.tournament?.name ?? m.league?.name ?? "",
    finished: m.status === "finished",
    bestof: m.number_of_games ?? 0,
    teams: [
      {
        name: teamA.name,
        score: String(scoreA),
        won: m.winner_id === teamA.id,
        iconPath: teamA.image_url ?? "",
      },
      {
        name: teamB.name,
        score: String(scoreB),
        won: m.winner_id === teamB.id,
        iconPath: teamB.image_url ?? "",
      },
    ],
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ game: string }> }
) {
  const { game } = await params;

  if (!VALID_GAMES.has(game)) {
    return NextResponse.json({ error: "Invalid game" }, { status: 400 });
  }

  try {
    let upcoming: MatchData[] = [];
    let recent: MatchData[] = [];

    if (game === "dota2") {
      // PandaScore (free) for upcoming; OpenDota (free) for recent series
      const raw = await pandaUpcoming("dota2");
      upcoming = raw
        .map(transformPandaMatch)
        .filter((m): m is MatchData => m !== null)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5);
      recent = await getDota2RecentSeries();
    } else if (game === "valorant") {
      const [rawUpcoming, rawPast] = await Promise.all([
        pandaUpcoming("valorant"),
        pandaPast("valorant"),
      ]);
      upcoming = rawUpcoming
        .map(transformPandaMatch)
        .filter((m): m is MatchData => m !== null)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5);
      recent = rawPast
        .map(transformPandaMatch)
        .filter((m): m is MatchData => m !== null)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);
      if (recent.length === 0) {
        const rawRunning = await pandaRunning("valorant").catch(() => []);
        recent = rawRunning
          .map(transformPandaMatch)
          .filter((m): m is MatchData => m !== null)
          .slice(0, 5);
      }
    } else if (game === "counterstrike") {
      // PandaScore free tier: upcoming works, past requires paid tier (returns [])
      const [rawUpcoming, rawPast] = await Promise.all([
        pandaUpcoming("csgo"),
        pandaPast("csgo"),
      ]);
      upcoming = rawUpcoming
        .map(transformPandaMatch)
        .filter((m): m is MatchData => m !== null)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5);
      recent = rawPast
        .map(transformPandaMatch)
        .filter((m): m is MatchData => m !== null)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);
    }

    return NextResponse.json(
      { game, recent, upcoming } satisfies MatchesResponse,
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
