import { z } from "zod";

const legacyItem = z.record(z.string(), z.unknown());
const todo = z.object({ id: z.union([z.string(), z.number()]), text: z.string(), due: z.string().optional(), time: z.string().optional(), domain: z.string().optional(), done: z.boolean() }).passthrough();
const income = z.object({ id: z.union([z.string(), z.number()]), source: z.string(), toReceive: z.number(), paid: z.number() }).passthrough();
const debt = z.object({ id: z.union([z.string(), z.number()]), name: z.string(), debt: z.number(), paid: z.number(), status: z.string() }).passthrough();
const routine = z.object({ id: z.union([z.string(), z.number()]), title: z.string(), domain: z.string().optional(), completedAt: z.string().nullable().optional() }).passthrough();
const task = z.object({ id: z.union([z.string(), z.number()]), title: z.string().optional(), name: z.string().optional(), status: z.string().optional(), done: z.boolean().optional() }).passthrough();
const goal = z.object({ id: z.union([z.string(), z.number()]), text: z.string().optional(), title: z.string().optional(), done: z.boolean().optional() }).passthrough();
const note = z.object({ id: z.union([z.string(), z.number()]), body: z.string().optional(), notes: z.string().optional() }).passthrough();
const person = z.object({ id: z.union([z.string(), z.number()]), name: z.string(), type: z.string(), lastContacted: z.string(), threshold: z.number(), notes: z.string().optional(), goals: z.array(goal).optional() }).passthrough();

export const dashboardSnapshotSchema = z.object({
  todos: z.array(todo), income: z.array(income), debts: z.array(debt),
  weight: z.array(legacyItem), workouts: z.array(legacyItem), sleep: z.array(legacyItem),
  conditionLog: z.array(legacyItem), diseases: z.array(legacyItem), projects: z.array(legacyItem),
  assignments: z.array(legacyItem), readings: z.array(legacyItem), classes: z.array(legacyItem),
  syllabusEvents: z.array(legacyItem), applications: z.array(legacyItem), recommenders: z.array(legacyItem),
  people: z.array(person), voiceLog: z.array(legacyItem),
  routines: z.array(routine).optional(), tasks: z.array(task).optional(), goals: z.array(goal).optional(), notes: z.array(note).optional(), todayPlan: z.record(z.string(), z.array(legacyItem)).optional(),
});

export type DashboardSnapshotInput = z.infer<typeof dashboardSnapshotSchema>;
