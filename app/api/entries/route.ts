import {
  owner,
  json,
  failure,
  body,
  validate,
  HttpError,
} from "../../../lib/http";
import { validDate, parseEntry, toCsv } from "../../../lib/journal";
import {
  getEntry,
  listEntries,
  saveEntry,
  deleteEntry,
} from "../../../lib/storage";
export async function GET(r: Request) {
  try {
    const id = await owner(r);
    const q = new URL(r.url).searchParams;
    if (q.has("date")) {
      const d = q.get("date");
      if (!validDate(d)) throw new HttpError(400, "Invalid date");
      return json({ entry: await getEntry(id, d) });
    }
    const start = q.get("start") || "1900-01-01",
      end = q.get("end") || "2200-12-31";
    if (!validDate(start) || !validDate(end) || start > end)
      throw new HttpError(400, "Invalid date range");
    const entries = await listEntries(id, start, end);
    if (q.get("format") === "csv")
      return new Response("\uFEFF" + toCsv(entries), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="fitness-journal.csv"',
          "Cache-Control": "no-store",
        },
      });
    return json({ entries });
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(r: Request) {
  try {
    const id = await owner(r, true);
    const e = validate(parseEntry, await body(r));
    await saveEntry(id, e);
    return json({ entry: await getEntry(id, e.date) });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(r: Request) {
  try {
    const id = await owner(r, true);
    const date = new URL(r.url).searchParams.get("date");
    if (!validDate(date)) throw new HttpError(400, "Invalid date");
    await deleteEntry(id, date);
    return json({ deleted: true });
  } catch (e) {
    return failure(e);
  }
}
