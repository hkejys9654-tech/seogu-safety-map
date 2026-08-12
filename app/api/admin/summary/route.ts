import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { choreCards, familyRecords } from "../../../../db/schema";
import type { FamilyRecord } from "../../../data";
import { isAdmin, unauthorized } from "../_auth";

export async function GET(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  try {
    const db = getDb();
    const [rows, cards] = await Promise.all([
      db.select().from(familyRecords).orderBy(desc(familyRecords.updatedAt)).limit(500),
      db.select({ id: choreCards.id }).from(choreCards),
    ]);
    const families = rows.flatMap((row) => {
      try {
        return [JSON.parse(row.payload) as FamilyRecord];
      } catch {
        return [];
      }
    });
    return Response.json({ families, cardCount: cards.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "현황을 불러오지 못했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
