import { asc } from "drizzle-orm";
import { getDb } from "../../../db";
import { choreCards } from "../../../db/schema";
import { DEFAULT_CARDS } from "../../data";

async function listCards() {
  const db = getDb();
  let rows = await db.select().from(choreCards).orderBy(asc(choreCards.position));
  if (rows.length === 0) {
    await db.insert(choreCards).values(DEFAULT_CARDS);
    rows = await db.select().from(choreCards).orderBy(asc(choreCards.position));
  }
  return rows;
}

export async function GET() {
  try {
    return Response.json({ cards: await listCards() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "카드를 불러오지 못했습니다.";
    return Response.json({ error: message, cards: DEFAULT_CARDS }, { status: 500 });
  }
}
