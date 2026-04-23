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
  referenceImageUrlB?: string;
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
      referenceName:      { type: "STRING" },
      referenceImageUrl:  { type: "STRING" },
      referenceImageUrlB: { type: "STRING" },
    },
    required: [
      "questionText",
      "referenceType",
      "referenceId",
      "referenceName",
      "referenceImageUrl",
      "referenceImageUrlB",
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

function buildFormContext(results: RecentResult[]): string {
  if (results.length === 0) return "";

  const teamRecord = new Map<string, { wins: number; losses: number; lastOpponent?: string; lastResult?: "win" | "loss" }>();
  for (const r of results) {
    const w = teamRecord.get(r.winner) ?? { wins: 0, losses: 0 };
    w.wins++;
    w.lastOpponent = r.winner === r.teamA ? r.teamB : r.teamA;
    w.lastResult = "win";
    teamRecord.set(r.winner, w);

    const loser = r.winner === r.teamA ? r.teamB : r.teamA;
    const l = teamRecord.get(loser) ?? { wins: 0, losses: 0 };
    l.losses++;
    l.lastOpponent = r.winner;
    l.lastResult = "loss";
    teamRecord.set(loser, l);
  }

  const lines: string[] = ["CURRENT FORM (use this for form/streak questions):"];
  for (const [team, rec] of teamRecord.entries()) {
    if (rec.wins >= 2) lines.push(`  • ${team} is on a ${rec.wins}-win streak`);
    else if (rec.losses >= 2) lines.push(`  • ${team} has lost ${rec.losses} series in a row`);
    else if (rec.lastResult === "loss") lines.push(`  • ${team} lost their most recent series vs ${rec.lastOpponent}`);
    else if (rec.lastResult === "win") lines.push(`  • ${team} won their most recent series vs ${rec.lastOpponent}`);
  }
  return lines.length > 1 ? lines.join("\n") : "";
}

function buildQuestionCategories(input: TournamentInput): string {
  const hasPlayers = input.upcomingMatches.some(
    (m) => m.teamA.players.length > 0 || m.teamB.players.length > 0
  );
  const hasHeroData =
    (input.recentHeroData?.length ?? 0) > 0 && hasPlayers;

  if (hasHeroData) {
    // Dota 2 — full data: heroes + players + form
    return `GENERATE EXACTLY 20 YES/NO QUESTIONS in this distribution:

[3] MATCH WINNERS — include tournament name and context
  • "Will [Team] defeat [Opponent] in [Tournament]?"
  • "Will [underdog team] upset [favored team] in [Tournament]?"
  referenceType="match", referenceId=PandaScore match ID (numeric string)

[3] SERIES MARGINS — verifiable from final scoreline
  • "Will [Team] sweep [Opponent] 2-0 in [Tournament]?"
  • "Will [TeamA] vs [TeamB] go to a deciding Game 3?"
  • "Will [Team] win their series without dropping a single game?"
  referenceType="match", referenceId=PandaScore match ID

[4] HERO META — ONLY heroes from RECENT HERO PICKS above (never invent heroes)
  • "Will [hero seen in recent games] be picked in the [TeamA] vs [TeamB] draft?"
  • "Will [hero that was banned repeatedly] appear in the [TeamA] vs [TeamB] series?"
  • "Will the hero [player] played to a top KDA recently be picked again in [TeamA] vs [TeamB]?"
  referenceType="hero", referenceId=PandaScore match ID, referenceName=hero name

[5] PLAYER PERFORMANCE — ONLY player names from ROSTERS above
  • "Will [player] be the highest-networth hero in [TeamA] vs [TeamB]?"
  • "Will [player] finish with a positive KDA in [TeamA] vs [TeamB]?"
  • "Will [player] record more assists than kills in [TeamA] vs [TeamB]?"
  • "Will [player] lead their team in kills in the decisive game of [TeamA] vs [TeamB]?"
  referenceType="player", referenceId=PandaScore match ID, referenceName=player name

[3] CURRENT FORM — use FORM CONTEXT above; these require knowing current state, making them hard to cheat with AI
  • "Will [team on win streak] keep their run going against [Opponent]?"
  • "Will [team who just lost] bounce back with a win against [Opponent]?"
  • "Will [team who previously lost to this same opponent] get their revenge this week?"
  referenceType="match", referenceId=PandaScore match ID

[2] IN-GAME EVENTS — specific events that require watching the match
  • "Will a Roshan fight occur before 25 minutes in the [TeamA] vs [TeamB] series?"
  • "Will [Team] end a game in under 35 minutes in [TeamA] vs [TeamB]?"
  • "Will the team that gets the first Roshan go on to win that game in [TeamA] vs [TeamB]?"
  referenceType="match", referenceId=PandaScore match ID`;
  }

  if (hasPlayers) {
    // CS2 and Valorant — player rosters available
    const isValorant = input.game === "valorant";
    const mapWord = "map";
    const gameLabel = isValorant ? "Valorant" : "CS2";
    const roles = isValorant
      ? "(duelist, sentinel, initiator, controller, IGL)"
      : "(AWPer, IGL, entry fragger, rifler, lurker)";

    return `GENERATE EXACTLY 20 YES/NO QUESTIONS in this distribution:

[3] MATCH WINNERS — include tournament name
  • "Will [Team] defeat [Opponent] in [Tournament]?"
  referenceType="match", referenceId=PandaScore match ID

[3] SERIES MARGINS — verifiable from final scoreline
  • "Will [Team] sweep [Opponent] without dropping a ${mapWord} (2-0)?"
  • "Will [TeamA] vs [TeamB] go to a deciding third ${mapWord}?"
  • "Will [Team] win their series without dropping a single ${mapWord}?"
  referenceType="match", referenceId=PandaScore match ID

[5] PLAYER PERFORMANCE — ONLY player names and roles from ROSTERS above
  Use roles ${roles} for specificity.
  • "Will [player role] be the highest-rated player for [Team] in [TeamA] vs [TeamB]?"
  • "Will [player] finish with a positive K/D ratio across all ${mapWord}s in [TeamA] vs [TeamB]?"
  • "Will [player] lead [Team] in total kills in the [TeamA] vs [TeamB] series?"
  • "Will [player] record more than 25 kills in a single ${mapWord} of [TeamA] vs [TeamB]?"
  referenceType="player", referenceId=PandaScore match ID, referenceName=player name

[3] ROUND EVENTS — specific in-match events, hard to predict from historical stats alone
  • "Will the team that wins the pistol round on ${mapWord} 1 of [TeamA] vs [TeamB] go on to win that ${mapWord}?"
  • "Will [TeamA] vs [TeamB] feature a ${mapWord} that goes to overtime?"
  • "Will [Team] win an eco round during the [TeamA] vs [TeamB] series?"
  referenceType="match", referenceId=PandaScore match ID

[3] CURRENT FORM — use FORM CONTEXT above; require knowing real-time standings, hard to cheat with AI
  • "Will [team on win streak] stay undefeated in [TeamA] vs [TeamB]?"
  • "Will [team who just lost] recover with a win against [Opponent] this week?"
  • "Will [team who swept their last opponent] sweep again in [TeamA] vs [TeamB]?"
  referenceType="match", referenceId=PandaScore match ID

[3] UPSETS & ADVANCEMENT
  • "Will [underdog] pull off an upset against [favorite] in [Tournament]?"
  • "Will [lower-ranked team] take at least one ${mapWord} off [higher-ranked team]?"
  • "Will [team] advance to the next stage of [Tournament] this week?"
  referenceType="match", referenceId=PandaScore match ID

Note: This is ${gameLabel} — use correct terminology (${mapWord}s, rounds, ${isValorant ? "agents" : "rifles/AWP"}).`;
  }

  // Fallback: team-level only (no player data available)
  return `GENERATE EXACTLY 20 YES/NO QUESTIONS in this distribution:

[3] MATCH WINNERS
  • "Will [Team A] defeat [Team B] in [Tournament]?"
  referenceType="match", referenceId=match ID

[5] SERIES MARGINS
  • "Will [Team] win with a clean sweep?"
  • "Will [TeamA] vs [TeamB] go to a deciding final game?"
  • "Will [Team] win their series without dropping a single game?"
  referenceType="match", referenceId=match ID

[6] MATCH CONTEXT — tie to specific upcoming matches
  • "Will [lower-seeded Team] avoid a sweep in [TeamA] vs [TeamB]?"
  • "Will [Team] win despite having lost their previous series?"
  • "Will [favorite Team] win [TeamA] vs [TeamB] without dropping a game?"
  referenceType="match", referenceId=match ID

[3] CURRENT FORM — use FORM CONTEXT, hard to cheat with AI
  • "Will [team on streak] extend their run in [TeamA] vs [TeamB]?"
  • "Will [team who just lost] bounce back with a win?"
  referenceType="match", referenceId=match ID

[3] UPSETS & STREAKS
  • "Will [underdog] upset [favorite] in [TeamA] vs [TeamB]?"
  • "Will [team ranked lower] beat the higher-ranked team in [Tournament]?"
  referenceType="match", referenceId=match ID

CRITICAL RULE: Do NOT use referenceType="team". ALL 20 questions must use referenceType="match".`;
}

// ─── Question resolver ────────────────────────────────────────────────────────

const RESOLVE_SCHEMA = {
  type: "OBJECT",
  properties: {
    answer: { type: "BOOLEAN" },
  },
  required: ["answer"],
};

/**
 * Ask Gemini to resolve a yes/no forecasting question given match result data.
 * Used as fallback when regex-based resolution can't determine the answer.
 */
export async function resolveQuestionWithGemini(
  questionText: string,
  matchSummary: string
): Promise<boolean | null> {
  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are resolving a yes/no esports forecasting question based on a match result.

MATCH RESULT: ${matchSummary}

QUESTION: ${questionText}

Answer true if the question's condition was met, false if it was not. Base your answer ONLY on the match result provided. If the match result does not contain enough information to answer, still give your best guess.

Return JSON: { "answer": true } or { "answer": false }`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: RESOLVE_SCHEMA,
        temperature: 0.1,
      },
    });
    const text = result.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as { answer: boolean };
    return typeof parsed.answer === "boolean" ? parsed.answer : null;
  } catch {
    return null;
  }
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
  const formSection = buildFormContext(input.recentResults);
  const categoriesSection = buildQuestionCategories(input);

  const prompt = `You are a creative esports analyst generating yes/no forecasting questions for a 7-day prediction competition.

GAME: ${input.game}
TODAY: ${today}
DEADLINE (all questions must resolve by): ${deadline}

UPCOMING MATCHES AND ROSTERS:
${JSON.stringify(input.upcomingMatches, null, 2)}

${recentSection}
${heroSection ? "\n" + heroSection : ""}
${formSection ? "\n" + formSection : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${categoriesSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HARD RULES:
1. Every question must be answerable YES or NO — no "maybe" questions
2. All referenced events must be resolvable within 7 days (by ${deadline})
3. Player names must come ONLY from the roster data above — never invent players
4. Hero names must come ONLY from the RECENT HERO PICKS section — never invent heroes
5. referenceId: use the PandaScore or match numeric ID (as a string) for match/team/player/hero questions; use the team ID for team questions
6. referenceImageUrl: teamA.imageUrl for match questions; team imageUrl for team questions; player imageUrl for player questions; "" for hero questions
   referenceImageUrlB: teamB.imageUrl for match questions (the OPPONENT team's imageUrl); "" for all other referenceTypes
7. DO NOT generate more than 3 direct "Will X defeat Y?" winner questions
8. referenceType must be one of: "match", "player", "team", "hero"

Return ONLY a valid JSON array of exactly 20 objects. No prose, no markdown, no explanation.`;

  // Primary: gemini-3.1-flash-lite-preview (500 RPD free tier)
  // Fallback: gemini-2.5-flash (lower RPD, higher quality)
  const MODELS = ["gemini-3.1-flash-lite-preview", "gemini-2.5-flash"];
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
      console.log(`[Gemini] Trying model: ${model}`);
      const result = await ai.models.generateContent({ model, contents, config });
      console.log(`[Gemini] Success with model: ${model}`);
      text = result.text ?? undefined;
      break;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable =
        msg.includes("503") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("high demand") ||
        msg.includes("429") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("quota");
      if (!isRetryable) throw err;
      console.warn(`[Gemini] Model ${model} unavailable/quota exceeded, trying next…`);
    }
  }

  if (!text) throw lastError ?? new Error("All Gemini models unavailable");

  const questions = JSON.parse(text) as GeminiQuestion[];
  if (!Array.isArray(questions))
    throw new Error("Gemini response is not an array");
  if (questions.length !== 20)
    throw new Error(
      `Gemini returned ${questions.length} questions, expected 20`
    );

  return questions;
}
