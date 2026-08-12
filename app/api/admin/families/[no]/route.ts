import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { familyRecords } from "../../../../../db/schema";
import { isAdmin, unauthorized } from "../../_auth";

type RouteContext = { params: Promise<{ no: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  if (!isAdmin(request)) return unauthorized();
  const { no } = await context.params;
  const normalized = no.replace(/\D/g, "").slice(0, 6).padStart(2, "0");
  if (!normalized) return Response.json({ error: "가정번호가 필요합니다." }, { status: 400 });
  await getDb().delete(familyRecords).where(eq(familyRecords.no, normalized));
  return Response.json({ ok: true });
}
