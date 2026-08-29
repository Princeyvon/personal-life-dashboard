# Reminder Scheduling Decision

Scheduled reminders are intentionally deferred in this UI-preservation pass. The current release focuses on framework conversion, authentication, isolated cloud persistence, and preserving the supplied dashboard experience without adding new controls or changing its navigation.

If reminders are added later, they should use the platform Heartbeat workflow rather than an in-process timer. The implementation should expose a callback under `/api/scheduled/`, associate each scheduled task with an authenticated user-owned record, and only create or manage schedules after the site has been deployed. This keeps reminders reliable across autoscaling and instance shutdowns.
