import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const choreCards = sqliteTable("chore_cards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  notice: text("notice").notNull().default(""),
  prepare: text("prepare").notNull().default(""),
  action: text("action").notNull().default(""),
  kid: integer("kid", { mode: "boolean" }).notNull().default(false),
  invisible: integer("invisible", { mode: "boolean" }).notNull().default(false),
  position: integer("position").notNull(),
});

export const familyRecords = sqliteTable("family_records", {
  no: text("no").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
});
