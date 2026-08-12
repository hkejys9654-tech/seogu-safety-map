import { asc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { choreCards } from "../../../../db/schema";
import type { ChoreCard } from "../../../data";
import { isAdmin, unauthorized } from "../_auth";

export async function GET(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  try {
    const cards = await getDb().select().from(choreCards).orderBy(asc(choreCards.position));
    return Response.json({ cards });
  } catch (error) {
    const message = error instanceof Error ? error.message : "카드를 불러오지 못했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  try {
    const body = (await request.json()) as { cards?: ChoreCard[] };
    if (!Array.isArray(body.cards) || body.cards.length === 0 || body.cards.length > 100) {
      return Response.json({ error: "카드는 1~100장 사이로 저장해 주세요." }, { status: 400 });
    }
    const cards = body.cards.map((card, position) => ({
      id: String(card.id || `c${Date.now()}-${position}`),
      name: String(card.name || "").trim(),
      notice: String(card.notice || "").trim(),
      prepare: String(card.prepare || "").trim(),
      action: String(card.action || "").trim(),
      kid: Boolean(card.kid),
      invisible: Boolean(card.invisible),
      position,
    }));
    if (cards.some((card) => !card.name)) {
      return Response.json({ error: "모든 카드에 이름을 입력해 주세요." }, { status: 400 });
    }

    const db = getDb();
    await db.delete(choreCards);
    await db.insert(choreCards).values(cards);
    return Response.json({ cards });
  } catch (error) {
    const message = error instanceof Error ? error.message : "카드를 저장하지 못했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
