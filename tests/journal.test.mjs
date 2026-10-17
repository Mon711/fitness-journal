import test from "node:test";
import assert from "node:assert/strict";
import {
  validDate,
  addDays,
  context,
  parseEntry,
  parsePhase,
  blankEntry,
  toCsv,
  DEFAULT_PHASE,
  entryState,
  historyDates,
} from "../lib/journal.ts";
test("calendar validation rejects impossible days and leap-day errors", () => {
  for (const s of [
    "2026-02-29",
    "2026-02-31",
    "2026-13-01",
    "2026-00-01",
    "hello",
    "2026-1-01",
  ])
    assert.equal(validDate(s), false);
  assert.equal(validDate("2028-02-29"), true);
});
test("phase context uses calendar days and respects phase boundaries", () => {
  const p = { startDate: "2026-10-17", weeks: 16, title: "Phase" };
  assert.equal(context("2026-10-24", p), "Day 8 · Week 2");
  assert.equal(context("2026-10-16", p), "Before this phase");
  assert.equal(context(addDays(p.startDate, 111), p), "Day 112 · Week 16");
  assert.equal(context(addDays(p.startDate, 112), p), "After this phase");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
test("empty observations remain null rather than no or rest", () => {
  const e = parseEntry(blankEntry("2026-10-17"));
  assert.equal(e.workout, null);
  assert.equal(e.alcohol, null);
  assert.equal(e.junkFood, null);
});
test("clock times cross midnight with explicit date context, never duration", () => {
  const e = parseEntry({
    ...blankEntry("2026-10-17"),
    bedtime: "23:50",
    wakeTime: "07:10",
  });
  assert.equal(e.bedtime, "23:50");
  assert.equal(e.bedtimeDay, "previous");
  assert.equal(e.wakeTime, "07:10");
  assert.equal("sleepDuration" in e, false);
  assert.equal(
    parseEntry({ ...e, bedtime: "00:40", bedtimeDay: "same" }).bedtimeDay,
    "same",
  );
});
test("validation rejects malformed observations", () => {
  for (const patch of [
    { bedtime: "25:00" },
    { wakeTime: "7:10" },
    { workout: "F" },
    { alcohol: "maybe" },
    { junkFood: false },
    { notes: "x".repeat(10001) },
    { bedtimeDay: "next" },
  ])
    assert.throws(() => parseEntry({ ...blankEntry("2026-10-17"), ...patch }));
});
test("quantity is optional and cleared when alcohol is no or unrecorded", () => {
  const e = {
    ...blankEntry("2026-10-17"),
    alcohol: "yes",
    alcoholQuantity: "1 glass",
  };
  assert.equal(parseEntry(e).alcoholQuantity, "1 glass");
  assert.equal(parseEntry({ ...e, alcohol: "no" }).alcoholQuantity, null);
  assert.equal(parseEntry({ ...e, alcohol: null }).alcoholQuantity, null);
});
test("phase settings validate duration and trim titles", () => {
  assert.equal(
    parsePhase({ startDate: "2026-10-17", weeks: 16, title: " Phase " }).title,
    "Phase",
  );
  for (const weeks of [0, 105, 1.5])
    assert.throws(() =>
      parsePhase({ startDate: "2026-10-17", weeks, title: "Phase" }),
    );
});
test("CSV escapes quotes, multiline text, and spreadsheet formulas", () => {
  const csv = toCsv([
    { ...blankEntry("2026-10-17"), notes: '=HYPERLINK("test")\nsecond line' },
  ]);
  assert.ok(csv.includes('"\'=HYPERLINK(""test"")\nsecond line"'));
  assert.ok(csv.startsWith("date,workout,bedtime,bedtimeDay"));
});

test("entry state distinguishes no record, partial records, and explicit filled confirmation", () => {
  const blank = blankEntry("2026-10-17");
  assert.equal(entryState(blank), "unrecorded");
  assert.equal(entryState({ ...blank, workout: "A" }), "started");
  assert.equal(entryState({ ...blank, alcohol: "no" }), "started");
  assert.equal(entryState(blank, true), "started");
  const full = {
    ...blank,
    workout: "A",
    bedtime: "23:00",
    wakeTime: "07:00",
    alcohol: "no",
    junkFood: "no",
    notes: "Synthetic",
  };
  assert.equal(entryState(full), "started");
  assert.equal(entryState({ ...blank, filled: true }), "filled");
  assert.equal(entryState({ ...full, filled: false }), "started");
});
test("filled flag is a validated optional-field-independent confirmation", () => {
  assert.equal(
    parseEntry({ ...blankEntry("2026-10-17"), filled: true }).filled,
    true,
  );
  assert.throws(() =>
    parseEntry({ ...blankEntry("2026-10-17"), filled: "yes" }),
  );
  const legacy = blankEntry("2026-10-17");
  delete legacy.filled;
  assert.equal(parseEntry(legacy).filled, false);
  assert.ok(
    toCsv([{ ...blankEntry("2026-10-17"), filled: true }]).includes('"true"'),
  );
});
test("history begins on October 17 and honors configurable later starts", () => {
  assert.equal(DEFAULT_PHASE.startDate, "2026-10-17");
  assert.equal(DEFAULT_PHASE.weeks, 16);
  const days = historyDates("2026-10", DEFAULT_PHASE.startDate);
  assert.equal(days[0], "2026-10-17");
  assert.equal(days.length, 15);
  assert.equal(days.at(-1), "2026-10-31");
  assert.deepEqual(historyDates("2026-09", DEFAULT_PHASE.startDate), []);
  assert.equal(historyDates("2026-11", DEFAULT_PHASE.startDate).length, 30);
  assert.equal(historyDates("2026-10", "2026-10-24")[0], "2026-10-24");
  assert.throws(() => parseEntry(blankEntry("2026-10-16")));
  assert.throws(() =>
    parsePhase({ ...DEFAULT_PHASE, startDate: "2026-10-16" }),
  );
});
