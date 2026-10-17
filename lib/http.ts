import { getChatGPTUser } from "../app/chatgpt-auth";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function owner(request: Request, write = false) {
  const user = await getChatGPTUser();
  if (!user) throw new HttpError(401, "Sign in to access your journal");
  if (write && request.headers.get("origin") !== new URL(request.url).origin)
    throw new HttpError(403, "This change must come from the journal");
  return user.userId;
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function failure(e: unknown) {
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  console.error("Journal request failed");
  return json(
    { error: "Unable to complete this request. Please try again." },
    500,
  );
}
export async function body(request: Request) {
  const text = await request.text();
  if (text.length > 40000) throw new HttpError(413, "Entry is too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}
export function validate<T>(parser: (x: unknown) => T, input: unknown): T {
  try {
    return parser(input);
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "Invalid input");
  }
}
