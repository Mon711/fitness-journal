import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";
export const entries = sqliteTable(
  "entries",
  {
    owner: text("owner").notNull(),
    date: text("date").notNull(),
    workout: text("workout"),
    bedtime: text("bedtime"),
    bedtimeDay: text("bedtime_day").notNull().default("previous"),
    wakeTime: text("wake_time"),
    alcohol: text("alcohol"),
    alcoholQuantity: text("alcohol_quantity"),
    junkFood: text("junk_food"),
    notes: text("notes").notNull().default(""),
    filled: integer("filled", { mode: "boolean" }).notNull().default(false),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.date] })],
);
export const phases = sqliteTable("phases", {
  owner: text("owner").primaryKey(),
  startDate: text("start_date").notNull(),
  weeks: integer("weeks").notNull(),
  title: text("title").notNull(),
});

// Public quote text, cached privately for the signed-in Site identity.
export const quoteCache = sqliteTable(
  "quote_cache",
  {
    owner: text("owner").notNull().default(""),
    day: text("day").notNull(),
    text: text("text"),
    author: text("author"),
    checkedAt: integer("checked_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.owner, t.day] })],
);
