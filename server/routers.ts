import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { getDb, getPrimaryUser, getUserByOpenId, upsertUser } from "./db";
import { routines, tasks, goals, notes } from "../drizzle/schema";
import { getDashboardSnapshot, saveDashboardSnapshot } from "./db";
import { dashboardSnapshotSchema } from "@shared/dashboard";
import { invokeLLM } from "./_core/llm";
import { TRPCError } from "@trpc/server";
import { parse as parseCookie } from "cookie";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { getDailyRewindSettings, saveDailyRewindSettings } from "./dailyRewindDb";
import { googleCalendarConnections } from "../drizzle/schema";
import { deleteCalendarEvent, deleteGoogleEventsNotIn, findCalendarEventByGoogleId, getCalendarConnection, getCalendarEvent, insertCalendarEvent, listCalendarEvents, saveCalendarConnection, updateCalendarConnectionSync, updateCalendarEvent } from "./calendarDb";
import { calendarEventToGoogleEvent, createGoogleEvent, deleteGoogleEvent, decryptCredentials, encryptCredentials, exchangeGoogleCode, googleEventToCalendarEvent, listGoogleEvents, refreshGoogleCredentials, updateGoogleEvent } from "./googleCalendar";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    pinLogin: publicProcedure.input(z.object({ pin: z.string().regex(/^\d{4,8}$/, "PIN must be 4 to 8 digits") })).mutation(async ({ ctx, input }) => {
      if (!ENV.pinLoginInitialPin || input.pin !== ENV.pinLoginInitialPin) throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect PIN." });
      const configuredOwner = ENV.ownerOpenId ? await getUserByOpenId(ENV.ownerOpenId) : undefined;
      const existingOwner = configuredOwner || await getPrimaryUser();
      const openId = existingOwner?.openId || ENV.ownerOpenId || "pin-owner";
      const signedInAt = new Date();
      await upsertUser({ openId, name: existingOwner?.name || ENV.ownerName, email: existingOwner?.email || null, loginMethod: "pin", lastSignedIn: signedInAt });
      const user = await getUserByOpenId(openId);
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to initialize the PIN account." });
      const sessionToken = await sdk.signSession({ openId, appId: ENV.appId || "pin-login", name: user.name || ENV.ownerName }, { expiresInMs: ONE_YEAR_MS });
      ctx.res.cookie(COOKIE_NAME, sessionToken, getSessionCookieOptions(ctx.req));
      return { success: true as const, user };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  advice: router({
    performance: protectedProcedure.input(z.object({ context: z.string().max(12000) })).mutation(async ({ input }) => {
      const response = await invokeLLM({ model: "gpt-5-mini", messages: [{ role: "system", content: "You are a practical personal performance advisor. Give concise, supportive, non-medical guidance based only on the supplied dashboard context. Use short headings and actionable next steps." }, { role: "user", content: input.context }] });
      return { text: typeof response.choices?.[0]?.message?.content === "string" ? response.choices[0].message.content : "I couldn’t generate advice right now." };
    }),
    ideas: protectedProcedure.input(z.object({ section: z.string().min(1).max(120), context: z.string().max(12000) })).mutation(async ({ input }) => {
      const response = await invokeLLM({ model: "gpt-5-mini", messages: [{ role: "system", content: "You are a practical planning assistant inside a private life dashboard. Give concise, actionable ideas for the requested section. For Masters applications, distinguish verified user-provided deadlines from items that must be checked on official program websites; never invent current deadlines or sources. Include a short checklist and next best action." }, { role: "user", content: `Section: ${input.section}\nContext:\n${input.context}` }] });
      return { text: typeof response.choices?.[0]?.message?.content === "string" ? response.choices[0].message.content : "I couldn’t generate ideas right now." };
    }),
    coach: protectedProcedure.input(z.object({ message: z.string().min(1).max(4000), context: z.string().max(12000).optional() })).mutation(async ({ input }) => {
      const response = await invokeLLM({ model: "gpt-5-mini", messages: [{ role: "system", content: "You are an empathetic AI life coach inside a private personal dashboard. Be practical, warm, concise, and non-judgmental. Do not diagnose medical conditions or provide professional financial advice. Ask one clarifying question only when it would materially improve the next step." }, { role: "user", content: `${input.context ? `Dashboard context:\n${input.context}\n\n` : ""}${input.message}` }] });
      return { text: typeof response.choices?.[0]?.message?.content === "string" ? response.choices[0].message.content : "I couldn’t respond right now." };
    }),
    voiceUpdate: protectedProcedure.input(z.object({ transcript: z.string().min(1).max(8000), context: z.string().max(16000) })).mutation(async ({ input }) => {
      const response = await invokeLLM({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: "You are the structured update engine for a private personal life dashboard. Classify only changes clearly supported by the voice transcript. Never invent IDs or values. Return JSON with a short summary and safe actions. Supported actions: add_todo {text,due,time,domain}; update_task_status {taskId,status}; log_debt_payment {debtId,amount}; log_income_payment {incomeId,amount}; log_workout {workoutType,duration}; log_weight {weight}; log_sleep {hours}; log_condition {note,medTaken}." },
          { role: "user", content: `Current dashboard context:\n${input.context}\n\nVoice transcript:\n${input.transcript}` },
        ],
        response_format: { type: "json_schema", json_schema: { name: "dashboard_voice_update", strict: true, schema: { type: "object", additionalProperties: false, properties: { summary: { type: "string" }, actions: { type: "array", items: { type: "object", additionalProperties: false, properties: { type: { type: "string" }, text: { type: "string" }, due: { type: "string" }, time: { type: "string" }, domain: { type: "string" }, taskId: { type: ["integer", "null"] }, status: { type: "string" }, debtId: { type: ["integer", "null"] }, incomeId: { type: ["integer", "null"] }, amount: { type: ["number", "null"] }, workoutType: { type: "string" }, duration: { type: "string" }, weight: { type: ["number", "null"] }, hours: { type: ["number", "null"] }, note: { type: "string" }, medTaken: { type: ["boolean", "null"] } }, required: ["type", "text", "due", "time", "domain", "taskId", "status", "debtId", "incomeId", "amount", "workoutType", "duration", "weight", "hours", "note", "medTaken"] } } }, required: ["summary", "actions"] } } },
      });
      const content = response.choices?.[0]?.message?.content;
      if (typeof content !== "string") return { summary: "I couldn’t understand that update.", actions: [] };
      try {
        const parsed = JSON.parse(content);
        return { summary: typeof parsed.summary === "string" ? parsed.summary : "Updated.", actions: Array.isArray(parsed.actions) ? parsed.actions : [] };
      } catch {
        return { summary: "I couldn’t understand that update.", actions: [] };
      }
    }),
  }),

  dailyRewind: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getDailyRewindSettings(ctx.user.id);
      return { enabled: Boolean(settings?.enabled), pending: Boolean(settings?.pending), pendingAt: settings?.pendingAt || null, lastCapturedAt: settings?.lastCapturedAt || null, timezone: settings?.timezone || "UTC", nextAt: settings?.enabled ? `22:00 ${settings?.timezone || "UTC"}` : null };
    }),
    setEnabled: protectedProcedure.input(z.object({ enabled: z.boolean(), timezone: z.string().min(1).max(100).optional() })).mutation(async ({ ctx, input }) => {
      const existing = await getDailyRewindSettings(ctx.user.id);
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Session required to schedule Daily Rewind." });
      if (!input.enabled) {
        if (existing?.scheduleCronTaskUid) await updateHeartbeatJob(existing.scheduleCronTaskUid, { enable: false }, sessionToken);
        return saveDailyRewindSettings(ctx.user.id, { enabled: 0 });
      }
      const timezone = input.timezone || existing?.timezone || "UTC";
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Daily Rewind timezone must be a valid IANA timezone." });
      }
      if (existing?.scheduleCronTaskUid) {
        await updateHeartbeatJob(existing.scheduleCronTaskUid, { cron: "0 0 * * * *", enable: true }, sessionToken);
        return saveDailyRewindSettings(ctx.user.id, { enabled: 1, timezone });
      }
      const job = await createHeartbeatJob({ name: `daily-rewind-${ctx.user.id}`, cron: "0 0 * * * *", path: "/api/scheduled/dailyRewind", description: "Check each hour and prompt the user at 10 PM in their saved IANA timezone." }, sessionToken);
      return saveDailyRewindSettings(ctx.user.id, { enabled: 1, timezone, scheduleCronTaskUid: job.taskUid });
    }),
    dismiss: protectedProcedure.mutation(({ ctx }) => saveDailyRewindSettings(ctx.user.id, { pending: 0 })),
    complete: protectedProcedure.mutation(({ ctx }) => saveDailyRewindSettings(ctx.user.id, { pending: 0, lastCapturedAt: new Date() })),
  }),

  core: router({
    routines: router({
      list: protectedProcedure.query(async ({ ctx }) => (await getDb())?.select().from(routines).where(eq(routines.userId, ctx.user.id)) ?? []),
      create: protectedProcedure.input(z.object({ title: z.string().min(1).max(255), domain: z.string().max(64).optional(), cadence: z.string().max(64).optional() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(routines).values({ userId: ctx.user.id, ...input }); return { success: true } as const; }),
      update: protectedProcedure.input(z.object({ id: z.number().int().positive(), title: z.string().min(1).max(255).optional(), domain: z.string().max(64).optional(), cadence: z.string().max(64).optional() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const { id, ...changes } = input; await db.update(routines).set(changes).where(and(eq(routines.id, id), eq(routines.userId, ctx.user.id))); return { success: true } as const; }),
      checkIn: protectedProcedure.input(z.object({ id: z.number().int().positive(), completed: z.boolean() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.update(routines).set({ completedAt: input.completed ? new Date() : null }).where(and(eq(routines.id, input.id), eq(routines.userId, ctx.user.id))); return { success: true } as const; }),
      delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.delete(routines).where(and(eq(routines.id, input.id), eq(routines.userId, ctx.user.id))); return { success: true } as const; }),
    }),
    tasks: router({
      list: protectedProcedure.query(async ({ ctx }) => (await getDb())?.select().from(tasks).where(eq(tasks.userId, ctx.user.id)) ?? []),
      create: protectedProcedure.input(z.object({ title: z.string().min(1).max(255), domain: z.string().max(64).optional(), dueDate: z.string().max(32).optional() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(tasks).values({ userId: ctx.user.id, ...input }); return { success: true } as const; }),
      update: protectedProcedure.input(z.object({ id: z.number().int().positive(), title: z.string().min(1).max(255).optional(), domain: z.string().max(64).optional(), dueDate: z.string().max(32).optional() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const { id, ...changes } = input; await db.update(tasks).set(changes).where(and(eq(tasks.id, id), eq(tasks.userId, ctx.user.id))); return { success: true } as const; }),
      complete: protectedProcedure.input(z.object({ id: z.number().int().positive(), completed: z.boolean() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.update(tasks).set({ completedAt: input.completed ? new Date() : null }).where(and(eq(tasks.id, input.id), eq(tasks.userId, ctx.user.id))); return { success: true } as const; }),
      delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.delete(tasks).where(and(eq(tasks.id, input.id), eq(tasks.userId, ctx.user.id))); return { success: true } as const; }),
    }),
    goals: router({
      list: protectedProcedure.query(async ({ ctx }) => (await getDb())?.select().from(goals).where(eq(goals.userId, ctx.user.id)) ?? []),
      create: protectedProcedure.input(z.object({ title: z.string().min(1).max(255), domain: z.string().max(64).optional() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(goals).values({ userId: ctx.user.id, ...input }); return { success: true } as const; }),
      update: protectedProcedure.input(z.object({ id: z.number().int().positive(), title: z.string().min(1).max(255).optional(), domain: z.string().max(64).optional() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const { id, ...changes } = input; await db.update(goals).set(changes).where(and(eq(goals.id, id), eq(goals.userId, ctx.user.id))); return { success: true } as const; }),
      complete: protectedProcedure.input(z.object({ id: z.number().int().positive(), completed: z.boolean() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.update(goals).set({ completedAt: input.completed ? new Date() : null }).where(and(eq(goals.id, input.id), eq(goals.userId, ctx.user.id))); return { success: true } as const; }),
      delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.delete(goals).where(and(eq(goals.id, input.id), eq(goals.userId, ctx.user.id))); return { success: true } as const; }),
    }),
    notes: router({
      list: protectedProcedure.query(async ({ ctx }) => (await getDb())?.select().from(notes).where(eq(notes.userId, ctx.user.id)) ?? []),
      create: protectedProcedure.input(z.object({ body: z.string().min(1), domain: z.string().max(64).optional() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(notes).values({ userId: ctx.user.id, ...input }); return { success: true } as const; }),
      update: protectedProcedure.input(z.object({ id: z.number().int().positive(), body: z.string().min(1).optional(), domain: z.string().max(64).optional() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const { id, ...changes } = input; await db.update(notes).set(changes).where(and(eq(notes.id, id), eq(notes.userId, ctx.user.id))); return { success: true } as const; }),
      delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.delete(notes).where(and(eq(notes.id, input.id), eq(notes.userId, ctx.user.id))); return { success: true } as const; }),
    }),
  }),

  calendar: router({
    list: protectedProcedure.input(z.object({ startAt: z.string().datetime({ offset: true }).optional(), endAt: z.string().datetime({ offset: true }).optional() }).optional()).query(async ({ ctx, input }) => listCalendarEvents(ctx.user.id, input?.startAt ? new Date(input.startAt) : undefined, input?.endAt ? new Date(input.endAt) : undefined)),
    status: protectedProcedure.query(async ({ ctx }) => {
      const connection = await getCalendarConnection(ctx.user.id);
      return { connected: Boolean(connection), calendarId: connection?.calendarId || "primary", lastSyncedAt: connection?.lastSyncedAt || null };
    }),
    create: protectedProcedure.input(z.object({ title: z.string().min(1).max(255), description: z.string().max(10000).optional(), location: z.string().max(512).optional(), startAt: z.string().datetime({ offset: true }), endAt: z.string().datetime({ offset: true }), allDay: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
      const startAt = new Date(input.startAt);
      const endAt = new Date(input.endAt);
      const connection = await getCalendarConnection(ctx.user.id);
      let googleEventId: string | undefined;
      let etag: string | undefined;
      if (connection) {
        const credentials = await refreshGoogleCredentials(decryptCredentials(connection.encryptedCredentials));
        const created = await createGoogleEvent(credentials.access_token!, connection.calendarId, { title: input.title, description: input.description, location: input.location, startAt, endAt, allDay: input.allDay ? 1 : 0 });
        googleEventId = created.id;
        etag = created.etag;
        if (credentials.access_token) await updateCalendarConnectionSync(ctx.user.id, encryptCredentials(credentials), connection.lastSyncedAt || new Date(0));
      }
      return insertCalendarEvent(ctx.user.id, { userId: ctx.user.id, title: input.title, description: input.description || null, location: input.location || null, startAt, endAt, allDay: input.allDay ? 1 : 0, googleEventId, etag, source: "dashboard", calendarId: connection?.calendarId || "primary" });
    }),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), title: z.string().min(1).max(255), description: z.string().max(10000).optional(), location: z.string().max(512).optional(), startAt: z.string().datetime({ offset: true }), endAt: z.string().datetime({ offset: true }), allDay: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
      const existing = await getCalendarEvent(ctx.user.id, input.id);
      if (!existing) throw new Error("Calendar event not found");
      const connection = await getCalendarConnection(ctx.user.id);
      const nextEvent = { title: input.title, description: input.description || null, location: input.location || null, startAt: new Date(input.startAt), endAt: new Date(input.endAt), allDay: input.allDay ? 1 : 0 };
      if (connection && existing.googleEventId) {
        const credentials = await refreshGoogleCredentials(decryptCredentials(connection.encryptedCredentials));
        const updated = await updateGoogleEvent(credentials.access_token!, connection.calendarId, existing.googleEventId, nextEvent);
        await updateCalendarConnectionSync(ctx.user.id, encryptCredentials(credentials), connection.lastSyncedAt || new Date(0));
        return updateCalendarEvent(ctx.user.id, input.id, { ...nextEvent, etag: updated.etag || existing.etag, source: "dashboard" });
      }
      return updateCalendarEvent(ctx.user.id, input.id, nextEvent);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const existing = await getCalendarEvent(ctx.user.id, input.id);
      if (!existing) return { success: true } as const;
      const connection = await getCalendarConnection(ctx.user.id);
      if (connection && existing.googleEventId) {
        const credentials = await refreshGoogleCredentials(decryptCredentials(connection.encryptedCredentials));
        await deleteGoogleEvent(credentials.access_token!, connection.calendarId, existing.googleEventId);
        await updateCalendarConnectionSync(ctx.user.id, encryptCredentials(credentials), connection.lastSyncedAt || new Date(0));
      }
      await deleteCalendarEvent(ctx.user.id, input.id);
      return { success: true } as const;
    }),
    sync: protectedProcedure.input(z.object({ startAt: z.string().datetime({ offset: true }), endAt: z.string().datetime({ offset: true }) })).mutation(async ({ ctx, input }) => {
      const connection = await getCalendarConnection(ctx.user.id);
      if (!connection) throw new Error("Connect Google Calendar before syncing");
      const credentials = await refreshGoogleCredentials(decryptCredentials(connection.encryptedCredentials));
      const googleEvents = await listGoogleEvents(credentials.access_token!, connection.calendarId, input.startAt, input.endAt);
      const syncedAt = new Date();
      let imported = 0;
      for (const googleEvent of googleEvents) {
        const mapped = googleEventToCalendarEvent(googleEvent);
        if (!mapped) continue;
        const existing = await findCalendarEventByGoogleId(ctx.user.id, mapped.googleEventId, connection.calendarId);
        if (existing) await updateCalendarEvent(ctx.user.id, existing.id, { ...mapped, calendarId: connection.calendarId, source: "google", lastSyncedAt: syncedAt });
        else await insertCalendarEvent(ctx.user.id, { ...mapped, userId: ctx.user.id, calendarId: connection.calendarId, source: "google", lastSyncedAt: syncedAt });
        imported += 1;
      }
      const removed = await deleteGoogleEventsNotIn(ctx.user.id, connection.calendarId, googleEvents.map((event) => event.id).filter((id): id is string => Boolean(id)), new Date(input.startAt), new Date(input.endAt));
      await updateCalendarConnectionSync(ctx.user.id, encryptCredentials(credentials), syncedAt);
      return { imported, removed, lastSyncedAt: syncedAt };
    }),
    connect: protectedProcedure.query(({ ctx }) => ({ redirectUri: `${ctx.req.protocol}://${ctx.req.get("host")}/api/google-calendar/callback` })),
  }),

  dashboard: router({
    load: protectedProcedure.query(async ({ ctx }) => {
      const row = await getDashboardSnapshot(ctx.user.id);
      return row ? dashboardSnapshotSchema.parse(JSON.parse(row.snapshot)) : null;
    }),
    save: protectedProcedure.input(dashboardSnapshotSchema).mutation(async ({ ctx, input }) => {
      await saveDashboardSnapshot(ctx.user.id, JSON.stringify(input));
      return { success: true } as const;
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
