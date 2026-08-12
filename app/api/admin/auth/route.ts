import { isAdmin, unauthorized } from "../_auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { pin?: string };
  if (!isAdmin(request, body.pin)) return unauthorized();
  return Response.json({ ok: true });
}
