# Dashboard Data Architecture

The supplied dashboard is a large single-page JSX experience with multiple legacy collections and local event handlers. To preserve its current UI and interaction behavior, the first cloud-backed release uses a validated per-user compatibility snapshot for hydration and debounced autosave. This keeps existing create, edit, complete/check-in, and delete controls visually unchanged while ensuring each authenticated user reads and writes only their own state.

In parallel, the database now includes normalized user-owned `routines`, `tasks`, `goals`, and `notes` tables, with protected typed procedures for list, create, completion/check-in, and delete operations. These APIs provide the production migration path for moving individual UI sections from snapshot compatibility to record-level persistence without requiring a visual redesign.

All new cloud boundaries validate ownership through the authenticated user id. Snapshot save failures are surfaced in the UI instead of being silently ignored. Scheduled reminders remain deferred and are documented separately because they require deployed Heartbeat callbacks rather than browser or process timers.
