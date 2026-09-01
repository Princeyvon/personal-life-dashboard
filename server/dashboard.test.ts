import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { dashboardSnapshotSchema } from "@shared/dashboard";
import { applyIncomeReceipt, addIncomeExpected, applyDebtPayment, addDebtPrincipal, appendVoiceNote, applyVoiceActionToState, filterTodosForProject, calculateCompletionPercent, buildTodayCardItems, getDebtActionMeta } from "@shared/interactionHelpers";
import { addRelationshipGoal, editRelationshipGoal, toggleRelationshipGoal, deleteRelationshipGoal } from "@shared/relationshipHelpers";
import { handleDashboardPinRequest } from "./pin";

const { mockDb, mockPinUser, mockExistingSnapshot } = vi.hoisted(() => {
  const where = vi.fn(async () => []);
  const set = vi.fn(() => ({ where }));
  const pinUser = { id: 99, openId: process.env.OWNER_OPEN_ID || "pin-owner", email: null, name: "Dashboard Owner", loginMethod: "pin", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
  const existingSnapshot = { todos: [{ id: 7, text: "Persisted task", done: false }], income: [], debts: [], weight: [], workouts: [], sleep: [], conditionLog: [], diseases: [], projects: [], assignments: [], readings: [], classes: [], syllabusEvents: [], applications: [], recommenders: [], people: [], voiceLog: [] };
  return { mockDb: { update: vi.fn(() => ({ set })), delete: vi.fn(() => ({ where })), insert: vi.fn(async () => []), select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) })) }, mockPinUser: pinUser, mockExistingSnapshot: existingSnapshot };
});
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getDb: vi.fn(async () => mockDb), getPrimaryUser: vi.fn(async () => mockPinUser), getUserByOpenId: vi.fn(async () => mockPinUser), upsertUser: vi.fn(async () => undefined), getDashboardSnapshot: vi.fn(async () => ({ snapshot: JSON.stringify(mockExistingSnapshot) })) };
});

function context(user: TrpcContext["user"]): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext["res"] };
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

  it("protects Ideas and life-coach procedures from unauthenticated access", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.advice.ideas({ section: "Masters applications", context: "" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.advice.coach({ message: "What should I focus on?", context: "" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("supports relationship goal editing and activity history", () => {
    const person = { goals: [{ id: 1, text: "Call weekly", done: false }], activity: [] };
    const added = addRelationshipGoal(person, { id: 2, text: "Plan a visit", done: false }, { id: 3, date: "2026-08-29", type: "Goal", text: "Added goal" });
    expect(added.goals).toHaveLength(2);
    const edited = editRelationshipGoal(added, 2, "Plan a visit soon", { id: 4, date: "2026-08-29", type: "Goal", text: "Edited goal" });
    expect(edited.goals?.[1]?.text).toBe("Plan a visit soon");
    const toggled = toggleRelationshipGoal(edited, 1, { id: 5, date: "2026-08-29", type: "Goal", text: "Completed goal" });
    expect(toggled.goals?.[0]?.done).toBe(true);
    const deleted = deleteRelationshipGoal(toggled, 2, { id: 6, date: "2026-08-29", type: "Goal", text: "Deleted goal" });
    expect(deleted.goals).toHaveLength(1);
    expect(deleted.activity).toHaveLength(4);
  });

  it("keeps relationship goals and activity valid in snapshots", () => {
    const snapshot = dashboardSnapshotSchema.safeParse({ todos: [], income: [], debts: [], weight: [], workouts: [], sleep: [], conditionLog: [], diseases: [], projects: [], assignments: [], readings: [], classes: [], syllabusEvents: [], applications: [], recommenders: [], people: [{ id: 1, name: "Mom", type: "Family", lastContacted: "2026-08-29", threshold: 7, goals: [{ id: 1, text: "Call weekly", done: false }], notes: "", activity: [{ id: 2, date: "2026-08-29", type: "Note", text: "Added a voice note" }] }], voiceLog: [] });
    expect(snapshot.success).toBe(true);
  });

  it("handles partial and add-on finance transactions", () => {
    expect(applyIncomeReceipt({ toReceive: 100, paid: 0 }, 40).paid).toBe(40);
    expect(addIncomeExpected({ toReceive: 100 }, 25).toReceive).toBe(125);
    expect(applyDebtPayment({ debt: 100, paid: 0, status: "Active" }, 40).paid).toBe(40);
    expect(addDebtPrincipal({ debt: 100, status: "Paid" }, 25)).toMatchObject({ debt: 125, status: "Active" });
  });

  it("appends voice notes and keeps typed fallback content", () => {
    expect(appendVoiceNote("Existing", " New note ")).toBe("Existing\nNew note");
    expect(appendVoiceNote("", "Typed fallback")).toBe("Typed fallback");
  });

  it("calculates synchronized Today card completion percentages", () => {
    expect(calculateCompletionPercent([])).toBe(0);
    expect(calculateCompletionPercent([{ done: false }])).toBe(0);
    expect(calculateCompletionPercent([{ done: true }, { done: false }, { done: true }])).toBe(67);
    expect(calculateCompletionPercent([{ done: true }, { done: true }])).toBe(100);
  });

  it("builds synchronized Today cards across all eight life areas", () => {
    const categories = ["gym", "food", "classes", "masters", "work", "finance", "relationships", "health"].map((key) => ({ key, defaultText: `Default ${key}` }));
    const result = buildTodayCardItems(categories, {
      gym: [{ id: "gym-1", done: true }],
      finance: [{ id: "finance-1", done: false }],
      relationships: [{ id: "people-1", done: true }],
      health: [{ id: "health-1", done: false }],
    }, {
      gym: [{ id: "gym-1", done: false }, { id: "gym-2", done: false }],
    });
    expect(Object.keys(result)).toEqual(["gym", "food", "classes", "masters", "work", "finance", "relationships", "health"]);
    expect(result.gym).toHaveLength(2);
    expect(result.finance[0].id).toBe("finance-1");
    expect(result.relationships[0].id).toBe("people-1");
    expect(result.health[0].id).toBe("health-1");
    expect(result.food[0]).toMatchObject({ id: "food-default", done: false, source: "plan" });
  });

  it("keeps partial Pay and Add-on debt actions distinct", () => {
    expect(getDebtActionMeta("pay")).toMatchObject({ label: "Pay part", amountLabel: "Payment amount" });
    expect(getDebtActionMeta("pay").description).toContain("partial payment");
    expect(getDebtActionMeta("add")).toMatchObject({ label: "Add on", amountLabel: "Add-on amount" });
    expect(getDebtActionMeta("add").description).toContain("outstanding balance");
  });

  it("scopes Work todos to the active project", () => {
    const todos = [
      { id: 1, text: "Build hero", domain: "work", projectId: 1 },
      { id: 2, text: "Billing module", domain: "work", projectId: 2 },
      { id: 3, text: "Define rug mosaic deliverable", domain: "work", projectId: 3 },
    ];
    expect(filterTodosForProject(todos, 1, "Flame Guard site").map((todo) => todo.id)).toEqual([1]);
    expect(filterTodosForProject(todos, 2, "Agency OS").map((todo) => todo.id)).toEqual([2]);
    expect(filterTodosForProject(todos, 3, "Rug Mosaic").map((todo) => todo.id)).toEqual([3]);
  });

  it("applies structured voice actions with the supplied real date", () => {
    const state = { todos: [], projects: [], debts: [{ id: 1, debt: 100, paid: 0, status: "Active" }], income: [], workouts: [], weight: [{ date: "2026-08-29", weight: 80 }], sleep: [], conditionLog: [] };
    const afterWorkout = applyVoiceActionToState(state, { type: "log_workout", workoutType: "Run", duration: "30 min" }, "2026-08-30", "voice-1");
    expect(afterWorkout.workouts[0]).toMatchObject({ date: "2026-08-30", type: "Run" });
    const afterPayment = applyVoiceActionToState(afterWorkout, { type: "log_debt_payment", debtId: 1, amount: 25 }, "2026-08-30", "voice-2");
    expect(afterPayment.debts[0].paid).toBe(25);
    const afterWeight = applyVoiceActionToState(afterPayment, { type: "log_weight", weight: 79.5 }, "2026-08-30", "voice-3");
    expect(afterWeight.weight).toContainEqual({ date: "2026-08-30", weight: 79.5 });
  });

  it("protects AI advice endpoints behind authentication", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.advice.performance({ context: "{}" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.advice.coach({ message: "Help me plan my day" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated normalized edits and check-ins", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.core.routines.update({ id: 1, title: "Updated" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.core.tasks.complete({ id: 1, completed: true })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});


describe("PIN authentication", () => {
  function createPinResponse() {
    const response = {
      statusCode: 200,
      payload: null as unknown,
      cookie: vi.fn(),
      status(statusCode: number) {
        response.statusCode = statusCode;
        return response;
      },
      json(payload: unknown) {
        response.payload = payload;
        return response;
      },
    };
    return response;
  }

  function createPinRequest(pin: unknown, ip: string) {
    return { body: { pin }, headers: {}, protocol: "https", ip } as any;
  }

  it("accepts the configured initial PIN through the lightweight login endpoint", async () => {
    const response = createPinResponse();
    const configuredPin = process.env.DASHBOARD_PIN || process.env.PIN_LOGIN_INITIAL_PIN || "3030";
    await handleDashboardPinRequest(createPinRequest(configuredPin, "dashboard-test-pin-success"), response as any);
    expect(response.statusCode).toBe(200);
    expect(response.payload).toEqual({ success: true });
    expect(response.cookie).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.objectContaining({ httpOnly: true, secure: true }));
  });

  it("loads existing dashboard data for the same PIN-backed owner record", async () => {
    const result = await appRouter.createCaller(context(mockPinUser)).dashboard.load();
    expect(result?.todos).toEqual([{ id: 7, text: "Persisted task", done: false }]);
  });

  it("rejects an incorrect PIN", async () => {
    const response = createPinResponse();
    await handleDashboardPinRequest(createPinRequest("0000", "dashboard-test-pin-invalid"), response as any);
    expect(response.statusCode).toBe(401);
    expect(response.payload).toEqual({ success: false, error: "That PIN didn’t unlock the dashboard. Check it and try again." });
  });
});

describe("voice update and Daily Rewind boundaries", () => {
  it("protects structured voice updates from unauthenticated access", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.advice.voiceUpdate({ transcript: "I finished the report", context: "{}" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("protects Daily Rewind status and controls from unauthenticated access", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.dailyRewind.status()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.dailyRewind.dismiss()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.dailyRewind.complete()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

