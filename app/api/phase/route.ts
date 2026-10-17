import { owner, json, failure, body, validate } from "../../../lib/http";
import { parsePhase } from "../../../lib/journal";
import { getPhase, savePhase } from "../../../lib/storage";
export async function GET(r: Request) {
  try {
    return json({ phase: await getPhase(await owner(r)) });
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(r: Request) {
  try {
    const id = await owner(r, true);
    const p = validate(parsePhase, await body(r));
    await savePhase(id, p);
    return json({ phase: p });
  } catch (e) {
    return failure(e);
  }
}
