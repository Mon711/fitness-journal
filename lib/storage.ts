import { env } from "cloudflare:workers";
import {
  JOURNAL_START,
  DEFAULT_PHASE,
  type Entry,
  type Phase,
} from "./journal";
function db() {
  if (!env.DB) throw new Error("Journal database is unavailable");
  return env.DB;
}
const columns = `date, workout, bedtime, bedtime_day AS bedtimeDay, wake_time AS wakeTime, alcohol, alcohol_quantity AS alcoholQuantity, junk_food AS junkFood, notes, updated_at AS updatedAt, filled`;
type StoredEntry = Omit<Entry, "filled"> & { filled: number };
function decode(row: StoredEntry): Entry {
  return { ...row, filled: row.filled === 1 };
}
export async function getEntry(owner: string, date: string) {
  const row = await db()
    .prepare(`SELECT ${columns} FROM entries WHERE owner=? AND date=?`)
    .bind(owner, date)
    .first<StoredEntry>();
  return row ? decode(row) : null;
}
export async function listEntries(owner: string, start: string, end: string) {
  return (
    await db()
      .prepare(
        `SELECT ${columns} FROM entries WHERE owner=? AND date>=? AND date<=? ORDER BY date ASC`,
      )
      .bind(owner, start, end)
      .all<StoredEntry>()
  ).results.map(decode);
}
export async function saveEntry(owner: string, e: Entry) {
  await db()
    .prepare(
      `INSERT INTO entries (owner,date,workout,bedtime,bedtime_day,wake_time,alcohol,alcohol_quantity,junk_food,notes,updated_at,filled) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner,date) DO UPDATE SET workout=excluded.workout,bedtime=excluded.bedtime,bedtime_day=excluded.bedtime_day,wake_time=excluded.wake_time,alcohol=excluded.alcohol,alcohol_quantity=excluded.alcohol_quantity,junk_food=excluded.junk_food,notes=excluded.notes,updated_at=excluded.updated_at,filled=excluded.filled`,
    )
    .bind(
      owner,
      e.date,
      e.workout,
      e.bedtime,
      e.bedtimeDay,
      e.wakeTime,
      e.alcohol,
      e.alcoholQuantity,
      e.junkFood,
      e.notes,
      new Date().toISOString(),
      e.filled ? 1 : 0,
    )
    .run();
}
export async function deleteEntry(owner: string, date: string) {
  await db()
    .prepare("DELETE FROM entries WHERE owner=? AND date=?")
    .bind(owner, date)
    .run();
}
export async function getPhase(owner: string) {
  const phase = await db()
    .prepare(
      "SELECT start_date AS startDate,weeks,title FROM phases WHERE owner=?",
    )
    .bind(owner)
    .first<Phase>();
  return phase
    ? {
        ...phase,
        startDate:
          phase.startDate < JOURNAL_START ? JOURNAL_START : phase.startDate,
      }
    : { ...DEFAULT_PHASE };
}
export async function savePhase(owner: string, p: Phase) {
  await db()
    .prepare(
      "INSERT INTO phases (owner,start_date,weeks,title) VALUES (?,?,?,?) ON CONFLICT(owner) DO UPDATE SET start_date=excluded.start_date,weeks=excluded.weeks,title=excluded.title",
    )
    .bind(owner, p.startDate, p.weeks, p.title)
    .run();
}
