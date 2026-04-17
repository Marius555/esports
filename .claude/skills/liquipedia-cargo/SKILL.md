---
name: liquipedia-cargo
description: "IMPORTANT: Liquipedia does NOT have action=cargoquery. They use a custom LiquipediaDB extension. v3 REST API at api.liquipedia.net requires a login account. For CS2/Dota2, use PandaScore (lib/pandascore.ts) instead. Liquipedia v3 is only needed for games PandaScore doesn't cover (Fortnite, niche games)."
allowed-tools: Bash, WebFetch, Read, Edit, Write
---

# Liquipedia API Skill

## CRITICAL: What Actually Works (verified April 2026)

**`action=cargoquery` does NOT exist on Liquipedia.** Liquipedia uses a custom `LiquipediaDB` extension — NOT the standard MediaWiki Cargo extension. Any code using `action=cargoquery` will receive `{"error":{"code":"badvalue","info":"Unrecognized value for parameter \"action\": cargoquery."}}`.

**Use PandaScore (`lib/pandascore.ts`) for CS2 and Dota2.** Liquipedia v3 is only needed for games PandaScore doesn't cover.

### What IS available on Liquipedia:

1. **v3 REST API** at `https://api.liquipedia.net/api/v3/`
   - Requires a user account (register/login at `https://api.liquipedia.net/login`)
   - Auth header: `Authorization: Apikey {your_key}`
   - Endpoints: `/match?wiki={game}&limit=N`, `/tournament?wiki={game}`, `/team?wiki={game}`
   - Response: `{"result": [...], "error": []}`

2. **MediaWiki `action=parse`** (no auth, but 30s rate limit — too slow for real-time)

3. **MediaWiki `action=query`** (standard pages/content, 2s rate limit)

## v3 REST API (when the user has an account)

### Rate Limit Rules
Same as before: 1 req/2s, custom User-Agent, gzip. See lib/liquipedia.ts for the rate-limited fetch helper (update it to use v3 format).

### v3 Auth Header
```
Authorization: Apikey {LIQUIPEDIA_API_KEY}
```
Store as `LIQUIPEDIA_API_KEY` in `.env.local`.

### v3 Base URL & Endpoints
```
GET https://api.liquipedia.net/api/v3/match?wiki={game}&limit=10
GET https://api.liquipedia.net/api/v3/tournament?wiki={game}&limit=10
GET https://api.liquipedia.net/api/v3/team?wiki={game}&limit=10
```

### v3 Game Slugs (wiki parameter)
Same as before: `dota2`, `counterstrike`, `valorant`, `leagueoflegends`, `fortnite`, `rocketleague`

### v3 Query Parameters (match endpoint)
- `wiki` — required, game slug
- `limit` — max results per page (default 10, max 1000)
- `page` — pagination offset
- `conditions` — SQL-like filter e.g. `[[status::finished]]`
- `order` — sort field

### v3 Response Format
```json
{
  "result": [
    {
      "match2id": "...",
      "date": "2026-04-14 18:00:00",
      "match2opponents": [...],
      "winner": 1,
      "finished": 1,
      "tournament": "..."
    }
  ],
  "error": []
}
```

## Purpose

Use this skill whenever the user asks to fetch, sync, or query esports match data, tournament results, team records, or standings from Liquipedia. This covers:

- Recent or upcoming match results (CS2, Dota 2, Valorant, LoL, etc.)
- Tournament bracket/standings data
- Team win/loss history for AI prediction context
- Syncing Liquipedia data into the Appwrite `Matches` table

## Hard Rules — Follow Every Time

These are non-negotiable. Violating them causes IP bans.

1. **Rate limit: max 1 request per 2 seconds.** Always enforce a 2100ms gap between requests (2000ms + 100ms safety buffer).
2. **Custom User-Agent required.** Every request must set:
   ```
   User-Agent: EsportsOracle/1.0 (https://esports2026.com; contact@esports2026.com)
   ```
3. **Accept gzip.** Set `Accept-Encoding: gzip`. Node's native `fetch` handles decompression automatically when this header is present.
4. **Server-side only.** Never call this API from a Client Component. Use Server Actions or Route Handlers.
5. **Cache immediately.** After every successful fetch, upsert results into Appwrite. Do not call the API twice for the same data.
6. **Attribution.** Any page that displays Liquipedia data must include: *"Data from [Liquipedia](https://liquipedia.net) (CC BY-SA 3.0)"*

---

## Base URL

```
https://liquipedia.net/{game}/api.php
```

### Game Slugs

| Slug | Game |
|------|------|
| `counterstrike` | Counter-Strike (CS:GO / CS2) |
| `dota2` | Dota 2 |
| `valorant` | VALORANT |
| `leagueoflegends` | League of Legends |
| `rocketleague` | Rocket League |
| `overwatch` | Overwatch |
| `pubg` | PUBG |
| `rainbowsix` | Rainbow Six Siege |
| `starcraft2` | StarCraft II |

---

## Cargo Query Parameters

All requests use `action=cargoquery&format=json` plus these parameters:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `tables` | yes | Comma-separated Cargo table names |
| `fields` | recommended | Comma-separated fields; prefix with `TableName.` when joining |
| `where` | no | SQL WHERE clause (see syntax below) |
| `join_on` | no | LEFT OUTER JOIN condition |
| `order_by` | no | Defaults to `_pageName ASC` |
| `limit` | no | Max rows per request. Use 100–500. Hard max: 5000 |
| `offset` | no | Row offset for pagination |
| `group_by` | no | GROUP BY fields |
| `having` | no | HAVING clause (use with group_by) |

### WHERE Clause Operators

```sql
=  !=  <  >  <=  >=
AND  OR  NOT
LIKE '%pattern%'
IN ('val1','val2')
HOLDS 'value'          -- search inside array fields
HOLDS LIKE '%pattern%'
YEAR(date) = 2026
DATE_FORMAT(date,'%Y-%m-%d') = '2026-04-14'
```

### Useful SQL Functions

```sql
COUNT(field)  MAX(field)  MIN(field)  AVG(field)  SUM(field)
CONCAT(f1,f2)  DATE_FORMAT(date,'%Y-%m-%d')  YEAR(date)  NOW()
COALESCE(field,'fallback')  IF(cond,true,false)
```

---

## Response Structure

```json
{
  "cargoquery": [
    { "title": { "field1": "value", "field2": "value" } },
    { "title": { "field1": "value", "field2": "value" } }
  ]
}
```

**Important quirks:**
- Every value is a **string**, even numbers and booleans (`"1"` not `1`, `"0"` not `false`)
- Null/missing fields come back as `""` (empty string), not `null`
- Unwrap results: `data.cargoquery.map(r => r.title)`
- Boolean fields: `"1"` = true, `"0"` = false

### Error Response

```json
{ "error": { "code": "badvalue", "info": "Description of the error" } }
```

Always check `if ('error' in data)` before accessing `data.cargoquery`.

---

## Key Tables

### `Match2` — Match schedules and results

| Field | Type | Description |
|-------|------|-------------|
| `match2id` | string | Unique match identifier |
| `date` | timestamp | Match date/time (ISO format) |
| `dateexact` | "0"\|"1" | "1" if time is exact, "0" if estimated |
| `tournament` | string | Tournament name |
| `winner` | "0"\|"1"\|"2" | "1" = first opponent won, "2" = second, "0" = draw/TBD |
| `finished` | "0"\|"1" | "1" if match is complete |
| `bestof` | string | Format: "1", "3", "5" |
| `match2opponents` | JSON string | Array of opponent objects — parse with `JSON.parse()` |
| `match2games` | JSON string | Array of individual game/map results |
| `vod` | string | VOD link |
| `stream` | JSON string | Streaming links |

### `Match2opponent` — Team per match (join with Match2)

| Field | Type | Description |
|-------|------|-------------|
| `match2id` | string | FK to Match2 |
| `name` | string | Team name |
| `score` | string | Maps/games won |
| `placement` | "1"\|"2" | Final placement; "1" = winner |
| `icon` | string | Team logo path |
| `match2players` | JSON string | Player roster |

### `Match2game` — Individual maps within a match

| Field | Type | Description |
|-------|------|-------------|
| `match2id` | string | FK to Match2 |
| `map` | string | Map name |
| `winner` | "1"\|"2" | Which team won this map |
| `scores` | JSON string | `["16","14"]` — score for each team |
| `mode` | string | Game mode |

### `Tournament` — Tournament/event info

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Tournament name |
| `startdate` | date | Start date |
| `enddate` | date | End date |
| `status` | string | e.g. "ongoing", "finished" |
| `tier` | string | S/A/B/C tier |
| `prizepool` | string | Prize pool amount |
| `location` | string | Online/city |
| `game` | string | Game name |

---

## Pagination

```typescript
const PAGE_SIZE = 100;
let offset = 0;
const allResults = [];

while (true) {
  const page = await cargoQuery(game, { tables, fields, where, limit: PAGE_SIZE, offset });
  allResults.push(...page);
  if (page.length < PAGE_SIZE) break; // last page
  offset += PAGE_SIZE;
  // rate limit enforced inside cargoQuery
}
```

---

## Low-Level Client (write to `lib/liquipedia.ts`)

```typescript
const RATE_LIMIT_MS = 2100; // 2s + 100ms safety buffer
let lastRequestAt = 0;

const USER_AGENT =
  "EsportsOracle/1.0 (https://esports2026.com; contact@esports2026.com)";

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Encoding": "gzip",
    },
  });

  // Back-off on rate limit / server overload
  if (res.status === 429 || res.status === 503) {
    await new Promise((r) => setTimeout(r, 10_000));
    const retry = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Encoding": "gzip" },
    });
    if (!retry.ok) throw new Error(`Liquipedia ${retry.status} on retry`);
    return retry;
  }

  if (!res.ok) throw new Error(`Liquipedia HTTP ${res.status}`);
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
}

export async function cargoQuery(
  game: string,
  params: CargoQueryParams
): Promise<Record<string, string>[]> {
  const url = new URL(`https://liquipedia.net/${game}/api.php`);
  url.searchParams.set("action", "cargoquery");
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const res = await rateLimitedFetch(url.toString());
  const data = await res.json();

  if ("error" in data) {
    throw new Error(`Liquipedia Cargo error: ${data.error.code} — ${data.error.info}`);
  }

  return (data.cargoquery ?? []).map(
    (row: { title: Record<string, string> }) => row.title
  );
}
```

---

## Caching Strategy (Appwrite)

After fetching from Liquipedia, immediately upsert into Appwrite using `createAdminClient()` from `lib/appwrite.ts`.

**Cache freshness rules:**
- Live/upcoming matches (`finished === "0"`): re-fetch if `syncedAt` older than **5 minutes**
- Finished matches (`finished === "1"`): re-fetch if `syncedAt` older than **24 hours**
- Always check Appwrite cache first; only call Liquipedia if stale

**Upsert pattern:**
```typescript
import { createAdminClient, ID, Query } from "@/lib/appwrite";

const { databases } = await createAdminClient();
await databases.upsertDocument(DB_ID, MATCHES_TABLE_ID, match.match2id, {
  ...mappedFields,
  syncedAt: new Date().toISOString(),
});
```

---

## Example: Fetch Recent CS2 Matches

```typescript
// In a Server Action or Route Handler
const rows = await cargoQuery("counterstrike", {
  tables: "Match2,Match2opponent",
  fields:
    "Match2.match2id,Match2.date,Match2.winner,Match2.finished,Match2.tournament," +
    "Match2opponent.name,Match2opponent.score,Match2opponent.placement",
  join_on: "Match2.match2id=Match2opponent.match2id",
  where: "Match2.date > NOW() - INTERVAL 7 DAY",
  order_by: "Match2.date DESC",
  limit: 50,
});
```

## Example: Find Winner of a Specific Match

```typescript
const rows = await cargoQuery("counterstrike", {
  tables: "Match2,Match2opponent",
  fields:
    "Match2.match2id,Match2.date,Match2.winner,Match2opponent.name,Match2opponent.placement",
  join_on: "Match2.match2id=Match2opponent.match2id",
  where:
    "Match2opponent.name IN ('Natus Vincere','G2 Esports') " +
    "AND Match2.date LIKE '2026-04-%'",
  order_by: "Match2.date DESC",
  limit: 10,
});
```

## Example: Upcoming Tournaments

```typescript
const tournaments = await cargoQuery("counterstrike", {
  tables: "Tournament",
  fields: "Tournament.name,Tournament.startdate,Tournament.enddate,Tournament.tier,Tournament.prizepool",
  where: "Tournament.enddate >= NOW() AND Tournament.tier IN ('S','A')",
  order_by: "Tournament.startdate ASC",
  limit: 20,
});
```

---

## Attribution HTML (required on data pages)

```tsx
<p className="text-xs text-muted-foreground">
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
```

---

## Common Errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| `error.code: "badvalue"` | Invalid table or field name | Check spelling; some tables vary per game wiki |
| `cargoquery: []` empty result | WHERE too restrictive or date format wrong | Test query directly in browser first |
| HTTP 403 | Missing or blocked User-Agent | Verify User-Agent header is set exactly |
| HTTP 429 / 503 | Rate limit exceeded | Back-off 10s, retry once; add more delay between calls |
| Field value `""` where number expected | Null field | Check with `value !== ""` before parsing |

---

## Do Not Do

- Do not call this API from any `"use client"` component
- Do not use `axios` or any library that sets a generic User-Agent — use native `fetch` with explicit headers
- Do not call the same query twice within a request — fetch once, cache, re-use
- Do not omit the rate-limit delay — even a single unenforced burst can trigger a ban
- Do not use `action=parse` unless necessary — it counts as a heavier request (30s rate limit applies)
