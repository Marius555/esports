// Server-side only — import only in Server Actions or Route Handlers
import type { MatchData } from "@/app/api/matches/[game]/route";

const LOL_API_BASE = "https://esports-api.lolesports.com/persisted/gw";

// Major LoL leagues: LCS, LCK, LEC, Worlds, MSI
// Note: LPL is Tencent-hosted and not available on this API
const LEAGUE_IDS = [
  "98767991299243165", // LCS
  "98767991310872058", // LCK
  "98767991302996019", // LEC
  "98767975604431411", // Worlds
  "98767991325878492", // MSI
].join(",");

interface LolTeam {
  name: string;
  code: string;
  image: string;
  result: {
    outcome: "win" | "loss" | null;
    gameWins: number;
  } | null;
}

interface LolEvent {
  startTime: string;
  state: "completed" | "inProgress" | "unstarted";
  type: string;
  blockName: string;
  league: {
    name: string;
    slug: string;
  };
  match: {
    id: string;
    teams: LolTeam[];
    strategy: {
      type: string;
      count: number;
    };
  };
}

interface LolScheduleResponse {
  data: {
    schedule: {
      events: LolEvent[];
    };
  };
}

function transformLolEvent(event: LolEvent): MatchData | null {
  const { match, league, blockName, startTime, state } = event;
  if (!match || match.teams.length < 2) return null;

  const [teamA, teamB] = match.teams;
  const finished = state === "completed";

  const scoreA = teamA.result?.gameWins ?? 0;
  const scoreB = teamB.result?.gameWins ?? 0;
  const wonA = teamA.result?.outcome === "win";
  const wonB = teamB.result?.outcome === "win";

  const tournament = blockName
    ? `${league.name} · ${blockName}`
    : league.name;

  return {
    matchId: match.id,
    date: startTime,
    tournament,
    finished,
    bestof: match.strategy.count,
    teams: [
      {
        name: teamA.name || "TBD",
        score: String(scoreA),
        won: wonA,
        iconPath: teamA.image ?? "",
      },
      {
        name: teamB.name || "TBD",
        score: String(scoreB),
        won: wonB,
        iconPath: teamB.image ?? "",
      },
    ],
  };
}

// The LoL Esports schedule API uses its own key (different from the Riot developer API key).
// This is the well-known public key embedded in lolesports.com.
const LOL_ESPORTS_PUBLIC_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";

export interface LolMatchResult {
  id: string;
  state: "completed" | "inProgress" | "unstarted";
  bestof: number;
  teams: Array<{ name: string; gameWins: number; outcome: "win" | "loss" | null }>;
}

export async function getLolMatchById(matchId: string): Promise<LolMatchResult | null> {
  const apiKey = process.env.LOL_ESPORTS_API_KEY ?? LOL_ESPORTS_PUBLIC_KEY;
  const url = `${LOL_API_BASE}/getEventDetails?hl=en-US&id=${matchId}`;
  const res = await fetch(url, { headers: { "x-api-key": apiKey }, cache: "no-store" });
  if (res.status === 404 || res.status === 403 || res.status === 401) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LoL Esports API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const event = json.data?.event;
  if (!event) return null;
  return {
    id: event.match.id,
    state: event.state,
    bestof: event.match.strategy.count,
    teams: (event.match.teams as LolTeam[]).map((t) => ({
      name: t.name,
      gameWins: t.result?.gameWins ?? 0,
      outcome: t.result?.outcome ?? null,
    })),
  };
}

export async function getLolSchedule(): Promise<{
  upcoming: MatchData[];
  recent: MatchData[];
}> {
  // Prefer env override; fall back to the known public key for this endpoint
  const apiKey = process.env.LOL_ESPORTS_API_KEY ?? LOL_ESPORTS_PUBLIC_KEY;

  const url = `${LOL_API_BASE}/getSchedule?hl=en-US&leagueId=${LEAGUE_IDS}`;
  const res = await fetch(url, {
    headers: { "x-api-key": apiKey },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LoL Esports API ${res.status}: ${body.slice(0, 200)}`);
  }

  const json: LolScheduleResponse = await res.json();
  const events = json.data?.schedule?.events ?? [];

  // Only process "match" type events (skip show matches, highlights, etc.)
  const matchEvents = events.filter((e) => e.type === "match");

  const recent = matchEvents
    .filter((e) => e.state === "completed")
    .map(transformLolEvent)
    .filter((m): m is MatchData => m !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const upcoming = matchEvents
    .filter((e) => e.state === "unstarted" || e.state === "inProgress")
    .map(transformLolEvent)
    .filter((m): m is MatchData => m !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  return { upcoming, recent };
}
