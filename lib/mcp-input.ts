import {
  blankEntry,
  parseEntry,
  parsePhase,
  validDate,
  DEFAULT_PHASE,
  type Entry,
  type Phase,
} from "./journal.ts";

export function argumentsObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Tool arguments must be an object");
  return value as Record<string, unknown>;
}

export function onlyKeys(input: Record<string, unknown>, keys: string[]) {
  if (Object.keys(input).some((key) => !keys.includes(key)))
    throw new Error(
      "Unknown argument. Account and owner selectors are not accepted.",
    );
}

export function mergeEntry(input: unknown, existing: Entry | null): Entry {
  const x = argumentsObject(input);
  onlyKeys(x, [
    "date", "workout", "bedtime", "bedtimeDay", "wakeTime", "alcohol",
    "alcoholQuantity", "junkFood", "notes", "filled",
  ]);
  if (!validDate(x.date)) throw new Error("Use a valid entry date");
  if (Object.keys(x).length < 2)
    throw new Error("Provide at least one observation or the filled flag");
  if (existing && existing.date !== x.date) throw new Error("Entry dates must match");
  return parseEntry({ ...(existing ?? blankEntry(x.date)), ...x });
}

export function mergePhase(
  input: unknown,
  existing: Phase = DEFAULT_PHASE,
): Phase {
  const x = argumentsObject(input);
  onlyKeys(x, ["startDate", "weeks", "title"]);
  if (!Object.keys(x).length) throw new Error("Provide at least one timeline setting");
  return parsePhase({ ...existing, ...x });
}
