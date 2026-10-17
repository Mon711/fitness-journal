import { env } from "cloudflare:workers";
import type { Entry, Phase } from "./journal";
function db() {
  if (!env.DB) throw new Error("Journal database is unavailable");
  return env.DB;
}
const columns = `date, workout, bedtime, bedtime_day AS bedtimeDay, wake_time AS wakeTime, alcohol, alcohol_quantity AS alcoholQuantity, junk_food AS junkFood, notes, updated_at AS updatedAt`;
export async function getEntry(owner: string, date: string) {
  return db()
    .prepare(`SELECT ${columns} FROM entries WHERE owner=? AND date=?`)
    .bind(owner, date)
    .first<Entry>();
}
export async function listEntries(owner: string, start: string, end: string) {
  return (
    await db()
      .prepare(
        `SELECT ${columns} FROM entries WHERE owner=? AND date>=? AND date<=? ORDER BY date ASC`,
      )
      .bind(owner, start, end)
      .all<Entry>()
  ).results;
}
export async function saveEntry(owner: string, e: Entry) {
  await db()
    .prepare(
      `INSERT INTO entries (owner,date,workout,bedtime,bedtime_day,wake_time,alcohol,alcohol_quantity,junk_food,notes,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner,date) DO UPDATE SET workout=excluded.workout,bedtime=excluded.bedtime,bedtime_day=excluded.bedtime_day,wake_time=excluded.wake_time,alcohol=excluded.alcohol,alcohol_quantity=excluded.alcohol_quantity,junk_food=excluded.junk_food,notes=excluded.notes,updated_at=excluded.updated_at`,
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
  return db()
    .prepare(
      "SELECT start_date AS startDate,weeks,title FROM phases WHERE owner=?",
    )
    .bind(owner)
    .first<Phase>();
}
export async function savePhase(owner: string, p: Phase) {
  await db()
    .prepare(
      "INSERT INTO phases (owner,start_date,weeks,title) VALUES (?,?,?,?) ON CONFLICT(owner) DO UPDATE SET start_date=excluded.start_date,weeks=excluded.weeks,title=excluded.title",
    )
    .bind(owner, p.startDate, p.weeks, p.title)
    .run();
}
