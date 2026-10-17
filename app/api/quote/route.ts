import { env } from "cloudflare:workers";
import { owner, json, failure, HttpError } from "../../../lib/http";
import { getDailyQuote } from "../../../lib/quotes";
export async function GET(request: Request) {
  try {
    const id = await owner(request);
    if (!env.DB) return json({ quote: null });
    return json({ quote: await getDailyQuote(env.DB, id) });
  } catch (error) {
    if (error instanceof HttpError) return failure(error);
    return json({ quote: null });
  }
}
