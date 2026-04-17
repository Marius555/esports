# Liquipedia Cargo — Project Examples

These are ready-to-paste TypeScript implementations for the esports2026 Next.js project.

## 1. `lib/liquipedia.ts` — Low-level client

```typescript
// lib/liquipedia.ts
// Server-side only. Never import from Client Components.

const RATE_LIMIT_MS = 2100;
let lastRequestAt = 0;

const USER_AGENT =
  "EsportsOracle/1.0 (https://esports2026.com; contact@esports2026.com)";

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const headers = {
    "User-Agent": USER_AGENT,
    "Accept-Encoding": "gzip",
  };

  let res = await fetch(url, { headers });

  if (res.status === 429 || res.status === 503) {
    await new Promise((r) => setTimeout(r, 10_000));
    res = await fetch(url, { headers });
  }

  if (!res.ok) throw new Error(`Liquipedia HTTP ${res.status}: ${url}`);
  return res;
}

export interface CargoQueryParams {
  tables: string;
  fields?: string;
  where?: string;
  join_on?: string;
  order_by?: string;
  limit?: number;
  offset?: number;
  group_by?: string;
  having?: string;
}

export type CargoRow = Record<string, string>;

export async function cargoQuery(
  game: string,
  params: CargoQueryParams
): Promise<CargoRow[]> {
  const url = new URL(`https://liquipedia.net/${game}/api.php`);
  url.searchParams.set("action", "cargoquery");
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const res = await rateLimitedFetch(url.toString());
  const data = await res.json();

  if ("error" in data) {
    throw new Error(
      `Liquipedia Cargo error [${data.error.code}]: ${data.error.info}`
    );
  }

  return (data.cargoquery ?? []).map(
    (row: { title: CargoRow }) => row.title
  );
}

/** Fetch all pages automatically. Use only for small datasets (< 1000 rows). */
export async function cargoQueryAll(
  game: string,
  params: Omit<CargoQueryParams, "offset">
): Promise<CargoRow[]> {
  const PAGE_SIZE = 100;
  const all: CargoRow[] = [];
  let offset = 0;

  while (true) {
    const page = await cargoQuery(game, { ...params, limit: PAGE_SIZE, offset });
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}
```

---

## 2. `app/actions/matches.ts` — Server Action: sync recent CS2 matches

```typescript
// app/actions/matches.ts
"use server";

import { cargoQuery } from "@/lib/liquipedia";
import { createAdminClient, DB_ID, MATCHES_TABLE_ID } from "@/lib/appwrite";
import { Query } from "node-appwrite";

interface MatchRow {
  matchId: string;
  game: string;
  teamA: string;
  teamB: string;
  scoreA: string;
  scoreB: string;
  startTime: string;
  status: "upcoming" | "live" | "finished";
  winnerTeam: string;
  tournament: string;
  syncedAt: string;
}

/** Fetch recent or upcoming CS2 matches and upsert into Appwrite. */
export async function syncCS2Matches(): Promise<{
  success: boolean;
  synced: number;
  error?: string;
}> {
  try {
    const rows = await cargoQuery("counterstrike", {
      tables: "Match2,Match2opponent",
      fields: [
        "Match2.match2id",
        "Match2.date",
        "Match2.winner",
        "Match2.finished",
        "Match2.tournament",
        "Match2opponent.name",
        "Match2opponent.score",
        "Match2opponent.placement",
      ].join(","),
      join_on: "Match2.match2id=Match2opponent.match2id",
      // last 7 days + upcoming 7 days
      where: "Match2.date BETWEEN DATE_SUB(NOW(), INTERVAL 7 DAY) AND DATE_ADD(NOW(), INTERVAL 7 DAY)",
      order_by: "Match2.date DESC",
      limit: 200,
    });

    // Group opponents by match2id (two rows per match from the join)
    const matchMap = new Map<string, CargoGroupedMatch>();
    for (const row of rows) {
      const id = row["Match2 match2id"];
      if (!matchMap.has(id)) {
        matchMap.set(id, {
          matchId: id,
          date: row["Match2 date"],
          winner: row["Match2 winner"],
          finished: row["Match2 finished"],
          tournament: row["Match2 tournament"],
          opponents: [],
        });
      }
      matchMap.get(id)!.opponents.push({
        name: row["Match2opponent name"],
        score: row["Match2opponent score"],
        placement: row["Match2opponent placement"],
      });
    }

    const { databases } = await createAdminClient();
    let synced = 0;

    for (const match of matchMap.values()) {
      if (match.opponents.length < 2) continue;

      const [oppA, oppB] = match.opponents;
      const status =
        match.finished === "1"
          ? "finished"
          : new Date(match.date) <= new Date()
          ? "live"
          : "upcoming";

      const winnerTeam =
        match.winner === "1"
          ? oppA.name
          : match.winner === "2"
          ? oppB.name
          : "";

      const doc: Omit<MatchRow, "matchId"> = {
        game: "CS2",
        teamA: oppA.name,
        teamB: oppB.name,
        scoreA: oppA.score || "0",
        scoreB: oppB.score || "0",
        startTime: match.date,
        status,
        winnerTeam,
        tournament: match.tournament,
        syncedAt: new Date().toISOString(),
      };

      // upsert — Appwrite createDocument throws on duplicate, updateDocument on missing
      try {
        await databases.updateDocument(
          DB_ID,
          MATCHES_TABLE_ID,
          match.matchId,
          doc
        );
      } catch {
        await databases.createDocument(
          DB_ID,
          MATCHES_TABLE_ID,
          match.matchId,
          doc
        );
      }
      synced++;
    }

    return { success: true, synced };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, synced: 0, error: message };
  }
}

interface CargoGroupedMatch {
  matchId: string;
  date: string;
  winner: string;
  finished: string;
  tournament: string;
  opponents: { name: string; score: string; placement: string }[];
}

/** Check Appwrite cache; only call Liquipedia if stale. */
export async function getMatchesWithCache(
  game: "CS2" | "LoL"
): Promise<MatchRow[]> {
  const { databases } = await createAdminClient();

  const STALE_MINUTES = 5;
  const staleThreshold = new Date(
    Date.now() - STALE_MINUTES * 60 * 1000
  ).toISOString();

  const cached = await databases.listDocuments(DB_ID, MATCHES_TABLE_ID, [
    Query.equal("game", game),
    Query.orderDesc("startTime"),
    Query.limit(50),
  ]);

  const needsSync =
    cached.documents.length === 0 ||
    cached.documents.some(
      (d) =>
        d.status !== "finished" &&
        (d.syncedAt as string) < staleThreshold
    );

  if (needsSync) {
    if (game === "CS2") await syncCS2Matches();
    // Add LoL sync here when needed
  }

  const fresh = await databases.listDocuments(DB_ID, MATCHES_TABLE_ID, [
    Query.equal("game", game),
    Query.orderDesc("startTime"),
    Query.limit(50),
  ]);

  return fresh.documents as unknown as MatchRow[];
}
```

---

## 3. Upcoming matches component (Server Component)

```typescript
// app/matches/page.tsx  (Server Component)
import { getMatchesWithCache } from "@/app/actions/matches";

export default async function MatchesPage() {
  const matches = await getMatchesWithCache("CS2");

  return (
    <main>
      <h1>CS2 Matches</h1>
      <ul>
        {matches.map((m) => (
          <li key={m.matchId}>
            {m.teamA} vs {m.teamB} — {m.status}
            {m.winnerTeam ? ` — Winner: ${m.winnerTeam}` : ""}
          </li>
        ))}
      </ul>

      {/* Required attribution */}
      <p className="text-xs text-muted-foreground mt-8">
        Data from{" "}
        <a
          href="https://liquipedia.net"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Liquipedia
        </a>{" "}
        licensed under{" "}
        <a
          href="https://creativecommons.org/licenses/by-sa/3.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          CC BY-SA 3.0
        </a>
      </p>
    </main>
  );
}
```

---

## 4. Manual test (run in Bash to verify API is reachable)

```bash
curl -s \
  -H "User-Agent: EsportsOracle/1.0 (https://esports2026.com; contact@esports2026.com)" \
  -H "Accept-Encoding: gzip" \
  "https://liquipedia.net/counterstrike/api.php?action=cargoquery&format=json&tables=Match2&fields=Match2.match2id,Match2.date,Match2.winner,Match2.finished&limit=2&order_by=Match2.date%20DESC" \
  | python -m json.tool
```

Expected response shape:
```json
{
  "cargoquery": [
    { "title": { "match2id": "...", "date": "...", "winner": "1", "finished": "1" } },
    { "title": { "match2id": "...", "date": "...", "winner": "2", "finished": "1" } }
  ]
}
```

---

## 5. Getting team history for AI (Gemini) context

```typescript
// Build a summary string for the Gemini prompt
export async function getTeamRecentForm(
  game: string,
  teamName: string,
  lastN = 10
): Promise<string> {
  const rows = await cargoQuery(game, {
    tables: "Match2,Match2opponent",
    fields:
      "Match2.date,Match2.winner,Match2opponent.name,Match2opponent.placement,Match2opponent.score",
    join_on: "Match2.match2id=Match2opponent.match2id",
    where: `Match2opponent.name='${teamName.replace(/'/g, "\\'")}' AND Match2.finished='1'`,
    order_by: "Match2.date DESC",
    limit: lastN * 2, // two rows per match (one per opponent)
  });

  // Pick only the rows for THIS team (the join returns both opponents)
  const teamRows = rows.filter((r) => r["Match2opponent name"] === teamName);

  return teamRows
    .map((r) => {
      const won = r["Match2opponent placement"] === "1";
      return `${r["Match2 date"].slice(0, 10)}: ${won ? "WIN" : "LOSS"} (${r["Match2opponent score"]} maps)`;
    })
    .join("\n");
}
```
