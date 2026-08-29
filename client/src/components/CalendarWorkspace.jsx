import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, RefreshCw, Sparkles, X } from "lucide-react";

const DAY_MS = 24 * 60 * 60 * 1000;
const views = ["month", "week", "day", "agenda"];

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function localDateInput(value) {
  const date = value instanceof Date ? value : new Date(value);
  return dateKey(new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000));
}

function dateLabel(value, options = {}) {
  return new Intl.DateTimeFormat(undefined, options).format(value instanceof Date ? value : new Date(value));
}

function startOfWeek(value) {
  const date = new Date(value);
  const day = date.getDay();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

function startOfMonth(value) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function endOfMonth(value) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999);
}

function eventStart(event) {
  return event.startAt instanceof Date ? event.startAt : new Date(event.startAt);
}

function eventEnd(event) {
  return event.endAt instanceof Date ? event.endAt : new Date(event.endAt);
}

function eventTime(event) {
  if (event.allDay) return "All day";
  return dateLabel(eventStart(event), { hour: "numeric", minute: "2-digit" });
}

function makeDerivedEvents({ todos = [], assignments = [], syllabusEvents = [], projects = [], people = [] }) {
  const taskEvents = todos.filter((item) => item.due && !item.done).map((item) => ({
    id: `todo-${item.id}`,
    title: item.text,
    startAt: new Date(`${item.due}T09:00:00`),
    endAt: new Date(`${item.due}T09:30:00`),
    allDay: 0,
    source: "dashboard",
    derived: true,
    domain: item.domain || "home",
  }));
  const assignmentEvents = assignments.filter((item) => item.due).map((item) => ({
    id: `assignment-${item.id}`,
    title: `Due: ${item.title || item.name || "Assignment"}`,
    startAt: new Date(`${item.due}T23:00:00`),
    endAt: new Date(`${item.due}T23:30:00`),
    allDay: 0,
    source: "dashboard",
    derived: true,
    domain: "school",
  }));
  const syllabus = syllabusEvents.filter((item) => item.date).map((item) => ({
    id: `syllabus-${item.id}`,
    title: item.title || item.name || "School deadline",
    startAt: new Date(`${item.date}T09:00:00`),
    endAt: new Date(`${item.date}T09:30:00`),
    allDay: 0,
    source: "dashboard",
    derived: true,
    domain: "school",
  }));
  const peopleEvents = people.filter((person) => person.lastContacted).map((person) => {
    const next = new Date(person.lastContacted);
    next.setDate(next.getDate() + Number(person.threshold || 14));
    return {
      id: `relationship-${person.id}`,
      title: `Check in with ${person.name}`,
      startAt: new Date(`${dateKey(next)}T10:00:00`),
      endAt: new Date(`${dateKey(next)}T10:30:00`),
      allDay: 0,
      source: "dashboard",
      derived: true,
      domain: "relationships",
    };
  });
  const projectEvents = projects.flatMap((project) => (project.tasks || []).filter((task) => task.dueDate).map((task) => ({
    id: `project-${project.id}-${task.id}`,
    title: `${project.name}: ${task.title}`,
    startAt: new Date(`${task.dueDate}T09:00:00`),
    endAt: new Date(`${task.dueDate}T09:30:00`),
    allDay: 0,
    source: "dashboard",
    derived: true,
    domain: "work",
  })));
  return [...taskEvents, ...assignmentEvents, ...syllabus, ...peopleEvents, ...projectEvents].filter((event) => !Number.isNaN(eventStart(event).getTime()));
}

function rangeFor(cursor, view) {
  if (view === "day") {
    const start = new Date(cursor); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (view === "week") {
    const start = startOfWeek(cursor);
    const end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  const start = startOfMonth(cursor);
  const end = endOfMonth(cursor);
  return { start, end };
}

function EventPill({ event, onClick }) {
  return (
    <button type="button" onClick={() => onClick(event)} className={`w-full text-left truncate rounded-md px-2 py-1 text-[11px] transition-transform duration-150 active:scale-[0.98] ${event.source === "google" ? "bg-blue-50 text-blue-700" : event.derived ? "bg-neutral-100 text-neutral-600" : "bg-lime-50 text-lime-800"}`}>
      <span className="font-medium">{event.allDay ? "" : `${eventTime(event)} · `}</span>{event.title}
    </button>
  );
}

export default function CalendarWorkspace({ todos, assignments, syllabusEvents, projects, people, onIdeas }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState("month");
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [syncMessage, setSyncMessage] = useState("");
  const range = useMemo(() => rangeFor(cursor, view), [cursor, view]);
  const input = useMemo(() => ({ startAt: range.start.toISOString(), endAt: range.end.toISOString() }), [range]);
  const statusQuery = trpc.calendar.status.useQuery(undefined, { retry: false });
  const eventsQuery = trpc.calendar.list.useQuery(input, { retry: false });
  const utils = trpc.useUtils();
  const syncMutation = trpc.calendar.sync.useMutation({ onSuccess: (result) => { setSyncMessage(`${result.imported} Google event${result.imported === 1 ? "" : "s"} synced${result.removed ? ` · ${result.removed} removed` : ""}.`); utils.calendar.list.invalidate(); utils.calendar.status.invalidate(); }, onError: (error) => setSyncMessage(error.message || "Sync failed. Try again.") });
  const createMutation = trpc.calendar.create.useMutation({ onSuccess: () => { setDraft(null); setSyncMessage("Event saved and mirrored to Google Calendar."); utils.calendar.list.invalidate(); }, onError: (error) => setSyncMessage(error.message || "Event could not be saved.") });
  const updateMutation = trpc.calendar.update.useMutation({ onSuccess: () => { setSelected(null); setDraft(null); setSyncMessage("Event updated and mirrored to Google Calendar."); utils.calendar.list.invalidate(); }, onError: (error) => setSyncMessage(error.message || "Event could not be updated.") });
  const deleteMutation = trpc.calendar.delete.useMutation({ onSuccess: () => { setSelected(null); setSyncMessage("Event deleted from the dashboard and Google Calendar."); utils.calendar.list.invalidate(); }, onError: (error) => setSyncMessage(error.message || "Event could not be deleted.") });
  const derivedEvents = useMemo(() => makeDerivedEvents({ todos, assignments, syllabusEvents, projects, people }), [todos, assignments, syllabusEvents, projects, people]);
  const storedEvents = eventsQuery.data || [];
  const events = useMemo(() => [...storedEvents, ...derivedEvents].sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime()), [storedEvents, derivedEvents]);
  const visibleEvents = useMemo(() => events.filter((event) => eventStart(event) <= range.end && eventEnd(event) >= range.start), [events, range]);
  const monthDays = useMemo(() => {
    const start = startOfMonth(cursor);
    const gridStart = new Date(start); gridStart.setDate(1 - start.getDay()); gridStart.setHours(0, 0, 0, 0);
    return Array.from({ length: 42 }, (_, index) => { const day = new Date(gridStart); day.setDate(gridStart.getDate() + index); return day; });
  }, [cursor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => { const day = startOfWeek(cursor); day.setDate(day.getDate() + index); return day; }), [cursor]);
  const go = (direction) => setCursor((value) => { const next = new Date(value); if (view === "day") next.setDate(next.getDate() + direction); else if (view === "week") next.setDate(next.getDate() + direction * 7); else next.setMonth(next.getMonth() + direction); return next; });
  const openCreate = (date = cursor) => setDraft({ title: "", description: "", location: "", date: localDateInput(date), start: "09:00", end: "10:00", allDay: false });
  const submitDraft = (event) => {
    event.preventDefault();
    if (!draft?.title.trim()) return;
    const startAt = draft.allDay ? `${draft.date}T00:00:00.000Z` : `${draft.date}T${draft.start}:00`;
    const endAt = draft.allDay ? `${draft.date}T23:59:59.000Z` : `${draft.date}T${draft.end}:00`;
    const payload = { title: draft.title.trim(), description: draft.description || undefined, location: draft.location || undefined, startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString(), allDay: draft.allDay };
    if (draft.id) updateMutation.mutate({ id: draft.id, ...payload }); else createMutation.mutate(payload);
  };
  const startSync = () => {
    setSyncMessage("Syncing with Google Calendar…");
    syncMutation.mutate({ startAt: range.start.toISOString(), endAt: range.end.toISOString() });
  };
  const title = view === "day" ? dateLabel(cursor, { weekday: "long", month: "long", day: "numeric" }) : view === "week" ? `${dateLabel(weekDays[0], { month: "short", day: "numeric" })} – ${dateLabel(weekDays[6], { month: "short", day: "numeric", year: "numeric" })}` : dateLabel(cursor, { month: "long", year: "numeric" });
  const isWorking = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || syncMutation.isPending;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Previous period" onClick={() => go(-1)} className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-neutral-500 transition-transform duration-150 active:scale-[0.97]"><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => setCursor(new Date())} className="rounded-full bg-white px-4 py-2 text-xs font-medium text-neutral-700 transition-transform duration-150 active:scale-[0.97]">Today</button>
          <button type="button" aria-label="Next period" onClick={() => go(1)} className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-neutral-500 transition-transform duration-150 active:scale-[0.97]"><ChevronRight size={16} /></button>
          <h2 className="ml-1 text-base font-semibold text-neutral-900">{title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-neutral-100 p-1">{views.map((item) => <button key={item} type="button" onClick={() => setView(item)} className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${view === item ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"}`}>{item}</button>)}</div>
          <button type="button" onClick={() => onIdeas?.("Calendar planning", JSON.stringify({ events: visibleEvents.slice(0, 30), view }))} className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1.5 text-[11px] font-medium text-neutral-600 transition-transform duration-150 active:scale-[0.97]"><Sparkles size={12} /> Ideas</button>
          <button type="button" onClick={() => openCreate(cursor)} className="inline-flex items-center gap-1 rounded-lg bg-lime-400 px-3 py-2 text-xs font-medium text-neutral-950 transition-transform duration-150 active:scale-[0.97]"><Plus size={14} /> New event</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-neutral-500"><CalendarIcon size={14} className="text-neutral-400" />{statusQuery.data?.connected ? <><span>Google Calendar connected</span>{statusQuery.data.lastSyncedAt && <span className="text-neutral-300">· Synced {dateLabel(statusQuery.data.lastSyncedAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}</> : <span>Connect Google Calendar for two-way sync</span>}</div>
        <div className="flex items-center gap-2"><button type="button" onClick={startSync} disabled={!statusQuery.data?.connected || isWorking} className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-700 disabled:opacity-50"><RefreshCw size={13} className={syncMutation.isPending ? "animate-spin" : ""} /> {syncMutation.isPending ? "Syncing…" : "Sync now"}</button>{!statusQuery.data?.connected && <a href="/api/google-calendar/connect" className="rounded-lg bg-neutral-950 px-3 py-2 text-xs font-medium text-white">Connect</a>}</div>
        {syncMessage && <p className="w-full text-xs text-neutral-500" aria-live="polite">{syncMessage}</p>}
      </div>

      {eventsQuery.isLoading ? <div className="rounded-2xl bg-white p-10 text-center text-sm text-neutral-400">Loading your calendar…</div> : eventsQuery.error ? <div className="rounded-2xl bg-rose-50 p-5 text-sm text-rose-700">We couldn’t load your calendar. Refresh and try again.</div> : view === "month" ? (
        <div className="overflow-hidden rounded-2xl bg-white">
          <div className="grid grid-cols-7 border-b border-neutral-100">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="px-2 py-3 text-center text-[11px] font-medium uppercase tracking-wide text-neutral-400">{day}</div>)}</div>
          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const dayEvents = visibleEvents.filter((event) => dateKey(eventStart(event)) === dateKey(day));
              const muted = day.getMonth() !== cursor.getMonth();
              return <button type="button" key={day.toISOString()} onDoubleClick={() => openCreate(day)} className={`min-h-[112px] border-b border-r border-neutral-100 p-2 text-left align-top transition-colors hover:bg-neutral-50 ${muted ? "bg-neutral-50/60" : "bg-white"}`}><span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${dateKey(day) === dateKey(new Date()) ? "bg-neutral-950 text-white" : muted ? "text-neutral-300" : "text-neutral-600"}`}>{day.getDate()}</span><div className="mt-1 flex flex-col gap-1">{dayEvents.slice(0, 3).map((event) => <EventPill key={event.id} event={event} onClick={setSelected} />)}{dayEvents.length > 3 && <span className="px-2 text-[10px] text-neutral-400">+{dayEvents.length - 3} more</span>}</div></button>;
            })}
          </div>
        </div>
      ) : view === "week" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">{weekDays.map((day) => <div key={day.toISOString()} className="min-h-[220px] rounded-2xl bg-white p-3"><div className="mb-3 flex items-center justify-between"><span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{dateLabel(day, { weekday: "short" })}</span><span className={`text-sm font-semibold ${dateKey(day) === dateKey(new Date()) ? "text-lime-600" : "text-neutral-800"}`}>{day.getDate()}</span></div><div className="flex flex-col gap-1.5">{visibleEvents.filter((event) => dateKey(eventStart(event)) === dateKey(day)).map((event) => <EventPill key={event.id} event={event} onClick={setSelected} />)}{visibleEvents.every((event) => dateKey(eventStart(event)) !== dateKey(day)) && <span className="text-xs text-neutral-300">No events</span>}</div></div>)}</div>
      ) : view === "day" ? (
        <div className="rounded-2xl bg-white p-5"><div className="mb-4 flex items-center gap-2 text-sm font-medium text-neutral-800"><Clock3 size={15} className="text-neutral-400" /> Timeline</div><div className="flex flex-col gap-2">{visibleEvents.length ? visibleEvents.map((event) => <button type="button" key={event.id} onClick={() => setSelected(event)} className="flex items-start gap-4 rounded-xl bg-neutral-50 px-4 py-3 text-left transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.99]"><span className="w-20 shrink-0 text-xs text-neutral-400">{eventTime(event)}</span><span className="text-sm font-medium text-neutral-800">{event.title}</span>{event.location && <span className="ml-auto flex items-center gap-1 text-xs text-neutral-400"><MapPin size={12} />{event.location}</span>}</button>) : <p className="py-8 text-center text-sm text-neutral-400">Nothing scheduled for this day.</p>}</div></div>
      ) : (
        <div className="rounded-2xl bg-white p-5"><div className="flex flex-col gap-2">{visibleEvents.length ? visibleEvents.map((event) => <button type="button" key={event.id} onClick={() => setSelected(event)} className="flex items-center gap-4 rounded-xl bg-neutral-50 px-4 py-3 text-left transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.99]"><span className="w-24 shrink-0 text-xs text-neutral-400">{dateLabel(eventStart(event), { weekday: "short", month: "short", day: "numeric" })}</span><span className="w-20 shrink-0 text-xs text-neutral-400">{eventTime(event)}</span><span className="text-sm font-medium text-neutral-800">{event.title}</span><span className="ml-auto rounded-full bg-white px-2 py-1 text-[10px] uppercase tracking-wide text-neutral-400">{event.source === "google" ? "Google" : event.derived ? "Dashboard" : "Local"}</span></button>) : <p className="py-8 text-center text-sm text-neutral-400">Nothing scheduled in this period.</p>}</div></div>
      )}

      {(draft || selected) && <div className="fixed inset-0 z-30 flex items-end justify-center bg-neutral-950/20 p-4 md:items-center" onClick={() => { setDraft(null); setSelected(null); }}><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>{draft ? <form onSubmit={submitDraft} className="flex flex-col gap-4"><div className="flex items-center justify-between"><h3 className="text-base font-semibold text-neutral-900">{draft.id ? "Edit event" : "New event"}</h3><button type="button" aria-label="Close" onClick={() => setDraft(null)}><X size={16} className="text-neutral-400" /></button></div><input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Event title…" className="rounded-lg border border-neutral-200 px-3 py-2 text-sm" /><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm" /><input type="time" disabled={draft.allDay} value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm disabled:opacity-50" /><input type="time" disabled={draft.allDay} value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm disabled:opacity-50" /></div><label className="flex items-center gap-2 text-xs text-neutral-600"><input type="checkbox" checked={draft.allDay} onChange={(event) => setDraft({ ...draft, allDay: event.target.checked })} /> All-day event</label><input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Location…" className="rounded-lg border border-neutral-200 px-3 py-2 text-sm" /><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Description…" rows={3} className="resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm" /><div className="flex justify-end gap-2"><button type="button" onClick={() => setDraft(null)} className="rounded-lg bg-neutral-100 px-4 py-2 text-xs font-medium text-neutral-600">Cancel</button><button type="submit" disabled={isWorking || !draft.title.trim()} className="rounded-lg bg-lime-400 px-4 py-2 text-xs font-medium text-neutral-950 disabled:opacity-50">{isWorking ? "Saving…" : "Save event"}</button></div></form> : <div className="flex flex-col gap-4"><div className="flex items-start justify-between"><div><p className="text-[11px] uppercase tracking-wide text-neutral-400">{selected.source === "google" ? "Google Calendar" : selected.derived ? "Dashboard item" : "Calendar event"}</p><h3 className="mt-1 text-lg font-semibold text-neutral-900">{selected.title}</h3></div><button type="button" aria-label="Close" onClick={() => setSelected(null)}><X size={16} className="text-neutral-400" /></button></div><div className="flex flex-col gap-2 text-sm text-neutral-600"><span className="flex items-center gap-2"><Clock3 size={14} className="text-neutral-400" />{dateLabel(eventStart(selected), { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · {eventTime(selected)}</span>{selected.location && <span className="flex items-center gap-2"><MapPin size={14} className="text-neutral-400" />{selected.location}</span>}{selected.description && <p className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600 whitespace-pre-wrap">{selected.description}</p>}</div>{selected.derived ? <p className="text-xs text-neutral-400">This item comes from your dashboard. Update it in its source section to keep everything aligned.</p> : <div className="flex justify-end gap-2"><button type="button" onClick={() => { setDraft({ id: selected.id, title: selected.title, description: selected.description || "", location: selected.location || "", date: localDateInput(eventStart(selected)), start: eventStart(selected).toISOString().slice(11, 16), end: eventEnd(selected).toISOString().slice(11, 16), allDay: Boolean(selected.allDay) }); setSelected(null); }} className="rounded-lg bg-neutral-100 px-4 py-2 text-xs font-medium text-neutral-700">Edit</button><button type="button" onClick={() => { if (window.confirm("Delete this event from the dashboard and Google Calendar?")) deleteMutation.mutate({ id: selected.id }); }} disabled={isWorking} className="rounded-lg bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700">Delete</button></div>}</div>}</div></div>}
    </div>
  );
}
