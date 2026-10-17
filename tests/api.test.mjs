// Runs ONLY against the loopback built preview. Uses disposable synthetic owners.
import test from "node:test";
import assert from "node:assert/strict";
import { blankEntry } from "../lib/journal.ts";
const base = "http://127.0.0.1:8787";
const userA = "synthetic-test-alex",
  userB = "synthetic-test-blair";
async function request(
  path,
  { user = userA, method = "GET", data, origin = base } = {},
) {
  const headers = { "Content-Type": "application/json" };
  if (user) {
    headers["oai-authenticated-user-id"] = user;
    headers["oai-authenticated-user-email"] = user + "@example.test";
  }
  if (origin) headers.Origin = origin;
  const response = await fetch(base + path, {
    method,
    headers,
    body: data === undefined ? undefined : JSON.stringify(data),
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
  });
  // Drain every response, including denial cases, before reusing a connection.
  const payload = await response.arrayBuffer();
  return new Response(payload, { status: response.status, headers: response.headers });
}
async function rpc(name, args = {}, user = userA) {
  const r = await request("/mcp", {
    user,
    method: "POST",
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    },
  });
  assert.equal(r.status, 200);
  return r.json();
}
function content(x) {
  return JSON.parse(x.result.content[0].text);
}
test("built app: private CRUD, isolation, CSV and read-only MCP share one database", async (t) => {
  const date = "2091-01-17",
    entry = {
      ...blankEntry(date),
      workout: "A",
      bedtime: "23:50",
      wakeTime: "07:20",
      notes: "Synthetic integration record =not-a-formula",
    };
  try {
    await t.test("anonymous data and MCP access denied", async () => {
      for (const path of ["/api/entries", "/api/phase", "/mcp"]) {
        const r = await request(path, {
          user: null,
          method: path === "/mcp" ? "POST" : "GET",
          data: path === "/mcp" ? {} : undefined,
        });
        assert.equal(r.status, 401);
      }
    });
    await t.test("cross-origin writes rejected", async () => {
      assert.equal(
        (
          await request("/api/entries", {
            method: "PUT",
            data: entry,
            origin: "https://other.example",
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request("/api/entries", {
            method: "PUT",
            data: entry,
            origin: null,
          })
        ).status,
        403,
      );
    });
    await t.test("malformed dates and times rejected", async () => {
      assert.equal((await request("/api/entries?date=2091-02-31")).status, 400);
      assert.equal(
        (
          await request("/api/entries", {
            method: "PUT",
            data: { ...entry, bedtime: "25:10" },
          })
        ).status,
        400,
      );
    });
    await t.test("create entry and read it through MCP", async () => {
      assert.equal(
        (await request("/api/entries", { method: "PUT", data: entry })).status,
        200,
      );
      const e = content(await rpc("get_entry", { date })).entry;
      assert.equal(e.workout, "A");
      assert.equal(e.bedtime, "23:50");
      assert.equal(e.wakeTime, "07:20");
      assert.equal(e.notes, entry.notes);
    });
    await t.test(
      "second user cannot read or delete first user's data",
      async () => {
        assert.equal(
          content(await rpc("get_entry", { date }, userB)).entry,
          null,
        );
        assert.deepEqual(
          content(await rpc("get_entries", { start: date, end: date }, userB))
            .entries,
          [],
        );
        await request("/api/entries?date=" + date, {
          user: userB,
          method: "DELETE",
        });
        assert.equal(
          content(await rpc("get_entry", { date })).entry.workout,
          "A",
        );
      },
    );
    await t.test(
      "editing replaces only that user's day; second user's same date stays independent",
      async () => {
        await request("/api/entries", {
          user: userB,
          method: "PUT",
          data: { ...entry, workout: "Rest" },
        });
        await request("/api/entries", {
          method: "PUT",
          data: { ...entry, workout: "C", notes: "Synthetic updated" },
        });
        assert.equal(
          content(await rpc("get_entry", { date })).entry.workout,
          "C",
        );
        assert.equal(
          content(await rpc("get_entry", { date }, userB)).entry.workout,
          "Rest",
        );
      },
    );
    await t.test(
      "date range is inclusive; absent dates remain null",
      async () => {
        const rows = content(
          await rpc("get_entries", { start: date, end: date }),
        ).entries;
        assert.equal(rows.length, 1);
        assert.equal(rows[0].date, date);
        assert.equal(
          content(await rpc("get_entry", { date: "2091-01-18" })).entry,
          null,
        );
      },
    );
    await t.test("phase metadata is persistent and isolated", async () => {
      assert.equal(
        (
          await request("/api/phase", {
            method: "PUT",
            data: { startDate: date, weeks: 16, title: "Synthetic phase" },
          })
        ).status,
        200,
      );
      assert.equal(content(await rpc("get_phase")).phase.weeks, 16);
      assert.equal(content(await rpc("get_phase", {}, userB)).phase, null);
    });
    await t.test("CSV includes only current user's records", async () => {
      const r = await request("/api/entries?format=csv");
      assert.equal(r.status, 200);
      assert.ok(
        r.headers.get("content-disposition").includes("fitness-journal.csv"),
      );
      const csv = await r.text();
      assert.ok(csv.includes("Synthetic updated"));
      assert.ok(!csv.includes('"Rest"'));
    });
    await t.test(
      "MCP discovery exposes only three read-only tools and rejects writes",
      async () => {
        const r = await request("/mcp", {
          method: "POST",
          data: { jsonrpc: "2.0", id: 2, method: "tools/list" },
        });
        const x = await r.json();
        assert.equal(x.result.tools.length, 3);
        assert.ok(x.result.tools.every((x) => x.annotations.readOnlyHint));
        assert.equal(
          (await rpc("delete_entry", { date })).result.isError,
          true,
        );
        assert.equal(
          content(await rpc("get_entry", { date })).entry.workout,
          "C",
        );
        assert.equal(
          (await rpc("get_entries", { start: "2091-02-01", end: date })).result
            .isError,
          true,
        );
        const discovery = await request("/mcp", {
          method: "POST",
          data: { jsonrpc: "2.0", id: 3, method: "server/discover" },
        });
        assert.deepEqual((await discovery.json()).result.supportedVersions, [
          "2026-07-28",
        ]);
      },
    );
    await t.test("delete restores an unrecorded day", async () => {
      await request("/api/entries?date=" + date, { method: "DELETE" });
      assert.equal(content(await rpc("get_entry", { date })).entry, null);
    });
  } finally {
    for (const user of [userA, userB])
      await request("/api/entries?date=" + date, { user, method: "DELETE" });
  }
});
