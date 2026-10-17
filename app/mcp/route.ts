import { owner, json, failure, body } from "../../lib/http";
import { tools } from "../../lib/mcp";
import { validDate } from "../../lib/journal";
import { getEntry, listEntries, getPhase } from "../../lib/storage";
export async function POST(r: Request) {
  try {
    const user = await owner(r);
    const x = await body(r);
    if (
      !x ||
      x.jsonrpc !== "2.0" ||
      typeof x.method !== "string" ||
      (x.id !== undefined &&
        typeof x.id !== "string" &&
        typeof x.id !== "number" &&
        x.id !== null)
    )
      return json({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid request" },
      });
    if (x.id === undefined) return new Response(null, { status: 202 });
    const reply = (result: unknown) =>
      json({ jsonrpc: "2.0", id: x.id, result });
    if (x.method === "server/discover")
      return reply({
        supportedVersions: ["2026-07-28"],
        capabilities: { tools: {} },
        serverInfo: { name: "fitness-journal", version: "1.0.0" },
      });
    if (x.method === "initialize")
      return reply({
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "fitness-journal", version: "1.0.0" },
      });
    if (x.method === "ping") return reply({});
    if (x.method === "tools/list") return reply({ tools });
    if (x.method !== "tools/call")
      return json({
        jsonrpc: "2.0",
        id: x.id,
        error: { code: -32601, message: "Method not found" },
      });
    try {
      const a = x.params?.arguments ?? {};
      const name = x.params?.name;
      let data;
      if (
        name === "get_entry" &&
        validDate(a.date) &&
        Object.keys(a).every((k) => k === "date")
      )
        data = { entry: await getEntry(user, a.date) };
      else if (
        name === "get_entries" &&
        validDate(a.start) &&
        validDate(a.end) &&
        a.start <= a.end &&
        Object.keys(a).every((k) => ["start", "end"].includes(k))
      )
        data = { entries: await listEntries(user, a.start, a.end) };
      else if (name === "get_phase" && Object.keys(a).length === 0)
        data = {
          phase: await getPhase(user),
          metadata: {
            sleep: "Reported clock times only; no sleep duration inferred.",
            missingEntries: "Unrecorded",
            filled:
              "Explicitly marked by the user; optional fields may remain unrecorded",
            bedtimeDay: "previous = date before entry; same = entry date",
            wakeTimeDay: "entry date",
          },
        };
      else
        throw new Error(
          "Unknown tool or invalid arguments. Dates must be YYYY-MM-DD.",
        );
      return reply({
        content: [{ type: "text", text: JSON.stringify(data) }],
        isError: false,
      });
    } catch (e) {
      return reply({
        content: [
          {
            type: "text",
            text: e instanceof Error ? e.message : "Tool failed",
          },
        ],
        isError: true,
      });
    }
  } catch (e) {
    return failure(e);
  }
}
