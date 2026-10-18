import test from "node:test";
import assert from "node:assert/strict";
import { mergeEntry, mergePhase, argumentsObject } from "../lib/mcp-input.ts";
import { blankEntry, DEFAULT_PHASE } from "../lib/journal.ts";
import { tools } from "../lib/mcp.ts";
const date = "2091-01-18";

test("conversational entry edits preserve omitted observations and explicit filled state", () => {
  const existing = { ...blankEntry(date), workout: "A", notes: "Synthetic", bedtime: "00:40", wakeTime: "07:10", filled: true };
  const result = mergeEntry({ date, workout: "B" }, existing);
  assert.deepEqual(result, { ...existing, workout: "B" });
  assert.equal(mergeEntry({ date, filled: false }, existing).filled, false);
});
test("new MCP entries keep unmentioned observations unrecorded", () => {
  assert.deepEqual(mergeEntry({ date, workout: "Rest" }, null), { ...blankEntry(date), workout: "Rest" });
});
test("MCP edits distinguish clearing from omission and clear incompatible alcohol quantity", () => {
  const current = { ...blankEntry(date), alcohol: "yes", alcoholQuantity: "1 glass", notes: "Synthetic" };
  assert.equal(mergeEntry({ date, notes: "" }, current).alcoholQuantity, "1 glass");
  assert.equal(mergeEntry({ date, alcohol: "no" }, current).alcoholQuantity, null);
  assert.equal(mergeEntry({ date, alcohol: null }, current).alcohol, null);
});
test("MCP inputs reject account selectors, read-only timestamps, invalid types and empty patches", () => {
  for (const field of ["owner", "userId", "email", "updatedAt", "__proto__"])
    assert.throws(() => mergeEntry(JSON.parse(JSON.stringify({ date, workout: "A", [field]: "other" })), null));
  for (const input of [{ date }, { date, filled: "true" }, { date, bedtime: "25:00" }, { date: "2026-10-16", workout: "A" }, { date, notes: null }])
    assert.throws(() => mergeEntry(input, null));
  for (const input of [null, [], "text", 1]) assert.throws(() => argumentsObject(input));
});
test("timeline patches preserve existing settings and reject selectors or invalid values", () => {
  const current = { startDate: date, weeks: 16, title: "Synthetic phase" };
  assert.deepEqual(mergePhase({ weeks: 20 }, current), { ...current, weeks: 20 });
  assert.deepEqual(mergePhase({ title: " New title " }), { ...DEFAULT_PHASE, title: "New title" });
  for (const input of [{}, { owner: "other", weeks: 1 }, { weeks: 0 }, { startDate: "2026-10-16" }, { title: " " }])
    assert.throws(() => mergePhase(input, current));
});
test("MCP advertises reads and writes accurately without exposing account selectors", () => {
  assert.equal(tools.length, 7);
  for (const tool of tools) {
    assert.equal(tool.annotations.readOnlyHint, tool.name.startsWith("get_"));
    assert.equal(tool.annotations.destructiveHint, !tool.name.startsWith("get_"));
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.ok(!("owner" in tool.inputSchema.properties));
  }
});
