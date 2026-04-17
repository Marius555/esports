// Server-side only — OpenDota public API, no API key required.
// Provides recent professional Dota 2 match results for free.

import type { MatchData } from "@/app/api/matches/[game]/route";

interface OpenDotaProMatch {
  match_id: number;
  start_time: number; // Unix timestamp
  series_id: number;
  series_type: number; // 0=Bo1 1=Bo3 2=Bo5
  radiant_name: string | null;
  dire_name: string | null;
  radiant_win: boolean;
  league_name: string | null;
}

interface OpenDotaMatchDetail {
  match_id: number;
  radiant_win: boolean;
  picks_bans: {
    is_pick: boolean;
    hero_id: number;
    team: number; // 0=radiant, 1=dire
    order: number;
  }[] | null;
  players: {
    player_slot: number; // 0-4=radiant, 128-132=dire
    account_id: number;
    name: string | null;       // pro player name (null if not in DB)
    personaname: string | null; // Steam name
    hero_id: number;
    kills: number;
    deaths: number;
    assists: number;
  }[];
}

export interface RecentMatchHeroData {
  radiantTeam: string;
  direTeam: string;
  winner: "radiant" | "dire";
  radiantPicks: string[];
  direPicks: string[];
  bans: string[];
  topPlayers: {
    name: string;
    teamSide: "radiant" | "dire";
    heroName: string;
    kills: number;
    deaths: number;
    assists: number;
  }[];
}

function bestofFromSeriesType(t: number): number {
  if (t === 1) return 3;
  if (t === 2) return 5;
  return 1;
}

// ─── Hero name lookup ─────────────────────────────────────────────────────────

async function fetchHeroNames(): Promise<Map<number, string>> {
  try {
    const res = await fetch("https://api.opendota.com/api/constants/heroes", {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 }, // cache 24 h — heroes rarely change
    });
    if (!res.ok) return new Map();
    const data = (await res.json()) as Record<
      string,
      { id: number; localized_name: string }
    >;
    return new Map(Object.values(data).map((h) => [h.id, h.localized_name]));
  } catch {
    return new Map();
  }
}

async function fetchMatchDetail(
  matchId: number
): Promise<OpenDotaMatchDetail | null> {
  try {
    const res = await fetch(
      `https://api.opendota.com/api/matches/${matchId}`,
      { headers: { Accept: "application/json" }, cache: "no-store" }
    );
    if (!res.ok) return null;
    return (await res.json()) as OpenDotaMatchDetail;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch recent professional Dota 2 series results from OpenDota.
 * Groups individual games into series (e.g. Team Spirit 2-1 Liquid).
 * Returns up to 5 series sorted newest first.
 */
export async function getDota2RecentSeries(): Promise<MatchData[]> {
  const res = await fetch("https://api.opendota.com/api/proMatches", {
    headers: { Accept: "application/json" },
    // Cache 5 min — past results don't change
    next: { revalidate: 300 },
  });

  if (!res.ok) throw new Error(`OpenDota HTTP ${res.status}`);

  const matches: OpenDotaProMatch[] = await res.json();

  // Group individual games into series
  // series_id === 0 means standalone — treat each game as its own "series"
  const seriesMap = new Map<
    number,
    { games: OpenDotaProMatch[]; key: number }
  >();

  for (const m of matches) {
    const key = m.series_id > 0 ? m.series_id : m.match_id;
    if (!seriesMap.has(key)) seriesMap.set(key, { games: [], key });
    seriesMap.get(key)!.games.push(m);
  }

  const results: MatchData[] = [];

  for (const { games } of seriesMap.values()) {
    const first = games[0];
    if (!first) continue;

    const radiantWins = games.filter((g) => g.radiant_win).length;
    const direWins = games.filter((g) => !g.radiant_win).length;
    const radiantWon = radiantWins > direWins;

    const teamA = first.radiant_name || "Unknown";
    const teamB = first.dire_name || "Unknown";

    results.push({
      matchId: String(first.series_id > 0 ? first.series_id : first.match_id),
      date: new Date(first.start_time * 1000).toISOString(),
      tournament: first.league_name || "",
      finished: true,
      bestof: bestofFromSeriesType(first.series_type),
      teams: [
        {
          name: teamA,
          score: String(radiantWins),
          won: radiantWon,
          iconPath: "",
        },
        {
          name: teamB,
          score: String(direWins),
          won: !radiantWon,
          iconPath: "",
        },
      ],
    });
  }

  // Newest series first, cap at 5
  return results
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
}

/**
 * Fetch hero picks, bans, and top player stats for the 3 most recent pro
 * Dota 2 games. Used to enrich the Gemini prompt with hero pool context.
 * Returns [] silently on any failure — this data is optional enrichment.
 */
export async function getDota2RecentHeroContext(): Promise<
  RecentMatchHeroData[]
> {
  // Fetch proMatches (same URL as getDota2RecentSeries — Next.js deduplicates)
  let rawMatches: OpenDotaProMatch[] = [];
  try {
    const res = await fetch("https://api.opendota.com/api/proMatches", {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (res.ok) rawMatches = (await res.json()) as OpenDotaProMatch[];
  } catch {
    return [];
  }

  // Individual game match_ids — these are Valve game IDs, usable by OpenDota
  const sampleIds = rawMatches.slice(0, 3).map((m) => m.match_id);

  // Fetch hero names + match details in parallel
  const [heroNames, detailResults] = await Promise.all([
    fetchHeroNames(),
    Promise.all(sampleIds.map((id) => fetchMatchDetail(id))),
  ]);

  const results: RecentMatchHeroData[] = [];

  for (let i = 0; i < detailResults.length; i++) {
    const detail = detailResults[i];
    const meta = rawMatches[i];
    if (!detail || !meta) continue;

    const radiantTeam = meta.radiant_name ?? "Radiant";
    const direTeam = meta.dire_name ?? "Dire";
    const winner: "radiant" | "dire" = detail.radiant_win ? "radiant" : "dire";

    const radiantPicks: string[] = [];
    const direPicks: string[] = [];
    const bans: string[] = [];

    for (const pb of detail.picks_bans ?? []) {
      const heroName =
        heroNames.get(pb.hero_id) ?? `Hero#${pb.hero_id}`;
      if (!pb.is_pick) {
        bans.push(heroName);
      } else if (pb.team === 0) {
        radiantPicks.push(heroName);
      } else {
        direPicks.push(heroName);
      }
    }

    const topPlayers = detail.players
      .map((p) => ({
        name: p.name ?? p.personaname ?? `Slot${p.player_slot}`,
        teamSide: (p.player_slot < 128 ? "radiant" : "dire") as
          | "radiant"
          | "dire",
        heroName: heroNames.get(p.hero_id) ?? `Hero#${p.hero_id}`,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
      }))
      .sort((a, b) => b.kills + b.assists - (a.kills + a.assists))
      .slice(0, 5);

    results.push({
      radiantTeam,
      direTeam,
      winner,
      radiantPicks,
      direPicks,
      bans,
      topPlayers,
    });
  }

  return results;
}
