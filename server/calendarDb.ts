import { and, eq, gte, lte } from "drizzle-orm";
import { calendarEvents, googleCalendarConnections } from "../drizzle/schema";
import { getDb } from "./db";

export async function getCalendarConnection(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(googleCalendarConnections).where(eq(googleCalendarConnections.userId, userId)).limit(1);
  return rows[0];
}

export async function saveCalendarConnection(userId: number, encryptedCredentials: string, expiresAt: Date | null, calendarId = "primary") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await getCalendarConnection(userId);
  if (existing) {
    await db.update(googleCalendarConnections).set({ encryptedCredentials, expiresAt, calendarId, updatedAt: new Date() }).where(eq(googleCalendarConnections.userId, userId));
  } else {
    await db.insert(googleCalendarConnections).values({ userId, encryptedCredentials, expiresAt, calendarId });
  }
}

export async function updateCalendarConnectionSync(userId: number, encryptedCredentials: string, lastSyncedAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(googleCalendarConnections).set({ encryptedCredentials, lastSyncedAt, updatedAt: new Date() }).where(eq(googleCalendarConnections.userId, userId));
}

export async function listCalendarEvents(userId: number, startAt?: Date, endAt?: Date) {
  const db = await getDb();
  if (!db) return [];
  const filters = [eq(calendarEvents.userId, userId)];
  if (startAt) filters.push(gte(calendarEvents.endAt, startAt));
  if (endAt) filters.push(lte(calendarEvents.startAt, endAt));
  return db.select().from(calendarEvents).where(and(...filters));
}

export async function getCalendarEvent(userId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(calendarEvents).where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, userId))).limit(1);
  return rows[0];
}

export async function insertCalendarEvent(userId: number, input: typeof calendarEvents.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(calendarEvents).values({ ...input, userId });
  return getCalendarEvent(userId, Number(result[0].insertId));
}

export async function updateCalendarEvent(userId: number, id: number, changes: Partial<typeof calendarEvents.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(calendarEvents).set({ ...changes, updatedAt: new Date() }).where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, userId)));
  return getCalendarEvent(userId, id);
}

export async function deleteCalendarEvent(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(calendarEvents).where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, userId)));
}

export async function findCalendarEventByGoogleId(userId: number, googleEventId: string, calendarId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(calendarEvents).where(and(eq(calendarEvents.userId, userId), eq(calendarEvents.googleEventId, googleEventId), eq(calendarEvents.calendarId, calendarId))).limit(1);
  return rows[0];
}

export async function deleteGoogleEventsNotIn(userId: number, calendarId: string, googleIds: string[], startAt: Date, endAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db.select({ id: calendarEvents.id, googleEventId: calendarEvents.googleEventId }).from(calendarEvents).where(and(eq(calendarEvents.userId, userId), eq(calendarEvents.calendarId, calendarId), eq(calendarEvents.source, "google"), gte(calendarEvents.endAt, startAt), lte(calendarEvents.startAt, endAt)));
  const missing = existing.filter((row) => row.googleEventId && !googleIds.includes(row.googleEventId));
  for (const row of missing) await db.delete(calendarEvents).where(and(eq(calendarEvents.id, row.id), eq(calendarEvents.userId, userId)));
  return missing.length;
}
