import { Check, PencilLine } from "lucide-react";
import { addDays, type Entry } from "../lib/journal";
function clockDate(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });
}
function choice(value: string | null) {
  return value === null ? "Not recorded" : value === "yes" ? "Yes" : "No";
}
export default function EntrySummary({
  entry,
  busy,
  onEdit,
  onFilled,
  onReopen,
  onDelete,
}: {
  entry: Entry;
  busy: boolean;
  onEdit: () => void;
  onFilled: () => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const bedtimeDate =
    entry.bedtimeDay === "previous" ? addDays(entry.date, -1) : entry.date;
  return (
    <div className="saved-entry">
      <div className="saved-heading" role="status">
        <span className="saved-icon">
          <Check size={22} />
        </span>
        <div>
          <h3>
            {entry.filled
              ? "This day is marked as filled."
              : "Your entry is saved."}
          </h3>
          <p>
            {entry.filled
              ? "Your observations are here whenever you want to revisit them."
              : "Saved as started. You can add more or mark this day as filled."}
          </p>
        </div>
      </div>
      <div className="summary-actions">
        <button className="secondary" onClick={onEdit} disabled={busy}>
          <PencilLine size={16} /> Edit entry
        </button>
        {!entry.filled && (
          <button className="primary" onClick={onFilled} disabled={busy}>
            {busy ? "Saving…" : "Mark day as filled"}
            <Check size={17} />
          </button>
        )}
      </div>
      <dl className="entry-summary">
        <div>
          <dt>Workout</dt>
          <dd>{entry.workout || "Not recorded"}</dd>
        </div>
        <div>
          <dt>Went to bed</dt>
          <dd>
            {entry.bedtime
              ? `${entry.bedtime} · ${clockDate(bedtimeDate)}`
              : "Not recorded"}
          </dd>
        </div>
        <div>
          <dt>Woke up</dt>
          <dd>
            {entry.wakeTime
              ? `${entry.wakeTime} · ${clockDate(entry.date)}`
              : "Not recorded"}
          </dd>
        </div>
        <div>
          <dt>Alcohol</dt>
          <dd>
            {choice(entry.alcohol)}
            {entry.alcohol === "yes" && entry.alcoholQuantity
              ? ` · ${entry.alcoholQuantity}`
              : ""}
          </dd>
        </div>
        <div>
          <dt>Junk food</dt>
          <dd>{choice(entry.junkFood)}</dd>
        </div>
        <div className="summary-notes">
          <dt>Notes</dt>
          <dd>{entry.notes || "Not recorded"}</dd>
        </div>
      </dl>
      <p className="sleep-note">
        Clock times only — no sleep duration is inferred.
      </p>
      {entry.filled && (
        <button
          className="clear-option reopen-entry"
          onClick={onReopen}
          disabled={busy}
        >
          Mark as started again
        </button>
      )}
      <button className="delete-link" onClick={onDelete} disabled={busy}>
        Delete this entry
      </button>
    </div>
  );
}
