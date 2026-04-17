// Server-side only — import only in Server Actions or Route Handlers
// Fetches Valorant match data from vlrggapi (scraper of vlr.gg)
import type { MatchData } from "@/app/api/matches/[game]/route";

const VLR_API_BASE = "https://vlrggapi.vercel.app";

interface VlrResultSegment {
  team1: string;
  team2: string;
  score1: string;
  score2: string;
  time_completed: string;
  round_info: string;
  tournament_name: string;
  match_page: string;
  match_id: string;
}

interface VlrUpcomingSegment {
  team1: string;
  team2: string;
  time: string;
  match_series: string;
  match_event: string;
  unix_timestamp: string;
  match_page: string;
  match_id: string;
}

interface VlrResponse<T> {
  status: string;
  data: {
    status: number;
    segments: T[];
  };
}

function transformVlrResult(seg: VlrResultSegment, idx: number): MatchData {
  const score1 = parseInt(seg.score1, 10) || 0;
  const score2 = parseInt(seg.score2, 10) || 0;
  return {
    matchId: seg.match_id || String(idx),
    date: new Date().toISOString(),
    tournament: seg.tournament_name || seg.round_info || "",
    finished: true,
    bestof: 3,
    teams: [
      { name: seg.team1 || "TBD", score: String(score1), won: score1 > score2, iconPath: "" },
      { name: seg.team2 || "TBD", score: String(score2), won: score2 > score1, iconPath: "" },
    ],
  };
}

function transformVlrUpcoming(seg: VlrUpcomingSegment, idx: number): MatchData {
  const ts = seg.unix_timestamp
    ? parseInt(seg.unix_timestamp, 10) * 1000
    : Date.now();
  return {
    matchId: seg.match_id || String(idx),
    date: new Date(ts).toISOString(),
    tournament: seg.match_event || seg.match_series || "",
    finished: false,
    bestof: 3,
    teams: [
      { name: seg.team1 || "TBD", score: "0", won: false, iconPath: "" },
      { name: seg.team2 || "TBD", score: "0", won: false, iconPath: "" },
    ],
  };
}

export async function getValorantMatches(): Promise<{
  upcoming: MatchData[];
  recent: MatchData[];
}> {
  const [resultsRes, upcomingRes] = await Promise.allSettled([
    fetch(`${VLR_API_BASE}/v2/match?q=results`, { next: { revalidate: 180 } }),
    fetch(`${VLR_API_BASE}/v2/match?q=upcoming`, { next: { revalidate: 180 } }),
  ]);

  let recent: MatchData[] = [];
  if (resultsRes.status === "fulfilled" && resultsRes.value.ok) {
    try {
      const json: VlrResponse<VlrResultSegment> = await resultsRes.value.json();
      recent = (json.data?.segments ?? [])
        .slice(0, 5)
        .map((seg, idx) => transformVlrResult(seg, idx));
    } catch {
      // fallback to empty on parse error
    }
  }

  let upcoming: MatchData[] = [];
  if (upcomingRes.status === "fulfilled" && upcomingRes.value.ok) {
    try {
      const json: VlrResponse<VlrUpcomingSegment> = await upcomingRes.value.json();
      upcoming = (json.data?.segments ?? [])
        .slice(0, 5)
        .map((seg, idx) => transformVlrUpcoming(seg, idx));
    } catch {
      // fallback to empty on parse error
    }
  }

  return { recent, upcoming };
}
