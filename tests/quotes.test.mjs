import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { quoteDay, parseQuote, getDailyQuote } from "../lib/quotes.ts";
const now = new Date("2026-10-17T08:00:00Z");
const sample = [
  {
    q: "A synthetic thought for today.",
    a: "QA Author",
    h: "<script>untrusted</script>",
  },
];
function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL("../drizzle/0002_dizzy_leader.sql", import.meta.url),
      "utf8",
    ),
  );
  sqlite.exec(
    readFileSync(
      new URL("../drizzle/0003_true_iron_fist.sql", import.meta.url),
      "utf8",
    ),
  );
  const db = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return {
        bind(...values) {
          return {
            async first() {
              return statement.get(...values) ?? null;
            },
            async run() {
              return statement.run(...values);
            },
          };
        },
      };
    },
  };
  return { db, close: () => sqlite.close() };
}
test("quote day follows India midnight, independently of selected journal date", () => {
  assert.equal(quoteDay(new Date("2026-10-17T18:29:59Z")), "2026-10-17");
  assert.equal(quoteDay(new Date("2026-10-17T18:30:00Z")), "2026-10-18");
});
test("provider content is bounded plain text; HTML and links are never used", () => {
  assert.deepEqual(parseQuote(sample), {
    text: sample[0].q,
    author: sample[0].a,
  });
  for (const payload of [
    null,
    [],
    [...sample, ...sample],
    [{ q: "", a: "A" }],
    [{ q: "<img src=x>", a: "A" }],
    [{ q: "x".repeat(501), a: "A" }],
    [{ q: "Text", a: { name: "X" } }],
    [{ q: "Text", a: "A\nB" }],
  ])
    assert.equal(parseQuote(payload), null);
});
test("one successful quote is cached across reloads and changes on the next day", async () => {
  const { db, close } = database();
  let calls = 0;
  const fetcher = async (url, options) => {
    calls++;
    assert.equal(url, "https://zenquotes.io/api/random");
    assert.deepEqual(options.headers, { Accept: "application/json" });
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "manual");
    assert.ok(options.signal);
    return Response.json(sample);
  };
  try {
    const first = await getDailyQuote(
      db,
      "synthetic-quote-owner",
      fetcher,
      now,
    );
    assert.equal(first.day, "2026-10-17");
    assert.equal(first.text, sample[0].q);
    assert.deepEqual(
      await getDailyQuote(db, "synthetic-quote-owner", fetcher, now),
      first,
    );
    assert.equal(calls, 1);
    await getDailyQuote(
      db,
      "synthetic-quote-owner",
      fetcher,
      new Date("2026-10-18T08:00:00Z"),
    );
    assert.equal(calls, 2);
  } finally {
    close();
  }
});
test("parallel requests claim only one provider fetch", async () => {
  const { db, close } = database();
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return Response.json(sample);
  };
  try {
    await Promise.all([
      getDailyQuote(db, "synthetic-quote-owner", fetcher, now),
      getDailyQuote(db, "synthetic-quote-owner", fetcher, now),
    ]);
    assert.equal(calls, 1);
    assert.equal(
      (await getDailyQuote(db, "synthetic-quote-owner", fetcher, now)).author,
      "QA Author",
    );
    assert.equal(calls, 1);
  } finally {
    close();
  }
});
test("outages stay silent, cool down requests, and recover after 15 minutes", async () => {
  const { db, close } = database();
  let calls = 0;
  const offline = async () => {
    calls++;
    throw new Error("Synthetic network failure");
  };
  try {
    assert.equal(
      await getDailyQuote(db, "synthetic-quote-owner", offline, now),
      null,
    );
    assert.equal(
      await getDailyQuote(
        db,
        "synthetic-quote-owner",
        offline,
        new Date(now.getTime() + 60000),
      ),
      null,
    );
    assert.equal(calls, 1);
    const result = await getDailyQuote(
      db,
      "synthetic-quote-owner",
      async () => {
        calls++;
        return Response.json(sample);
      },
      new Date(now.getTime() + 16 * 60000),
    );
    assert.equal(result.text, sample[0].q);
    assert.equal(calls, 2);
  } finally {
    close();
  }
});
test("rate-limit and malformed provider responses cannot populate the card", async () => {
  for (const response of [
    new Response("Limited", { status: 429 }),
    new Response(null, {
      status: 302,
      headers: { Location: "https://other.example/" },
    }),
    new Response("not JSON"),
    Response.json([{ q: "<script>alert(1)</script>", a: "X" }]),
  ]) {
    const { db, close } = database();
    try {
      assert.equal(
        await getDailyQuote(
          db,
          "synthetic-quote-owner",
          async () => response,
          now,
        ),
        null,
      );
    } finally {
      close();
    }
  }
});

test("cached quotes remain scoped to the authenticated identity", async () => {
  const { db, close } = database();
  let calls = 0;
  const fetcher = async () =>
    Response.json([{ q: `Synthetic quote ${++calls}`, a: "QA Author" }]);
  try {
    const a = await getDailyQuote(db, "synthetic-alex", fetcher, now);
    const b = await getDailyQuote(db, "synthetic-blair", fetcher, now);
    assert.notEqual(a.text, b.text);
    assert.deepEqual(
      await getDailyQuote(db, "synthetic-alex", fetcher, now),
      a,
    );
    assert.equal(calls, 2);
  } finally {
    close();
  }
});
