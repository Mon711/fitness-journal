export type DailyQuote = { day: string; text: string; author: string };
export const QUOTE_SOURCE = "https://zenquotes.io/";
const QUOTE_API = "https://zenquotes.io/api/random";
const RETRY_MS = 15 * 60 * 1000;
type QuoteDatabase = {
  prepare(sql: string): {
    bind(...values: (string | number | null)[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
};
export function quoteDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function parseQuote(payload: unknown) {
  if (!Array.isArray(payload) || payload.length !== 1) return null;
  const item = payload[0];
  if (!item || typeof item.q !== "string" || typeof item.a !== "string")
    return null;
  const text = item.q.trim(),
    author = item.a.trim();
  if (
    !text ||
    text.length > 500 ||
    !author ||
    author.length > 100 ||
    /[<>\u0000-\u001f]/.test(text + author)
  )
    return null;
  return { text, author }; // Deliberately ignore provider HTML, links and images.
}
export async function getDailyQuote(
  db: QuoteDatabase,
  owner: string,
  fetcher: typeof fetch = fetch,
  now = new Date(),
): Promise<DailyQuote | null> {
  const day = quoteDay(now),
    timestamp = now.getTime();
  const cached = await db
    .prepare(
      "SELECT text,author,checked_at AS checkedAt FROM quote_cache WHERE owner=? AND day=?",
    )
    .bind(owner, day)
    .first<{ text: string | null; author: string | null; checkedAt: number }>();
  if (cached?.text && cached.author)
    return { day, text: cached.text, author: cached.author };
  if (cached && timestamp - cached.checkedAt < RETRY_MS) return null;
  // Atomically claim the fetch. Parallel tabs/isolate requests use the same row.
  const claimed = await db
    .prepare(
      "INSERT INTO quote_cache (owner,day,text,author,checked_at) VALUES (?,?,NULL,NULL,?) ON CONFLICT(owner,day) DO UPDATE SET checked_at=excluded.checked_at WHERE quote_cache.text IS NULL AND quote_cache.checked_at<=? RETURNING day",
    )
    .bind(owner, day, timestamp, timestamp - RETRY_MS)
    .first<{ day: string }>();
  if (!claimed) return null;
  try {
    // New headers only: never forward cookies, identity, referrer or journal data.
    const response = await fetcher(QUOTE_API, {
      headers: { Accept: "application/json" },
      credentials: "omit",
      redirect: "manual",
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) return null;
    const body = await response.text();
    if (body.length > 16000) return null;
    const quote = parseQuote(JSON.parse(body));
    if (!quote) return null;
    await db
      .prepare("UPDATE quote_cache SET text=?,author=? WHERE owner=? AND day=?")
      .bind(quote.text, quote.author, owner, day)
      .run();
    return { day, ...quote };
  } catch (error) {
    console.warn(
      "Daily quote unavailable:",
      error instanceof Error ? error.message : "Unknown provider error",
    );
    return null;
  } // Optional content never blocks journal operations.
}
