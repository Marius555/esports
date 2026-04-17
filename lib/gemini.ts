// Server-side only — never import from Client Components.

import { GoogleGenAI } from "@google/genai";
import type { RecentMatchHeroData } from "@/lib/opendota";

export type { RecentMatchHeroData };

export interface GeminiQuestion {
  questionText: string;
  referenceType: "match" | "player" | "team" | "hero";
  referenceId: string;
  referenceName: string;
  referenceImageUrl: string;
}

export interface EnrichedMatchTeam {
  id: string;
  name: string;
  imageUrl: string;
  players: { name: string; role: string | null; imageUrl: string | null }[];
}

export interface EnrichedMatch {
  matchId: string;
  tournament: string;
  scheduledAt: string;
  teamA: EnrichedMatchTeam;
  teamB: EnrichedMatchTeam;
}

export interface RecentResult {
  teamA: string;
  teamAScore: string;
  teamB: string;
  teamBScore: string;
  winner: string;
  tournament: string;
  date: string;
  bestof?: number;
}

export interface TournamentInput {
  game: string;
  upcomingMatches: EnrichedMatch[];
  recentResults: RecentResult[];
  /** Dota 2 only — hero picks, bans, and player stats from recent games */
  recentHeroData?: RecentMatchHeroData[];
}

// Minimal schema — no constraints that trip Gemini's state-space limits.
// Structural correctness is enforced by the prompt.
const QUESTION_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      questionText:      { type: "STRING" },
      referenceType:     { type: "STRING" },
      referenceId:       { type: "STRING" },
      referenceName:     { type: "STRING" },
      referenceImageUrl: { type: "STRING" },
    },
    required: [
      "questionText",
      "referenceType",
      "referenceId",
      "referenceName",
      "referenceImageUrl",
    ],
  },
};

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildRecentResultsSection(results: RecentResult[]): string {
  if (results.length === 0) return "RECENT RESULTS: Not available.";
  return `RECENT RESULTS (last ${results.length} series):\n${results
    .map((r) => {
      const format = r.bestof ? ` [Bo${r.bestof}]` : "";
      return `  • ${r.winner} beat ${
        r.winner === r.teamA ? r.teamB : r.teamA
      } (${r.teamAScore}-${r.teamBScore})${format} in ${r.tournament} on ${r.date.slice(0, 10)}`;
    })
    .join("\n")}`;
}

function buildHeroSection(heroData: RecentMatchHeroData[]): string {
  if (heroData.length === 0) return "";
  const lines: string[] = ["RECENT DOTA 2 HERO PICKS (last 3 games):"];
  for (const g of heroData) {
    const winnerTeam = g.winner === "radiant" ? g.radiantTeam : g.direTeam;
    lines.push(`\nGame — ${g.radiantTeam} vs ${g.direTeam} (${winnerTeam} won):`);
    lines.push(`  ${g.radiantTeam} picks: ${g.radiantPicks.join(", ") || "unknown"}`);
    lines.push(`  ${g.direTeam} picks: ${g.direPicks.join(", ") || "unknown"}`);
    if (g.bans.length > 0) lines.push(`  Bans: ${g.bans.slice(0, 8).join(", ")}`);
    if (g.topPlayers.length > 0) {
      lines.push(
        `  Top performers: ${g.topPlayers
          .map(
            (p) =>
              `${p.name} (${p.heroName}, ${p.teamSide === "radiant" ? g.radiantTeam : g.direTeam}) ${p.kills}/${p.deaths}/${p.assists}`
          )
          .join(" | ")}`
      );
    }
  }
  return lines.join("\n");
}

function buildQuestionCategories(input: TournamentInput, deadline: string): string {
  const hasPlayers = input.upcomingMatches.some(
    (m) => m.teamA.players.length > 0 || m.teamB.players.length > 0
  );
  const hasHeroData =
    (input.recentHeroData?.length ?? 0) > 0 && hasPlayers;

  if (hasHeroData) {
    // Dota 2 — full data: match outcomes + series margins + heroes + players + streaks
    return `GENERATE EXACTLY 30 YES/NO QUESTIONS in this distribution:

[5] MATCH WINNERS
  "Will [Team A] defeat [Team B] in [Tournament]?"
  referenceType="match", referenceId=PandaScore match ID (numeric string)

[7] SERIES MARGINS — how the series plays out score-wise
  These CAN be verified from the final series scoreline.
  • "Will [Team] win their series against [Opponent] with a clean sweep?"
  • "Will [TeamA] vs [TeamB] go to a deciding Game 3?"
  • "Will [Team] win their series without dropping a single game?"
  • "Will [TeamA] vs [TeamB] go the full distance?"
  • "Will [Team] come back from a 0-1 deficit to win the series?"
  referenceType="match", referenceId=PandaScore match ID

[6] HERO PICKS & BANS — use ONLY heroes that appear in the RECENT HERO PICKS above
  These heroes are in active meta and likely to appear again.
  • "Will [hero from recent data] be picked in the [TeamA] vs [TeamB] series?"
  • "Will [frequently banned hero] be banned in the [TeamA] vs [TeamB] match?"
  • "Will [hero that carried a top performer] appear in the [TeamA] vs [TeamB] series?"
  referenceType="hero", referenceId=PandaScore match ID, referenceName=hero name

[7] PLAYER PERFORMANCE — use ONLY player names from the ROSTERS above
  • "Will [player] be the highest kill player for [Team] in their next series?"
  • "Will [player] finish with a positive kill-death ratio in [TeamA] vs [TeamB]?"
  • "Will [player] top-frag for [Team] in this week's matches?"
  • "Will [player] record more assists than kills in [TeamA] vs [TeamB]?"
  referenceType="player", referenceId=PandaScore match ID, referenceName=player name

[5] UPSETS & STREAKS — based on recent form from results above
  • "Will [team on losing streak] finally win this week?"
  • "Will [underdog] pull off an upset against [favorite]?"
  • "Will [team on win streak] maintain their unbeaten run?"
  referenceType="match" or "team"`;
  }

  if (hasPlayers) {
    // CS2 — player names available, no hero data
    return `GENERATE EXACTLY 30 YES/NO QUESTIONS in this distribution:

[5] MATCH WINNERS
  "Will [Team A] defeat [Team B] in [Tournament]?"
  referenceType="match", referenceId=PandaScore match ID

[8] SERIES MARGINS — how the series plays out score-wise
  These CAN be verified from the final series scoreline.
  • "Will [Team] win with a clean sweep (2-0)?"
  • "Will [TeamA] vs [TeamB] go to a deciding Game 3?"
  • "Will [Team] win their series without dropping a single map?"
  referenceType="match", referenceId=PandaScore match ID

[10] PLAYER PERFORMANCE — use ONLY player names and roles from the ROSTERS above
  Use player roles (AWPer, IGL, entry fragger) to make specific performance questions.
  • "Will [AWPer name] be the top fragger for [Team] in [TeamA] vs [TeamB]?"
  • "Will [player] finish with a positive kill-death ratio across the series?"
  • "Will [player] record more than 20 kills in a single map?"
  • "Will [IGL/entry] lead [Team] in total kills?"
  referenceType="player", referenceId=PandaScore match ID, referenceName=player name

[7] UPSETS, STREAKS & ADVANCEMENT — based on recent form
  • "Will [underdog] pull off an upset against [favorite]?"
  • "Will [team on losing streak] get their first win this week?"
  • "Will [team] advance to the next stage of [tournament]?"
  referenceType="match" or "team"`;
  }

  // LoL — team-level only
  return `GENERATE EXACTLY 30 YES/NO QUESTIONS in this distribution:

[5] MATCH WINNERS
  "Will [Team A] defeat [Team B] in [Tournament]?"
  referenceType="match", referenceId=match ID

[8] SERIES MARGINS — how the series plays out score-wise
  • "Will [Team] win with a clean sweep (2-0 or 3-0)?"
  • "Will [TeamA] vs [TeamB] go to a deciding final game?"
  • "Will [Team] win their series without dropping a single game?"
  referenceType="match", referenceId=match ID

[10] TEAM FORM & ADVANCEMENT
  • "Will [Team] win at least 2 matches in [tournament] this week?"
  • "Will [Team] advance to the next stage of [Tournament]?"
  • "Will [Team] avoid relegation / elimination this week?"
  • "Will [Team] end the week with a positive win-loss record?"
  referenceType="team", referenceId=team ID or "tournament"

[7] UPSETS & STREAKS — based on recent form
  • "Will [underdog] upset [favorite] in [tournament]?"
  • "Will [team on winning streak] keep their unbeaten run?"
  • "Will [team ranked lower] beat the higher-ranked team?"
  referenceType="match" or "team"`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateTournamentQuestions(
  input: TournamentInput
): Promise<GeminiQuestion[]> {
  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) throw new Error("GEMINI_KEY is not set in .env.local");

  const ai = new GoogleGenAI({ apiKey });

  const today = new Date().toISOString().slice(0, 10);
  const deadline = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString().slice(0, 10);

  const heroSection = buildHeroSection(input.recentHeroData ?? []);
  const recentSection = buildRecentResultsSection(input.recentResults);
  const categoriesSection = buildQuestionCategories(input, deadline);

  const prompt = `You are a creative esports analyst generating yes/no forecasting questions for a 7-day prediction competition.

GAME: ${input.game}
TODAY: ${today}
DEADLINE (all questions must resolve by): ${deadline}

UPCOMING MATCHES AND ROSTERS:
${JSON.stringify(input.upcomingMatches, null, 2)}

${recentSection}
${heroSection ? "\n" + heroSection : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${categoriesSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HARD RULES:
1. Every question must be answerable YES or NO — no "maybe" questions
2. All referenced events must be resolvable within 7 days (by ${deadline})
3. Player names must come ONLY from the roster data above — never invent players
4. Hero names must come ONLY from the RECENT HERO PICKS section — never invent heroes
5. referenceId: use the PandaScore or match numeric ID (as a string) for match/team/player/hero questions; use the team ID for team questions
6. referenceImageUrl: team imageUrl for team/match questions; player imageUrl for player questions; "" for hero/team questions
7. DO NOT generate more than 5 direct "Will X defeat Y?" winner questions
8. referenceType must be one of: "match", "player", "team", "hero"

Return ONLY a valid JSON array of exactly 30 objects. No prose, no markdown, no explanation.`;

  const MODELS = ["gemini-2.5-flash", "gemini-3.1-flash-lite-preview"];
  const contents = [{ role: "user" as const, parts: [{ text: prompt }] }];
  const config = {
    responseMimeType: "application/json",
    responseSchema: QUESTION_SCHEMA,
    temperature: 0.85,
  };

  let text: string | undefined;
  let lastError: unknown;

  for (const model of MODELS) {
    try {
      const result = await ai.models.generateContent({ model, contents, config });
      text = result.text ?? undefined;
      break;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (
        !msg.includes("503") &&
        !msg.includes("UNAVAILABLE") &&
        !msg.includes("high demand")
      ) {
        throw err;
      }
      console.warn(`Gemini model ${model} unavailable, trying next…`);
    }
  }

  if (!text) throw lastError ?? new Error("All Gemini models unavailable");

  const questions = JSON.parse(text) as GeminiQuestion[];
  if (!Array.isArray(questions))
    throw new Error("Gemini response is not an array");
  if (questions.length !== 30)
    throw new Error(
      `Gemini returned ${questions.length} questions, expected 30`
    );

  return questions;
}
