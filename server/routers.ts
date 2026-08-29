import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import { routines, tasks, goals, notes } from "../drizzle/schema";
import { getDashboardSnapshot, saveDashboardSnapshot } from "./db";
import { dashboardSnapshotSchema } from "@shared/dashboard";
import { invokeLLM } from "./_core/llm";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
    coach: protectedProcedure.input(z.object({ message: z.string().min(1).max(4000), context: z.string().max(12000).optional() })).mutation(async ({ input }) => {
      const response = await invokeLLM({ model: "gpt-5-mini", messages: [{ role: "system", content: "You are an empathetic AI life coach inside a private personal dashboard. Be practical, warm, concise, and non-judgmental. Do not diagnose medical conditions or provide professional financial advice. Ask one clarifying question only when it would materially improve the next step." }, { role: "user", content: `${input.context ? `Dashboard context:\n${input.context}\n\n` : ""}${input.message}` }] });
      return { text: typeof response.choices?.[0]?.message?.content === "string" ? response.choices[0].message.content : "I couldn’t respond right now." };
    }),
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
