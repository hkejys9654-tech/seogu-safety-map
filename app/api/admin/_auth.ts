import { env } from "cloudflare:workers";

export function isAdmin(request: Request, pinFromBody?: string) {
  const bindings = env as unknown as { ADMIN_PIN?: string };
  const expected = bindings.ADMIN_PIN || "7645";
  const provided = pinFromBody || request.headers.get("x-admin-pin") || "";
  return provided === expected;
}

export function unauthorized() {
  return Response.json({ error: "관리자 번호가 올바르지 않습니다." }, { status: 401 });
}
