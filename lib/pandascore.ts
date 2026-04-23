// Server-side only — never import from Client Components.

const BASE_URL = "https://api.pandascore.co";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch with one retry on 508 (PandaScore burst/concurrent limit). */
async function pandaFetch(url: string, headers: Record<string, string>): Promise<Response> {
  let res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 508) {
    await sleep(1500);
    res = await fetch(url, { headers, cache: "no-store" });
  }
  return res;
}

export interface PandaTeam {
  id: number;
  name: string;
  image_url: string | null;
  acronym: string | null;
}

export interface PandaMatch {
  id: number;
  name: string;
  scheduled_at: string;
  status: "finished" | "running" | "not_started" | "canceled" | "postponed";
  winner_id: number | null;
  results: { team_id: number; score: number }[];
  opponents: { opponent: PandaTeam; type: string }[];
  tournament: { name: string; id: number } | null;
  league: { name: string; id: number; image_url: string | null } | null;
  number_of_games: number;
}

function getHeaders(): Record<string, string> {
  const apiKey = process.env.PANDA_TEAM_API;
  if (!apiKey) {
    throw new Error(
      "PANDA_TEAM_API is not set. Register at https://developers.pandascore.co and add it to .env.local"
    );
  }
  return { Authorization: `Bearer ${apiKey}`, Accept: "application/json" };
}

// Generic query — kept for future use
export async function pandaQuery(
  game: string,
  params: Record<string, string>
): Promise<PandaMatch[]> {
  const url = new URL(`${BASE_URL}/${game}/matches`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await pandaFetch(url.toString(), getHeaders());
  if (res.status === 404) return [];
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PandaScore HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** Upcoming + live matches — available on free tier */
export async function pandaUpcoming(game: string): Promise<PandaMatch[]> {
  const url = new URL(`${BASE_URL}/${game}/matches/upcoming`);
  url.searchParams.set("sort", "scheduled_at");
  url.searchParams.set("page[size]", "10");

  const res = await pandaFetch(url.toString(), getHeaders());
  if (res.status === 404) return [];
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PandaScore HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export interface PandaPlayer {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  nationality: string | null;
  role: string | null;
}

export interface PandaTeamDetail extends PandaTeam {
  players: PandaPlayer[];
}

/**
 * Fetch team detail with current player roster.
 * Returns null (not throws) on 404/402/403 for graceful free-tier handling.
 */
export async function pandaTeamWithPlayers(
  game: string,
  teamId: number
): Promise<PandaTeamDetail | null> {
  const url = `${BASE_URL}/${game}/teams/${teamId}`;
  const res = await pandaFetch(url, getHeaders());
  if (res.status === 404 || res.status === 402 || res.status === 403 || res.status === 508) return null;
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    throw new Error(`PandaScore ${res.status}: ${b.slice(0, 200)}`);
  }
  return res.json();
}

/** Currently running/live matches — available on free tier. */
export async function pandaRunning(game: string): Promise<PandaMatch[]> {
  const url = new URL(`${BASE_URL}/${game}/matches/running`);
  url.searchParams.set("page[size]", "5");

  const res = await pandaFetch(url.toString(), getHeaders());
  if (res.status === 404 || res.status === 402 || res.status === 403 || res.status === 508) return [];
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PandaScore HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Fetch a single match by its PandaScore ID.
 * Works on the free tier — fetching a *known* match by ID is unrestricted;
 * only the list endpoint (pandaPast) requires a paid tier.
 * Returns null on 404/402/403.
 */
export async function pandaMatchById(matchId: string): Promise<PandaMatch | null> {
  const url = `${BASE_URL}/matches/${matchId}`;
  const res = await pandaFetch(url, getHeaders());
  if (res.status === 404 || res.status === 402 || res.status === 403) {
    console.warn(`[PandaScore] /matches/${matchId} returned ${res.status} — free tier may not cover this match`);
    return null;
  }
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    throw new Error(`PandaScore ${res.status}: ${b.slice(0, 200)}`);
  }
  const data = await res.json() as PandaMatch;
  if (data.status !== "finished") {
    console.warn(`[PandaScore] match ${matchId} status="${data.status}" winner_id=${data.winner_id}`);
  }
  return data;
}

/** Past/finished matches — requires paid tier. Returns [] instead of throwing on 402/403. */
export async function pandaPast(game: string): Promise<PandaMatch[]> {
  const url = new URL(`${BASE_URL}/${game}/matches/past`);
  url.searchParams.set("sort", "-scheduled_at");
  url.searchParams.set("page[size]", "5");

  const res = await pandaFetch(url.toString(), getHeaders());
  // 402 = payment required, 403 = forbidden — free tier limitation, not an error
  if (res.status === 404 || res.status === 402 || res.status === 403 || res.status === 508) return [];
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PandaScore HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}
