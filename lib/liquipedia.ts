// Server-side only — never import from Client Components.

const RATE_LIMIT_MS = 2100; // 2s + 100ms safety buffer
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

  let res = await fetch(url, { headers, cache: "no-store" });

  if (res.status === 429 || res.status === 503) {
    await new Promise((r) => setTimeout(r, 10_000));
    res = await fetch(url, { headers, cache: "no-store" });
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
    throw new Error(`Liquipedia [${data.error.code}]: ${data.error.info}`);
  }

  return (data.cargoquery ?? []).map(
    (row: { title: CargoRow }) => row.title
  );
}
