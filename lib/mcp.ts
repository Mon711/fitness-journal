export const tools = [
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
