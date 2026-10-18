// Runs ONLY against the loopback built preview. Uses disposable synthetic owners.
import test from "node:test";
import assert from "node:assert/strict";
import { blankEntry, DEFAULT_PHASE } from "../lib/journal.ts";
const base = "http://127.0.0.1:8787";
const userA = "synthetic-test-alex",
  userB = "synthetic-test-blair";
async function request(
  path,
  { user = userA, method = "GET", data, origin = base, contentType = "application/json", omitIdentity } = {},
) {
  // Fresh connections avoid stale local Wrangler sockets after Worker restarts.
  const headers = { "Content-Type": contentType, Connection: "close" };
  if (user) {
    headers["oai-authenticated-user-id"] = user;
    headers["oai-authenticated-user-email"] = user + "@example.test";
  }
  if (origin) headers.Origin = origin;
  if (omitIdentity) delete headers[omitIdentity];
  const response = await fetch(base + path, {
    method,
    headers,
    body: data === undefined ? undefined : JSON.stringify(data),
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
  });
  // Drain every response, including denial cases, before reusing a connection.
  const payload = await response.arrayBuffer();
  return new Response(payload, {
    status: response.status,
    headers: response.headers,
  });
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
test("built app: private CRUD, isolation, CSV and authenticated MCP share one database", async (t) => {
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
      for (const path of ["/api/entries", "/api/phase", "/api/quote", "/mcp"]) {
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
      assert.deepEqual(
        content(await rpc("get_phase", {}, userB)).phase,
        DEFAULT_PHASE,
      );
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
      "MCP discovery distinguishes read and write tools and rejects unknown calls",
      async () => {
        const r = await request("/mcp", {
          method: "POST",
          data: { jsonrpc: "2.0", id: 2, method: "tools/list" },
        });
        const x = await r.json();
        assert.equal(x.result.tools.length, 7);
        assert.equal(x.result.tools.filter((x) => x.annotations.readOnlyHint).length, 3);
        assert.ok(x.result.tools.filter((x) => !x.annotations.readOnlyHint).every((x) => x.annotations.destructiveHint));
        assert.equal(
          (await rpc("delete_everything", { date })).result.isError,
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
    await t.test("MCP writes require both trusted identity headers and reject browser cross-origin or simple form requests", async () => {
      for (const name of ["save_entry", "delete_entry", "update_phase", "reset_phase"]) {
        const data = { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name, arguments: name.includes("entry") ? { date, workout: "B" } : { weeks: 20 } } };
        for (const options of [{ user: null }, { omitIdentity: "oai-authenticated-user-id" }, { omitIdentity: "oai-authenticated-user-email" }])
          assert.equal((await request("/mcp", { method: "POST", data, ...options })).status, 401);
        assert.equal((await request("/mcp", { method: "POST", data, origin: "https://other.example" })).status, 403);
        assert.equal((await request("/mcp", { method: "POST", data, contentType: "text/plain" })).status, 415);
      }
      assert.equal(content(await rpc("get_entry", { date })).entry.workout, "C");
    });
    await t.test("MCP creates and patches only the signed-in user's entry and preserves unmentioned fields", async () => {
      const saved = content(await rpc("save_entry", { date, workout: "E", alcohol: "yes", alcoholQuantity: "1 glass", filled: true })).entry;
      assert.equal(saved.workout, "E");
      assert.equal(saved.notes, "Synthetic updated");
      assert.equal(saved.bedtime, "23:50");
      assert.equal(saved.filled, true);
      const patched = content(await rpc("save_entry", { date, notes: "Synthetic MCP edit", alcohol: "no" })).entry;
      assert.equal(patched.workout, "E");
      assert.equal(patched.alcoholQuantity, null);
      assert.equal(patched.filled, true);
      const browser = await (await request("/api/entries?date=" + date)).json();
      assert.equal(browser.entry.notes, "Synthetic MCP edit");
      assert.equal(content(await rpc("get_entry", { date }, userB)).entry.workout, "Rest");
      // A normal authenticated server-to-server MCP call has no browser Origin.
      const response = await request("/mcp", { method: "POST", origin: null, data: { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "save_entry", arguments: { date, filled: false } } } });
      assert.equal(content(await response.json()).entry.filled, false);
    });
    await t.test("MCP cannot target another owner; invalid patches never change saved records", async () => {
      for (const name of ["get_entry", "save_entry", "delete_entry", "get_phase", "update_phase", "reset_phase"]) {
        const args = name.includes("entry") ? { date, owner: userB } : { owner: userB };
        assert.equal((await rpc(name, args)).result.isError, true);
      }
      for (const args of [{ date }, { date, bedtime: "25:10" }, { date, filled: "yes" }, { date, updatedAt: "forged" }, { date: "2026-10-16", workout: "A" }])
        assert.equal((await rpc("save_entry", args)).result.isError, true);
      for (const args of [null, [], "text", 1]) assert.equal((await rpc("save_entry", args)).result.isError, true);
      assert.equal(content(await rpc("get_entry", { date })).entry.notes, "Synthetic MCP edit");
      assert.equal(content(await rpc("get_entry", { date }, userB)).entry.workout, "Rest");
    });
    await t.test("MCP timeline create, partial edit and reset are isolated and never delete entries", async () => {
      const p = content(await rpc("update_phase", { weeks: 20 })).phase;
      assert.deepEqual(p, { startDate: date, weeks: 20, title: "Synthetic phase" });
      assert.equal((await (await request("/api/phase")).json()).phase.weeks, 20);
      assert.equal((await rpc("update_phase", { weeks: 0 })).result.isError, true);
      assert.equal((await rpc("update_phase", { startDate: "2026-10-16" })).result.isError, true);
      assert.deepEqual(content(await rpc("get_phase", {}, userB)).phase, DEFAULT_PHASE);
      await rpc("update_phase", { weeks: 12, title: "Synthetic second timeline" }, userB);
      await rpc("reset_phase", {}, userB);
      assert.equal(content(await rpc("get_phase")).phase.weeks, 20);
      await rpc("update_phase", { title: "Synthetic second timeline" }, userB);
      const reset = content(await rpc("reset_phase"));
      assert.deepEqual(reset.phase, DEFAULT_PHASE);
      assert.equal(content(await rpc("get_phase", {}, userB)).phase.title, "Synthetic second timeline");
      assert.equal(content(await rpc("get_entry", { date })).entry.notes, "Synthetic MCP edit");
      const created = content(await rpc("update_phase", { title: "Synthetic new phase" })).phase;
      assert.equal(created.weeks, 16);
      assert.equal(created.title, "Synthetic new phase");
    });
    await t.test("MCP delete cannot remove another user's same-date record; a new entry retains null defaults", async () => {
      assert.equal(content(await rpc("delete_entry", { date }, userB)).deleted, true);
      assert.equal(content(await rpc("get_entry", { date }, userB)).entry, null);
      assert.equal(content(await rpc("get_entry", { date })).entry.notes, "Synthetic MCP edit");
      const created = content(await rpc("save_entry", { date, workout: "Rest" }, userB)).entry;
      assert.equal(created.workout, "Rest");
      assert.equal(created.notes, "");
      assert.equal(created.alcohol, null);
      assert.equal(created.filled, false);
    });
    await t.test(
      "explicit filled state survives browser and MCP reads, and can be reopened",
      async () => {
        const partial = { ...blankEntry(date), workout: "D", filled: true };
        assert.equal(
          (await request("/api/entries", { method: "PUT", data: partial }))
            .status,
          200,
        );
        const result = content(await rpc("get_entry", { date })).entry;
        assert.equal(result.filled, true);
        assert.equal(result.notes, "");
        assert.equal(result.alcohol, null);
        const browser = await (
          await request("/api/entries?date=" + date)
        ).json();
        assert.equal(browser.entry.filled, true);
        assert.equal(
          content(await rpc("get_entries", { start: date, end: date }))
            .entries[0].filled,
          true,
        );
        const csv = await (await request("/api/entries?format=csv")).text();
        assert.ok(csv.includes('"true"'));
        await request("/api/entries", {
          method: "PUT",
          data: { ...partial, filled: false },
        });
        assert.equal(
          content(await rpc("get_entry", { date })).entry.filled,
          false,
        );
        assert.equal(
          content(await rpc("get_entry", { date }, userB)).entry.workout,
          "Rest",
        );
      },
    );
    await t.test(
      "entries and phases cannot begin before journal inception",
      async () => {
        assert.equal(
          (
            await request("/api/entries", {
              method: "PUT",
              data: blankEntry("2026-10-16"),
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request("/api/phase", {
              method: "PUT",
              data: { ...DEFAULT_PHASE, startDate: "2026-10-16" },
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      "optional quote endpoint stays independent of saved journal entries",
      async () => {
        const response = await request("/api/quote");
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.ok(
          data.quote === null ||
            (typeof data.quote.day === "string" &&
              typeof data.quote.text === "string" &&
              typeof data.quote.author === "string"),
        );
        assert.equal(
          content(await rpc("get_entry", { date })).entry.workout,
          "D",
        );
      },
    );
    await t.test("delete restores an unrecorded day", async () => {
      await request("/api/entries?date=" + date, { method: "DELETE" });
      assert.equal(content(await rpc("get_entry", { date })).entry, null);
    });
  } finally {
    for (const user of [userA, userB]) {
      await request("/api/entries?date=" + date, { user, method: "DELETE" });
      await rpc("reset_phase", {}, user);
    }
  }
});
