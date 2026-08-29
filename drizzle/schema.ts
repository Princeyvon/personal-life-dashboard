import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const dashboardSnapshots = mysqlTable("dashboard_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  snapshot: text("snapshot").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("dashboard_snapshots_user_id_idx").on(table.userId),
}));

export type DashboardSnapshot = typeof dashboardSnapshots.$inferSelect;
export type InsertDashboardSnapshot = typeof dashboardSnapshots.$inferInsert;

const ownerIndex = (name: string, column: any) => ({ [name]: index(name).on(column) });

export const routines = mysqlTable("routines", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(), domain: varchar("domain", { length: 64 }),
  cadence: varchar("cadence", { length: 64 }), completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userIdIdx: index("routines_user_id_idx").on(table.userId) }));

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(), domain: varchar("domain", { length: 64 }),
  dueDate: varchar("dueDate", { length: 32 }), completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userIdIdx: index("tasks_user_id_idx").on(table.userId) }));

export const goals = mysqlTable("goals", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(), domain: varchar("domain", { length: 64 }),
  completedAt: timestamp("completedAt"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userIdIdx: index("goals_user_id_idx").on(table.userId) }));

export const notes = mysqlTable("notes", {
  id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(),
  body: text("body").notNull(), domain: varchar("domain", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userIdIdx: index("notes_user_id_idx").on(table.userId) }));

export type Routine = typeof routines.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Note = typeof notes.$inferSelect;