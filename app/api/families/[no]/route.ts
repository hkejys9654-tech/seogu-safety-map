import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { familyRecords } from "../../../../db/schema";
import type { FamilyRecord } from "../../../data";

type RouteContext = { params: Promise<{ no: string }> };

function normalizeNo(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 6);
  return digits ? digits.padStart(2, "0") : "";
}

export async function GET(_request: Request, context: RouteContext) {
  const { no: rawNo } = await context.params;
  const no = normalizeNo(rawNo);
  if (!no) return Response.json({ error: "가정번호가 필요합니다." }, { status: 400 });

  try {
    const [row] = await getDb().select().from(familyRecords).where(eq(familyRecords.no, no)).limit(1);
    return Response.json({ family: row ? JSON.parse(row.payload) : null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "기록을 불러오지 못했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { no: rawNo } = await context.params;
  const no = normalizeNo(rawNo);
  if (!no) return Response.json({ error: "가정번호가 필요합니다." }, { status: 400 });

  try {
    const body = (await request.json()) as { family?: FamilyRecord };
    if (!body.family || !Array.isArray(body.family.members) || !Array.isArray(body.family.weeks)) {
      return Response.json({ error: "저장할 기록 형식이 올바르지 않습니다." }, { status: 400 });
    }

    const updatedAt = new Date().toISOString();
    const family = { ...body.family, no, updatedAt };
    await getDb()
      .insert(familyRecords)
      .values({ no, payload: JSON.stringify(family), updatedAt })
      .onConflictDoUpdate({
        target: familyRecords.no,
        set: { payload: JSON.stringify(family), updatedAt },
      });

    return Response.json({ family });
  } catch (error) {
    const message = error instanceof Error ? error.message : "기록을 저장하지 못했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
