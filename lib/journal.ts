export type Entry = {
  date: string;
  workout: string | null;
  bedtime: string | null;
  bedtimeDay: "previous" | "same";
  wakeTime: string | null;
  alcohol: string | null;
  alcoholQuantity: string | null;
  junkFood: string | null;
  notes: string;
  filled: boolean;
  updatedAt?: string;
};
export type Phase = { startDate: string; weeks: number; title: string };
// The journal begins here; empty earlier dates are not part of its history.
export const JOURNAL_START = "2026-10-17";
export const DEFAULT_PHASE: Phase = {
  startDate: JOURNAL_START,
  weeks: 16,
  title: "My fitness phase",
};
export function entryState(entry?: Entry | null, recorded = false) {
  if (entry?.filled) return "filled";
  return recorded ||
    !!(
      entry &&
      (entry.workout ||
        entry.bedtime ||
        entry.wakeTime ||
        entry.alcohol ||
        entry.junkFood ||
        entry.notes.trim())
    )
    ? "started"
    : "unrecorded";
}
export function historyDates(month: string, startDate: string) {
  const first = month + "-01";
  const days = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();
  return Array.from({ length: days }, (_, i) => addDays(first, i)).filter(
    (d) => d >= startDate,
  );
}
export function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= "1900-01-01" &&
    value <= "2200-12-31" &&
    !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function addDays(date: string, days: number) {
  return new Date(Date.parse(date + "T00:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function context(date: string, phase: Phase) {
  const day =
    Math.round(
      (Date.parse(date + "T00:00:00Z") -
        Date.parse(phase.startDate + "T00:00:00Z")) /
        86400000,
    ) + 1;
  return day < 1
    ? "Before this phase"
    : day > phase.weeks * 7
      ? "After this phase"
      : `Day ${day} · Week ${Math.ceil(day / 7)}`;
}
function pick(value: unknown, choices: string[]) {
  if (value === null) return null;
  if (typeof value !== "string" || !choices.includes(value))
    throw new Error("Invalid selection");
  return value;
}
function clock(value: unknown) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw new Error("Use a valid clock time");
  return value;
}
export function parseEntry(input: unknown): Entry {
  if (!input || typeof input !== "object") throw new Error("Entry is required");
  const x = input as Record<string, unknown>;
  if (!validDate(x.date)) throw new Error("Use a valid entry date");
  if (typeof x.notes !== "string" || x.notes.length > 10000)
    throw new Error("Notes must be 10,000 characters or fewer");
  if (x.bedtimeDay !== "previous" && x.bedtimeDay !== "same")
    throw new Error("Choose the bedtime date");
  if (x.date < JOURNAL_START)
    throw new Error("The journal begins on 17 October 2026");
  if (x.filled !== undefined && typeof x.filled !== "boolean")
    throw new Error("Filled must be true or false");
  const alcohol = pick(x.alcohol, ["yes", "no"]);
  if (
    x.alcoholQuantity !== null &&
    (typeof x.alcoholQuantity !== "string" || x.alcoholQuantity.length > 100)
  )
    throw new Error("Quantity must be 100 characters or fewer");
  return {
    date: x.date,
    workout: pick(x.workout, ["A", "B", "C", "D", "E", "Rest"]),
    bedtime: clock(x.bedtime),
    bedtimeDay: x.bedtimeDay,
    wakeTime: clock(x.wakeTime),
    alcohol,
    alcoholQuantity:
      alcohol === "yes" ? (x.alcoholQuantity as string | null) : null,
    junkFood: pick(x.junkFood, ["yes", "no"]),
    notes: x.notes,
    filled: x.filled === true,
  };
}
export function parsePhase(input: unknown): Phase {
  const x = input as Phase;
  if (
    !x ||
    !validDate(x.startDate) ||
    x.startDate < JOURNAL_START ||
    !Number.isInteger(x.weeks) ||
    x.weeks < 1 ||
    x.weeks > 104 ||
    typeof x.title !== "string" ||
    !x.title.trim() ||
    x.title.length > 80
  )
    throw new Error(
      "Choose a start date, 1–104 weeks, and a title up to 80 characters",
    );
  return { startDate: x.startDate, weeks: x.weeks, title: x.title.trim() };
}
export function blankEntry(date: string): Entry {
  return {
    date,
    workout: null,
    bedtime: null,
    bedtimeDay: "previous",
    wakeTime: null,
    alcohol: null,
    alcoholQuantity: null,
    junkFood: null,
    notes: "",
    filled: false,
  };
}
// Prefix spreadsheet formulas so exported notes cannot execute as formulas.
export function csvCell(value: unknown) {
  let s = value == null ? "" : String(value);
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function toCsv(entries: Entry[]) {
  const keys: (keyof Entry)[] = [
    "date",
    "workout",
    "bedtime",
    "bedtimeDay",
    "wakeTime",
    "alcohol",
    "alcoholQuantity",
    "junkFood",
    "notes",
    "updatedAt",
    "filled",
  ];
  return [
    keys.join(","),
    ...entries.map((e) => keys.map((k) => csvCell(e[k])).join(",")),
  ].join("\r\n");
}
