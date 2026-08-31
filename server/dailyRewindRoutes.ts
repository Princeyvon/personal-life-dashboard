import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getDailyRewindByTaskUid, saveDailyRewindSettings } from "./dailyRewindDb";

export function registerDailyRewindRoutes(app: Express) {
  app.post("/api/scheduled/dailyRewind", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const settings = await getDailyRewindByTaskUid(user.taskUid);
      if (!settings) return res.json({ ok: true, skipped: "orphan" });
      if (settings.pending) return res.json({ ok: true, skipped: "already-pending" });
      const timezone = settings.timezone || "UTC";
      const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", hour12: false }).format(new Date()));
      if (hour !== 22) return res.json({ ok: true, skipped: "not-10pm-local", timezone, hour });
      const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
      const localDate = dateFormatter.format(new Date());
      const lastCapturedDate = settings.lastCapturedAt ? dateFormatter.format(settings.lastCapturedAt) : null;
      if (lastCapturedDate === localDate) return res.json({ ok: true, skipped: "already-captured", timezone, localDate });
      await saveDailyRewindSettings(settings.userId, { pending: 1, pendingAt: new Date() });
      return res.json({ ok: true, userId: settings.userId, pending: true, timezone, localDate });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "Daily Rewind callback failed", timestamp: new Date().toISOString() });
    }
  });
}
