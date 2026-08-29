import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { dashboardSnapshotSchema } from "@shared/dashboard";

const { mockDb } = vi.hoisted(() => {
  const where = vi.fn(async () => []);
  const set = vi.fn(() => ({ where }));
  return { mockDb: { update: vi.fn(() => ({ set })), delete: vi.fn(() => ({ where })), insert: vi.fn(async () => []), select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) })) } };
});
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getDb: vi.fn(async () => mockDb) };
});

function context(user: TrpcContext["user"]): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}
const user = { id: 42, openId: "test-user", email: "test@example.com", name: "Test User", loginMethod: "test", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };

describe("dashboard persistence", () => {
  it("requires authentication for private state", async () => {
    await expect(appRouter.createCaller(context(null)).dashboard.load()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("validates the typed dashboard snapshot contract", () => {
    expect(dashboardSnapshotSchema.safeParse({ todos: [{ id: 1, text: "Task", done: false }], income: [], debts: [], weight: [], workouts: [], sleep: [], conditionLog: [], diseases: [], projects: [], assignments: [], readings: [], classes: [], syllabusEvents: [], applications: [], recommenders: [], people: [], voiceLog: [] }).success).toBe(true);
    expect(dashboardSnapshotSchema.safeParse({ todos: [] }).success).toBe(false);
  });

  it("allows authenticated edits and check-ins through protected procedures", async () => {
    const caller = appRouter.createCaller(context(user));
    await expect(caller.core.routines.update({ id: 1, title: "Updated" })).resolves.toEqual({ success: true });
    await expect(caller.core.tasks.complete({ id: 2, completed: true })).resolves.toEqual({ success: true });
    await expect(caller.core.goals.complete({ id: 3, completed: true })).resolves.toEqual({ success: true });
    await expect(caller.core.notes.update({ id: 4, body: "Updated note" })).resolves.toEqual({ success: true });
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("rejects unauthenticated normalized edits and check-ins", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.core.routines.update({ id: 1, title: "Updated" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.core.tasks.complete({ id: 1, completed: true })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
