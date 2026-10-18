const readTools = [
  {
    name: "get_entry",
    description:
      "Read your journal on a calendar date. Null means unrecorded, never a missed workout. The filled flag is the user's explicit confirmation, not inferred from optional fields.",
    inputSchema: {
      type: "object",
      properties: { date: { type: "string", description: "YYYY-MM-DD" } },
      required: ["date"],
      additionalProperties: false,
    },
  },
  {
    name: "get_entries",
    description:
      "Read recorded entries in an inclusive date range, oldest first. Missing dates are unrecorded. Bedtime and wake-up are observations, not sleep duration.",
    inputSchema: {
      type: "object",
      properties: {
        start: { type: "string", description: "YYYY-MM-DD" },
        end: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["start", "end"],
      additionalProperties: false,
    },
  },
  {
    name: "get_phase",
    description:
      "Read phase title, starting date and duration in weeks. Defaults to a 16-week phase beginning 2026-10-17 until customized.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
].map((t) => ({
  ...t,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
}));

const writeTools = [
  {
    name: "save_entry",
    description:
      "Create or edit the signed-in caller's entry for one date. Only supplied fields change; omitted fields keep existing values. New fields default to unrecorded. Use null to clear optional observations and an empty string to clear notes. Setting alcohol to no or null clears quantity. Only set filled=true when the user explicitly confirms the day is filled. Bedtime and wakeTime are clock observations, never sleep duration. Do not infer unmentioned behavior. Read the entry before editing; concurrent saves to the same date use last-save-wins.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Entry date, YYYY-MM-DD, on or after 2026-10-17" },
        workout: { type: ["string", "null"], enum: ["A", "B", "C", "D", "E", "Rest", null] },
        bedtime: { type: ["string", "null"], description: "Reported bedtime HH:mm, or null. No duration calculation." },
        bedtimeDay: { type: "string", enum: ["previous", "same"], description: "Previous calendar date or entry date; new entries default to previous." },
        wakeTime: { type: ["string", "null"], description: "Reported wake-up HH:mm on entry date, or null." },
        alcohol: { type: ["string", "null"], enum: ["yes", "no", null] },
        alcoholQuantity: { type: ["string", "null"], maxLength: 100, description: "Optional quantity; only retained when alcohol is yes." },
        junkFood: { type: ["string", "null"], enum: ["yes", "no", null] },
        notes: { type: "string", maxLength: 10000 },
        filled: { type: "boolean", description: "Explicit user confirmation only, independent of optional fields." },
      },
      required: ["date"],
      minProperties: 2,
      additionalProperties: false,
    },
  },
  {
    name: "delete_entry",
    description: "Permanently delete only the signed-in caller's entry for one date. Confirm the date and deletion with the user before calling. Other accounts and dates are unaffected. An absent entry remains unrecorded.",
    inputSchema: {
      type: "object",
      properties: { date: { type: "string", description: "YYYY-MM-DD" } },
      required: ["date"],
      additionalProperties: false,
    },
  },
  {
    name: "update_phase",
    description: "Create or edit the signed-in caller's timeline settings. Only supplied settings change; others keep their current values. This never edits or deletes entries. A later starting date hides earlier dates in history without deleting them.",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "YYYY-MM-DD, on or after 2026-10-17" },
        weeks: { type: "integer", minimum: 1, maximum: 104 },
        title: { type: "string", minLength: 1, maxLength: 80 },
      },
      minProperties: 1,
      additionalProperties: false,
    },
  },
  {
    name: "reset_phase",
    description: "Delete only the signed-in caller's customized timeline settings and restore defaults: 2026-10-17, 16 weeks, My fitness phase. Confirm resetting settings with the user first. This never deletes journal entries.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
].map((tool) => ({
  ...tool,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
}));

export const tools = [...readTools, ...writeTools];
