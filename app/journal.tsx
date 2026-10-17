"use client";
import { useEffect, useState } from "react";
import EntrySummary from "./entry-summary";
import DailyQuote from "./daily-quote";
import {
  BookOpen,
  CalendarDays,
  Settings2,
  Leaf,
  ArrowLeft,
  ArrowRight,
  Moon,
  Sun,
  Wine,
  Utensils,
  Check,
  Download,
  LockKeyhole,
  PencilLine,
} from "lucide-react";
import {
  addDays,
  blankEntry,
  context,
  DEFAULT_PHASE,
  JOURNAL_START,
  entryState,
  historyDates,
  type Entry,
  type Phase,
} from "../lib/journal";
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function pretty(
  d: string,
  options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" },
) {
  return new Date(d + "T12:00:00").toLocaleDateString("en", options);
}
async function api<T = unknown>(path: string, options: RequestInit = {}) {
  const r = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(data.error || "Unable to connect");
  return data;
}
export default function Journal() {
  const [tab, setTab] = useState("entry"),
    [date, setDate] = useState(today),
    [entry, setEntry] = useState<Entry>(() => blankEntry(today())),
    [entries, setEntries] = useState<Entry[]>([]),
    [phase, setPhase] = useState<Phase | null>(null),
    [draft, setDraft] = useState<Phase>({
      startDate: DEFAULT_PHASE.startDate,
      weeks: 16,
      title: "My fitness phase",
    }),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [saved, setSaved] = useState(false),
    [editing, setEditing] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [confirmDelete, setConfirmDelete] = useState(false),
    [week, setWeek] = useState(0),
    [range, setRange] = useState(today().slice(0, 7));
  async function refresh() {
    const [a, b] = await Promise.all([
      api<{ entries: Entry[] }>("/api/entries"),
      api<{ phase: Phase | null }>("/api/phase"),
    ]);
    setEntries(a.entries);
    setPhase(b.phase);
    if (b.phase) setDraft(b.phase);
    return { entries: a.entries, phase: b.phase ?? DEFAULT_PHASE };
  }
  useEffect(() => {
    let active = true;
    refresh()
      .then(({ entries: es, phase: p }) => {
        if (active) {
          const initialDate = date < p.startDate ? p.startDate : date;
          const e = es.find((x) => x.date === initialDate);
          setDate(initialDate);
          if (range < p.startDate.slice(0, 7))
            setRange(p.startDate.slice(0, 7));
          setEntry(e || blankEntry(initialDate));
          setSaved(!!e);
          setEditing(!e);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    return () => {
      active = false;
    };
  }, []);
  function leave() {
    return (
      !dirty ||
      window.confirm("You have unsaved changes. Leave without saving?")
    );
  }
  function selectDay(d: string) {
    if (d < startDate || busy || !leave()) return;
    const e = entries.find((x) => x.date === d);
    setDate(d);
    setEntry(e || blankEntry(d));
    setSaved(!!e);
    setEditing(!e);
    setDirty(false);
    setError("");
    setNotice("");
    setConfirmDelete(false);
    setTab("entry");
    window.scrollTo(0, 0);
  }
  function changeTab(t: string) {
    if (busy || !leave()) return;
    setDirty(false);
    const e = entries.find((x) => x.date === date);
    setEntry(e || blankEntry(date));
    setSaved(!!e);
    setEditing(!e);
    setTab(t);
    window.scrollTo(0, 0);
    setNotice("");
    setError("");
    if (t === "settings" && phase) setDraft(phase);
  }
  useEffect(() => {
    if (!dirty) return;
    const f = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dirty]);
  function update(k: keyof Entry, v: string | null) {
    setEntry((e) => ({
      ...e,
      [k]: v,
      ...(k === "alcohol" && v !== "yes" ? { alcoholQuantity: null } : {}),
    }));
    setDirty(true);
    setNotice("");
  }
  async function save(filled = entry.filled) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ entry: Entry }>("/api/entries", {
        method: "PUT",
        body: JSON.stringify({ ...entry, filled }),
      });
      await refresh();
      setDirty(false);
      setEntry(result.entry);
      setSaved(true);
      setEditing(false);
      window.scrollTo(0, 0);
      setNotice("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api("/api/entries?date=" + date, { method: "DELETE" });
      await refresh();
      setEntry(blankEntry(date));
      setSaved(false);
      setEditing(true);
      setDirty(false);
      setConfirmDelete(false);
      setNotice("Entry deleted. This day is unrecorded.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveSettings() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ phase: Phase }>("/api/phase", {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      setPhase(result.phase);
      if (date < result.phase.startDate) {
        const d = result.phase.startDate;
        const existing = entries.find((e) => e.date === d);
        setDate(d);
        setEntry(existing || blankEntry(d));
        setSaved(!!existing);
        setEditing(!existing);
      }
      if (range < result.phase.startDate.slice(0, 7))
        setRange(result.phase.startDate.slice(0, 7));
      setDirty(false);
      setWeek(0);
      setNotice("Phase settings saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const startDate = phase?.startDate ?? DEFAULT_PHASE.startDate;
  const state = entryState(entry, saved || dirty);
  const stateLabel =
    state === "filled"
      ? "Filled"
      : state === "started"
        ? "Started"
        : "Not recorded";
  const current = context(date, phase ?? DEFAULT_PHASE);
  const weekStart = phase ? addDays(phase.startDate, week * 7) : date;

  function weekGroup(d: string) {
    const c = phase
      ? context(d, phase)
      : pretty(d, { month: "long", year: "numeric" });
    return c.includes(" · ") ? c.split(" · ")[1] : c;
  }
  const historyDays = historyDates(range, startDate);
  function cancelEdit() {
    if (!leave()) return;
    const original = entries.find((e) => e.date === date);
    if (original) {
      setEntry(original);
      setDirty(false);
      setEditing(false);
      setConfirmDelete(false);
    }
  }
  function dayState(d: string) {
    return d === date && dirty
      ? entryState(entry, true)
      : entryState(
          entries.find((e) => e.date === d),
          entries.some((e) => e.date === d),
        );
  }
  function choices(
    label: string,
    k: "alcohol" | "junkFood",
    Icon: typeof Wine,
  ) {
    return (
      <div className="observation">
        <div className="field-title">
          <Icon size={19} />
          <label id={k + "-label"}>{label}</label>
        </div>
        <div className="segments" role="group" aria-labelledby={k + "-label"}>
          {[
            ["yes", "Yes"],
            ["no", "No"],
            [null, "Not recorded"],
          ].map(([v, l]) => (
            <button
              type="button"
              key={String(v)}
              aria-pressed={entry[k] === v}
              className={entry[k] === v ? "selected" : ""}
              onClick={() => update(k, v)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Fitness Journal home">
          <span className="brand-mark">
            <Leaf size={22} />
          </span>
          <span>
            Fitness
            <br />
            Journal<span className="brand-dot">.</span>
          </span>
        </a>
        <p className="sidebar-label">A LITTLE SPACE FOR YOU</p>
        <nav aria-label="Main navigation">
          {[
            ["entry", "Today", PencilLine],
            ["history", "Journal", BookOpen],
            ["settings", "Settings", Settings2],
          ].map(([id, label, Icon]) => {
            const I = Icon as typeof Leaf;
            return (
              <button
                key={id as string}
                aria-current={tab === id ? "page" : undefined}
                className={tab === id ? "nav-item active" : "nav-item"}
                onClick={() => {
                  if (id === "entry") selectDay(today());
                  else changeTab(id as string);
                }}
              >
                <I size={20} />
                <span>{label as string}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="private">
            <LockKeyhole size={14} /> Your private space
          </div>
          <p>
            Just observations.
            <br />
            No scores. No expectations.
          </p>
          <a href="/signout-with-chatgpt?return_to=/" target="_top">
            Sign out
          </a>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <span className="breadcrumb">YOUR EVERYDAY, AS IT IS</span>
          <span className="private">
            <LockKeyhole size={13} /> Private journal
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {tab === "entry"
                  ? pretty(date, { weekday: "long" })
                  : tab === "history"
                    ? "THE DAYS, COLLECTED"
                    : "MAKE IT YOURS"}
              </p>
              <h1>
                {tab === "entry"
                  ? "A little space to notice."
                  : tab === "history"
                    ? "Your journal."
                    : "Your own timeline."}
              </h1>
              <p className="subtitle">
                {tab === "entry"
                  ? "A few details from your day. Record what feels useful."
                  : tab === "history"
                    ? "Browse your days, one observation at a time."
                    : "A phase gives your observations a little context."}
              </p>
            </div>
            <div className="line-art" aria-hidden="true">
              <Leaf size={66} strokeWidth={0.8} />
              <span>one day at a time</span>
            </div>
          </div>
          {error && (
            <div className="alert" role="alert">
              {error}{" "}
              <button onClick={() => window.location.reload()}>Reload</button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <Check size={17} />
              {notice}
            </div>
          )}
          {loading ? (
            <div className="card loading" role="status">
              Opening your journal…
            </div>
          ) : (
            <>
              {tab === "entry" && (
                <div className="content-grid">
                  <section className="card entry-card">
                    <div className="entry-header">
                      <div>
                        <p className="eyebrow">DAILY ENTRY</p>
                        <div className="date-status">
                          <h2>{pretty(date)}</h2>
                          <span
                            className={`entry-status ${state}`}
                            aria-live="polite"
                          >
                            {state === "filled" && <Check size={12} />}{" "}
                            {stateLabel}
                            {dirty ? " · Unsaved" : ""}
                          </span>
                        </div>
                        <span className="context">{current}</span>
                      </div>
                      <div className="date-controls">
                        <button
                          aria-label="Previous day"
                          disabled={date <= startDate || busy}
                          onClick={() => selectDay(addDays(date, -1))}
                        >
                          <ArrowLeft size={18} />
                        </button>
                        <label className="date-picker">
                          <CalendarDays size={18} />
                          <input
                            aria-label="Entry date"
                            type="date"
                            min={startDate}
                            max="2200-12-31"
                            value={date}
                            onChange={(e) => {
                              if (e.target.value) selectDay(e.target.value);
                            }}
                          />
                        </label>
                        <button
                          aria-label="Next day"
                          onClick={() => selectDay(addDays(date, 1))}
                        >
                          <ArrowRight size={18} />
                        </button>
                      </div>
                    </div>
                    {!editing && saved ? (
                      <EntrySummary
                        entry={entry}
                        busy={busy}
                        onEdit={() => {
                          setEditing(true);
                          setConfirmDelete(false);
                          window.scrollTo(0, 0);
                        }}
                        onFilled={() => save(true)}
                        onReopen={() => save(false)}
                        onDelete={() => setConfirmDelete(true)}
                      />
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          save();
                        }}
                      >
                        <fieldset disabled={busy}>
                          <div className="section-field">
                            <div className="field-title">
                              <span className="tiny-line">↗</span>
                              <legend>Movement</legend>
                              <span className="optional">optional</span>
                            </div>
                            <p className="helper">Which workout did you do?</p>
                            <div
                              className="workout-options"
                              role="group"
                              aria-label="Workout"
                            >
                              {["A", "B", "C", "D", "E", "Rest"].map((w) => (
                                <button
                                  key={w}
                                  type="button"
                                  aria-pressed={entry.workout === w}
                                  className={
                                    entry.workout === w ? "selected" : ""
                                  }
                                  onClick={() => update("workout", w)}
                                >
                                  {w}
                                </button>
                              ))}
                            </div>
                            <button
                              className="clear-option"
                              type="button"
                              aria-pressed={entry.workout === null}
                              onClick={() => update("workout", null)}
                            >
                              {entry.workout === null ? (
                                <Check size={13} />
                              ) : null}{" "}
                              Not recorded
                            </button>
                          </div>
                          <div className="section-field">
                            <div className="field-title">
                              <Moon size={19} />
                              <h3>Night & morning</h3>
                              <span className="optional">optional</span>
                            </div>
                            <p className="helper">
                              Approximate times are perfectly fine.
                            </p>
                            <div className="time-grid">
                              <div>
                                <label htmlFor="bedtime">Went to bed</label>
                                <div className="time-input">
                                  <Moon size={16} />
                                  <input
                                    id="bedtime"
                                    type="time"
                                    value={entry.bedtime || ""}
                                    onChange={(e) =>
                                      update("bedtime", e.target.value || null)
                                    }
                                  />
                                </div>
                                <select
                                  aria-label="Bedtime day"
                                  value={entry.bedtimeDay}
                                  onChange={(e) =>
                                    update("bedtimeDay", e.target.value)
                                  }
                                >
                                  <option value="previous">
                                    Previous evening ·{" "}
                                    {pretty(addDays(date, -1), {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </option>
                                  <option value="same">
                                    Entry date ·{" "}
                                    {pretty(date, {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </option>
                                </select>
                              </div>
                              <div>
                                <label htmlFor="wake">Woke up</label>
                                <div className="time-input">
                                  <Sun size={17} />
                                  <input
                                    id="wake"
                                    type="time"
                                    value={entry.wakeTime || ""}
                                    onChange={(e) =>
                                      update("wakeTime", e.target.value || null)
                                    }
                                  />
                                </div>
                                <span className="time-caption">
                                  On {pretty(date)}
                                </span>
                              </div>
                            </div>
                            <p className="sleep-note">
                              Clock times only — these don’t tell us how long
                              you slept.
                            </p>
                          </div>
                          <div className="section-field">
                            {choices("Alcohol", "alcohol", Wine)}
                            {entry.alcohol === "yes" && (
                              <label className="quantity">
                                Quantity{" "}
                                <span className="optional">optional</span>
                                <input
                                  placeholder="e.g. 1 glass of wine"
                                  maxLength={100}
                                  value={entry.alcoholQuantity || ""}
                                  onChange={(e) =>
                                    update(
                                      "alcoholQuantity",
                                      e.target.value || null,
                                    )
                                  }
                                />
                              </label>
                            )}
                            {choices("Junk food", "junkFood", Utensils)}
                          </div>
                          <div className="section-field notes-field">
                            <label className="field-title" htmlFor="notes">
                              <PencilLine size={18} />
                              <span>Anything else?</span>
                              <span className="optional">optional</span>
                            </label>
                            <textarea
                              id="notes"
                              maxLength={10000}
                              placeholder="How you felt, something you noticed, or just a thought…"
                              value={entry.notes}
                              onChange={(e) => update("notes", e.target.value)}
                            />
                          </div>
                          <div className="form-footer">
                            <span>
                              {dirty
                                ? "Unsaved changes"
                                : saved
                                  ? "Recorded in your journal"
                                  : "Nothing recorded yet"}
                            </span>
                            <button className="secondary" type="submit">
                              {busy
                                ? "Saving…"
                                : saved
                                  ? "Save changes"
                                  : "Save entry"}
                              <Check size={17} />
                            </button>
                          </div>
                          {!entry.filled && (
                            <div className="finish-day">
                              <p>
                                Finished recording for this day? Optional
                                details can stay unrecorded.
                              </p>
                              <button
                                type="button"
                                className="primary"
                                onClick={() => save(true)}
                              >
                                Mark day as filled <Check size={17} />
                              </button>
                            </div>
                          )}
                          {saved && (
                            <button
                              type="button"
                              className="clear-option cancel-edit"
                              onClick={cancelEdit}
                            >
                              Cancel editing
                            </button>
                          )}
                          {saved && (
                            <button
                              className="delete-link"
                              type="button"
                              onClick={() => setConfirmDelete(true)}
                            >
                              Delete this entry
                            </button>
                          )}
                        </fieldset>
                      </form>
                    )}
                    {confirmDelete && (
                      <div
                        className="delete-confirm"
                        role="alertdialog"
                        aria-labelledby="delete-title"
                      >
                        <h3 id="delete-title">Delete this entry?</h3>
                        <p>
                          This removes the record for {pretty(date)}. You can
                          export a backup first.
                        </p>
                        <div>
                          <button
                            onClick={() => setConfirmDelete(false)}
                            disabled={busy}
                          >
                            Keep entry
                          </button>
                          <button
                            className="danger"
                            onClick={remove}
                            disabled={busy}
                          >
                            Delete entry
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                  <aside className="context-column">
                    <section className="phase-card">
                      <div className="phase-icon">
                        <Leaf size={21} />
                      </div>
                      <p className="eyebrow">YOUR CURRENT CHAPTER</p>
                      <h2>{phase ? phase.title : "A fresh page."}</h2>
                      <p>
                        {phase
                          ? `${pretty(phase.startDate)} – ${pretty(addDays(phase.startDate, phase.weeks * 7 - 1))}`
                          : "Choose when your phase begins. You can always change it."}
                      </p>
                      {phase ? (
                        <span className="phase-duration">
                          {phase.weeks} weeks of observations
                        </span>
                      ) : null}
                      <button onClick={() => changeTab("settings")}>
                        {phase ? "Edit phase" : "Set up your phase"}
                        <ArrowRight size={15} />
                      </button>
                    </section>
                    {phase && (
                      <section className="week-card">
                        <div className="week-heading">
                          <h3>Week {week + 1}</h3>
                          <div>
                            <button
                              aria-label="Previous week"
                              disabled={week === 0}
                              onClick={() => setWeek((w) => w - 1)}
                            >
                              <ArrowLeft size={15} />
                            </button>
                            <button
                              aria-label="Next week"
                              disabled={week === phase.weeks - 1}
                              onClick={() => setWeek((w) => w + 1)}
                            >
                              <ArrowRight size={15} />
                            </button>
                          </div>
                        </div>
                        <p>
                          {pretty(weekStart, {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          –{" "}
                          {pretty(addDays(weekStart, 6), {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <div className="week-days">
                          {Array.from({ length: 7 }, (_, i) => {
                            const d = addDays(weekStart, i),
                              status = dayState(d);
                            return (
                              <button
                                key={d}
                                className={d === date ? "chosen" : ""}
                                aria-label={`${pretty(d)}, ${status}`}
                                onClick={() => selectDay(d)}
                              >
                                <span>{pretty(d, { weekday: "narrow" })}</span>
                                <b>{Number(d.slice(-2))}</b>
                                {status === "filled" ? (
                                  <Check size={12} className="day-filled" />
                                ) : (
                                  <i
                                    className={
                                      status === "started"
                                        ? "dot started"
                                        : "dot"
                                    }
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <span className="week-caption">
                          <i className="dot started" /> Started{" "}
                          <Check size={12} /> Filled
                        </span>
                      </section>
                    )}
                    <DailyQuote />
                  </aside>
                </div>
              )}
              {tab === "history" && (
                <section className="card history-card">
                  <div className="history-heading">
                    <div>
                      <h2>The days in between</h2>
                      <p>Empty days are simply unrecorded.</p>
                    </div>
                    <label className="month-label">
                      Month
                      <input
                        aria-label="Journal month"
                        type="month"
                        min={startDate.slice(0, 7)}
                        max="2200-12"
                        value={range}
                        onChange={(e) => {
                          if (e.target.value >= startDate.slice(0, 7))
                            setRange(e.target.value);
                        }}
                      />
                    </label>
                  </div>
                  <div className="history-list">
                    {historyDays.map((d, i) => {
                      const e = entries.find((x) => x.date === d);
                      return (
                        <div key={d}>
                          {(i === 0 ||
                            weekGroup(d) !== weekGroup(addDays(d, -1))) && (
                            <div className="week-divider">{weekGroup(d)}</div>
                          )}
                          <button
                            className="history-row"
                            onClick={() => selectDay(d)}
                          >
                            <span className="day-square">
                              <small>{pretty(d, { weekday: "short" })}</small>
                              <b>{Number(d.slice(-2))}</b>
                            </span>
                            <span className="history-detail">
                              <strong>
                                {e
                                  ? e.workout
                                    ? e.workout === "Rest"
                                      ? "Rest"
                                      : "Workout " + e.workout
                                    : "Daily observations"
                                  : "Unrecorded"}
                              </strong>
                              <span>
                                {e
                                  ? e.notes ||
                                    [
                                      e.bedtime ? "Bedtime " + e.bedtime : null,
                                      e.wakeTime
                                        ? "Wake-up " + e.wakeTime
                                        : null,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ") ||
                                    "An entry in your journal"
                                  : "A blank page, whenever you need it."}
                              </span>
                            </span>
                            {e && (
                              <span
                                className={`entry-status ${entryState(e, true)}`}
                              >
                                {e.filled ? <Check size={12} /> : null}
                                {e.filled ? "Filled" : "Started"}
                              </span>
                            )}
                            <ArrowRight size={17} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
              {tab === "settings" && (
                <section className="card settings-card">
                  <p className="eyebrow">FITNESS PHASE</p>
                  <h2>
                    {phase
                      ? "A chapter, at your pace."
                      : "Where would you like to begin?"}
                  </h2>
                  <p>
                    Your journal begins on 17 October 2026. Dates give your
                    observations context.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveSettings();
                    }}
                  >
                    <fieldset disabled={busy}>
                      <label>
                        Phase name
                        <input
                          required
                          maxLength={80}
                          value={draft.title}
                          onChange={(e) => {
                            setDraft({ ...draft, title: e.target.value });
                            setDirty(true);
                          }}
                        />
                      </label>
                      <div className="settings-grid">
                        <label>
                          Starting date
                          <input
                            type="date"
                            required
                            min={JOURNAL_START}
                            max="2200-12-31"
                            value={draft.startDate}
                            onChange={(e) => {
                              setDraft({ ...draft, startDate: e.target.value });
                              setDirty(true);
                            }}
                          />
                        </label>
                        <label>
                          Duration in weeks
                          <input
                            type="number"
                            required
                            min={1}
                            max={104}
                            value={draft.weeks}
                            onChange={(e) => {
                              setDraft({
                                ...draft,
                                weeks: Number(e.target.value),
                              });
                              setDirty(true);
                            }}
                          />
                        </label>
                      </div>
                      <p className="helper">
                        Changing your phase keeps every existing journal entry.
                      </p>
                      <button className="primary" type="submit">
                        {busy ? "Saving…" : "Save phase settings"}
                        <Check size={17} />
                      </button>
                    </fieldset>
                  </form>
                  <div className="backup">
                    <div>
                      <h3>A copy for safekeeping</h3>
                      <p>Download all recorded days as a CSV file.</p>
                    </div>
                    <a
                      className="secondary"
                      href="/api/entries?format=csv"
                      download
                    >
                      <Download size={17} /> Export CSV
                    </a>
                  </div>
                  <div className="privacy-note">
                    <LockKeyhole size={19} />
                    <div>
                      <h3>Personal means private.</h3>
                      <p>
                        Your journal belongs to your signed-in account. The
                        ChatGPT connection can read your observations, and
                        cannot change or delete them.
                      </p>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>FITNESS JOURNAL</span>
            <span>A record of your days. Nothing to prove.</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button
          aria-current={tab === "entry" ? "page" : undefined}
          onClick={() => selectDay(today())}
        >
          <PencilLine size={20} />
          Today
        </button>
        <button
          aria-current={tab === "history" ? "page" : undefined}
          onClick={() => changeTab("history")}
        >
          <BookOpen size={20} />
          Journal
        </button>
        <button
          aria-current={tab === "settings" ? "page" : undefined}
          onClick={() => changeTab("settings")}
        >
          <Settings2 size={20} />
          Settings
        </button>
      </nav>
    </div>
  );
}
