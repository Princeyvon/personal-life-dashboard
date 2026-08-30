import React, { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import CalendarWorkspace from "@/components/CalendarWorkspace";
import { applyIncomeReceipt, addIncomeExpected, applyDebtPayment, addDebtPrincipal, appendVoiceNote, buildFinanceInsights, applyVoiceActionToState, filterTodosForProject } from "@shared/interactionHelpers";
import { addRelationshipGoal, editRelationshipGoal, toggleRelationshipGoal, deleteRelationshipGoal } from "@shared/relationshipHelpers";
import {
  Home, HeartPulse, Wallet, Briefcase, GraduationCap, Users, Bell,
  Plus, TrendingUp, TrendingDown, Droplet, Flame, Moon, Dumbbell, Scale,
  Target, AlertTriangle, Check, Trash2, Pencil, ChevronRight, ChevronLeft, ChevronDown, Gauge, Calendar, RefreshCw, MapPin, Pill, ListTodo,
  Mic, Square, Sparkles, X, BookOpen, MessageCircle
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid
} from "recharts";

const domainMeta = {
  health: { label: "Health & Fitness", icon: HeartPulse, color: "emerald" },
  finance: { label: "Finance", icon: Wallet, color: "blue" },
  work: { label: "Work", icon: Briefcase, color: "amber" },
  school: { label: "School", icon: GraduationCap, color: "violet" },
  relationships: { label: "Relationships", icon: Users, color: "rose" },
  calendar: { label: "Calendar", icon: Calendar, color: "lime" },
};

const colorMap = {
  emerald: { badgeBg: "bg-emerald-50", badgeText: "text-emerald-600", dot: "bg-emerald-400", ring: "#34D399", solid: "bg-emerald-400" },
  blue: { badgeBg: "bg-blue-50", badgeText: "text-blue-600", dot: "bg-blue-400", ring: "#60A5FA", solid: "bg-blue-400" },
  amber: { badgeBg: "bg-amber-50", badgeText: "text-amber-600", dot: "bg-amber-400", ring: "#FBBF24", solid: "bg-amber-400" },
  violet: { badgeBg: "bg-violet-50", badgeText: "text-violet-600", dot: "bg-violet-400", ring: "#A78BFA", solid: "bg-violet-400" },
  rose: { badgeBg: "bg-rose-50", badgeText: "text-rose-600", dot: "bg-rose-400", ring: "#FB7185", solid: "bg-rose-400" },
  lime: { badgeBg: "bg-lime-50", badgeText: "text-lime-700", dot: "bg-lime-400", ring: "#A3E635", solid: "bg-lime-400" },
};

function fmt(n) {
  return `RWF ${Math.round(Number(n) || 0).toLocaleString("en-RW")}`;
}

// ---------- shared UI ----------

function StatCard({ icon: Icon, iconColor, label, value, delta, positive }) {
  const c = colorMap[iconColor];
  return (
    <div className="dashboard-card bg-white rounded-[1.35rem] p-5 flex-1 min-w-[150px]">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-neutral-500">{label}</span>
        <div className={`w-8 h-8 rounded-full ${c.badgeBg} flex items-center justify-center`}>
          <Icon size={16} className={c.badgeText} />
        </div>
      </div>
      <div className="text-2xl font-semibold text-neutral-900 tracking-tight">{value}</div>
      {delta && (
        <div className={`flex items-center gap-1 text-xs mt-2 ${positive ? "text-emerald-500" : "text-rose-500"}`}>
          {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          <span>{delta}</span>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const styles = {
    Pending: "bg-amber-50 text-amber-600",
    Received: "bg-emerald-50 text-emerald-600",
    Active: "bg-blue-50 text-blue-600",
    Paid: "bg-emerald-50 text-emerald-600",
    "Not Started": "bg-neutral-100 text-neutral-500",
    "In Progress": "bg-blue-50 text-blue-600",
    Blocked: "bg-rose-50 text-rose-600",
    Done: "bg-emerald-50 text-emerald-600",
    Submitted: "bg-blue-50 text-blue-600",
    Graded: "bg-emerald-50 text-emerald-600",
    "Not Asked": "bg-neutral-100 text-neutral-500",
    Asked: "bg-amber-50 text-amber-600",
    Confirmed: "bg-blue-50 text-blue-600",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-neutral-100 text-neutral-500"}`}>
      {status}
    </span>
  );
}

function ScoreRing({ label, score, colorKey }) {
  const c = colorMap[colorKey];
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} stroke="#F1F1EF" strokeWidth="6" fill="none" />
        <circle
          cx="32" cy="32" r={r} stroke={c.ring} strokeWidth="6" fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
        <text x="32" y="37" textAnchor="middle" fontSize="14" fontWeight="600" fill="#171717">{Math.round(score)}</text>
      </svg>
      <span className="text-xs text-neutral-500 text-center">{label}</span>
    </div>
  );
}

function SectionCard({ title, right, children }) {
  return (
    <section className="dashboard-card bg-white rounded-[1.35rem] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function IdeaButton({ onClick, loading = false }) {
  return <button type="button" onClick={onClick} disabled={loading} className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1.5 text-[11px] font-medium text-neutral-600 transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"><Sparkles size={12} />{loading ? "Thinking…" : "Ideas"}</button>;
}

function ViewTabs({ views, active, onChange }) {
  return (
    <div className="flex items-center gap-1 bg-neutral-100 rounded-full p-1">
      {views.map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
            active === v ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function SubTabs({ tabs, active, onChange }) {
  return (
    <div className="dashboard-tabbar flex gap-2 flex-wrap rounded-full">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${
            active === t.key ? "bg-neutral-950 text-white" : "bg-white text-neutral-600"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function VoiceNoteBox({ onSubmit, loading, placeholder }) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);

  function startRecording() {
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      setSupported(false);
      return;
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setText(transcript);
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setRecording(true);
    } catch {
      setSupported(false);
    }
  }
  function stopRecording() {
    recognitionRef.current?.stop();
    setRecording(false);
  }
  function submit() {
    if (!text.trim() || loading) return;
    onSubmit(text.trim());
    setText("");
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder || "Record a voice note, or just type it here…"}
        rows={3}
        className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 resize-none"
      />
      {!supported && <p className="text-xs text-amber-600 mt-1">Voice recording isn't available in this browser — typing works the same way.</p>}
      <div className="flex gap-2 mt-2">
        {supported && (
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-1 ${recording ? "bg-rose-500 text-white" : "bg-neutral-100 text-neutral-700"}`}
          >
            {recording ? <Square size={14} /> : <Mic size={14} />}
            {recording ? "Stop" : "Record"}
          </button>
        )}
        <button onClick={submit} disabled={loading || !text.trim()} className="px-4 py-2 bg-lime-400 text-neutral-950 text-sm font-medium rounded-lg flex items-center gap-1 disabled:opacity-50">
          <Sparkles size={14} /> {loading ? "Processing…" : "Submit"}
        </button>
      </div>
    </div>
  );
}

function MobileDock({ items, active, onChange }) {
  const activeIndex = Math.max(0, items.findIndex((i) => i.key === active));
  const vbw = 342;
  const cx = (activeIndex + 0.5) * (vbw / items.length);
  const leftPct = ((activeIndex + 0.5) / items.length) * 100;
  const ActiveIcon = items[activeIndex]?.icon;

  return (
    <div className="md:hidden fixed left-0 right-0 bottom-5 flex justify-center px-5 z-20">
      <style>{`
        @keyframes dockPopScale { 0%{transform:scale(.7);} 55%{transform:scale(1.14);} 100%{transform:scale(1);} }
        .dock-pop-inner { animation: dockPopScale .48s cubic-bezier(.34,1.56,.64,1); }
        @media (prefers-reduced-motion: reduce) { .dock-pop-inner { animation: none; } }
      `}</style>
      <div className="relative w-full max-w-[360px]" style={{ height: 64 }}>
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${vbw} 64`} preserveAspectRatio="none">
          <defs>
            <mask id="dockNotchMask" maskUnits="userSpaceOnUse">
              <rect x="0" y="0" width={vbw} height="64" fill="#fff" />
              <circle cx={cx} cy="0" r="30" fill="#000" style={{ transition: "cx .48s cubic-bezier(.34,1.32,.4,1)" }} />
            </mask>
          </defs>
          <rect x="0.5" y="0.5" width={vbw - 1} height="63" rx="26" fill="#0a0a0a" stroke="rgba(255,255,255,0.12)" strokeWidth="1" mask="url(#dockNotchMask)" />
        </svg>

        <div className="absolute inset-0 flex">
          {items.map((it) => {
            const isActive = it.key === active;
            const Icon = it.icon;
            return (
              <button
                key={it.key}
                onClick={() => onChange(it.key)}
                aria-label={domainMeta[it.key]?.label || "Home"}
                className="flex-1 flex items-center justify-center bg-transparent border-0"
              >
                <Icon size={20} className={`transition-all duration-300 ${isActive ? "opacity-0 -translate-y-2 scale-75" : "text-white/60"}`} />
              </button>
            );
          })}
        </div>

        {ActiveIcon && (
          <div
            className="absolute w-14 h-14 rounded-full"
            style={{
              top: -22,
              left: `${leftPct}%`,
              transform: "translateX(-50%)",
              transition: "left .48s cubic-bezier(.34,1.32,.4,1)",
            }}
          >
            <div
              key={active}
              className="dock-pop-inner w-full h-full rounded-full bg-lime-400 flex items-center justify-center"
              style={{ boxShadow: "0 0 0 6px #F5F5F4, 0 8px 20px -4px rgba(163,230,53,.55)" }}
            >
              <ActiveIcon size={20} className="text-neutral-950" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PersonCard({
  person, daysSinceFn, onMarkContacted, onAddGoal, onToggleGoal, onEditGoal, onDeleteGoal,
  onUpdateNotes, onGetTalkingPoints, onDelete, goalDraft, onGoalDraftChange, loading,
}) {
  const days = daysSinceFn(person.lastContacted);
  const overdue = days > person.threshold;
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-neutral-100 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2 cursor-pointer" role="button" tabIndex={0} onClick={() => setExpanded((value) => !value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((value) => !value); } }}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded((value) => !value); }} aria-expanded={expanded} aria-controls={`person-details-${person.id}`} className="text-sm font-medium text-neutral-800 text-left hover:underline">{person.name}</button>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-500">{person.type}</span>
            {overdue
              ? <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-600">Overdue · {days}d</span>
              : <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-600">On pace · {days}d</span>}
          </div>
          <p className="text-xs text-neutral-400 mt-1">Last talked {person.lastContacted} · check in every {person.threshold}d</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-expanded={expanded} aria-controls={`person-details-${person.id}`} onClick={(e) => { e.stopPropagation(); setExpanded((value) => !value); }} className="w-7 h-7 rounded-lg bg-neutral-50 text-neutral-400 flex items-center justify-center transition-transform duration-180 ease-out active:scale-[0.97]" title={expanded ? "Collapse details" : "Expand details"}><ChevronDown size={14} className={`transition-transform duration-180 ease-out ${expanded ? "rotate-180" : ""}`} /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(person.id); }} aria-label={`Delete ${person.name}`}><Trash2 size={14} className="text-neutral-300" /></button>
        </div>
      </div>

      <div id={`person-details-${person.id}`} className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onMarkContacted(person.id)} className="px-3 py-1.5 bg-neutral-100 text-neutral-700 text-xs font-medium rounded-lg">
          Mark contacted
        </button>
        <button
          onClick={() => onGetTalkingPoints(person.id)}
          disabled={loading}
          className="px-3 py-1.5 bg-lime-400 text-neutral-950 text-xs font-medium rounded-lg flex items-center gap-1 disabled:opacity-50"
        >
          <MessageCircle size={12} /> {loading ? "Thinking…" : "What should we talk about?"}
        </button>
      </div>

      {person.talkingPoints && person.talkingPoints.length > 0 && (
        <div className="bg-neutral-50 rounded-lg p-3">
          <p className="text-xs font-medium text-neutral-500 mb-1.5">Talking points</p>
          <ul className="flex flex-col gap-1">
            {person.talkingPoints.map((pt, i) => (
              <li key={i} className="text-xs text-neutral-700 flex gap-1.5">
                <span className="text-neutral-300">•</span>{pt}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-neutral-500 mb-1.5">Goals</p>
        <div className="flex flex-col gap-1">
          {(person.goals || []).map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-2">
              <button onClick={() => onToggleGoal(person.id, g.id)} className="flex items-center gap-2 flex-1 text-left">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${g.done ? "bg-emerald-400" : "border border-neutral-300"}`}>
                  {g.done && <Check size={10} className="text-white" />}
                </span>
                <span className={`text-xs ${g.done ? "text-neutral-400 line-through" : "text-neutral-700"}`}>{g.text}</span>
              </button>
              <div className="flex items-center gap-2"><button onClick={() => onEditGoal(person.id, g.id)} aria-label="Edit goal"><Pencil size={12} className="text-neutral-300 hover:text-neutral-700" /></button><button onClick={() => onDeleteGoal(person.id, g.id)} aria-label="Delete goal"><X size={12} className="text-neutral-300" /></button></div>
            </div>
          ))}
          {(!person.goals || person.goals.length === 0) && <p className="text-xs text-neutral-300">No goals yet.</p>}
        </div>
        <div className="flex gap-2 mt-2">
          <input
            placeholder="Add a goal (e.g. call weekly, plan a visit)"
            value={goalDraft || ""}
            onChange={(e) => onGoalDraftChange(person.id, e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddGoal(person.id)}
            className="flex-1 text-xs border border-neutral-200 rounded-lg px-3 py-1.5"
          />
          <button onClick={() => onAddGoal(person.id)} className="px-3 py-1.5 bg-neutral-100 text-neutral-700 text-xs font-medium rounded-lg">
            <Plus size={12} />
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-neutral-500 mb-1.5">Notes</p>
        <VoiceNoteBox
          onSubmit={(value) => onUpdateNotes(person.id, appendVoiceNote(person.notes || "", value))}
          placeholder="Record a note about them, or type it here…"
        />
      </div>
      <div className="pt-1">
        <p className="text-xs font-medium text-neutral-500 mb-1.5">Activity history</p>
        {(person.activity || []).length === 0 ? <p className="text-xs text-neutral-300">No interactions recorded yet.</p> : <div className="flex flex-col gap-1.5">{person.activity.slice(0, 6).map((item) => <div key={item.id} className="flex items-start justify-between gap-3 text-xs"><span className="text-neutral-600">{item.text}</span><span className="text-neutral-300 shrink-0">{item.date}</span></div>)}</div>}
      </div>
        </div>
      </div>
    </div>
  );
}

// ---------- app ----------

export default function PersonalLifeOS() {
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "home";
    const requested = new URLSearchParams(window.location.search).get("tab");
    return requested && (requested === "calendar" || domainMeta[requested]) ? requested : "home";
  });
  const [homeSub, setHomeSub] = useState("dashboard");
  const [healthSub, setHealthSub] = useState("fitness");
  const [financeSub, setFinanceSub] = useState("income");
  const [schoolSub, setSchoolSub] = useState("Georgetown");
  const today = new Date().toISOString().slice(0, 10);
  const formattedToday = new Date(`${today}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const todayCategories = [
    { key: "gym", label: "Gym", domain: "health", icon: Dumbbell, color: "emerald", defaultText: "Complete today's workout" },
    { key: "food", label: "Food", domain: "health", icon: Droplet, color: "amber", defaultText: "Plan balanced meals and hydrate" },
    { key: "classes", label: "Classes", domain: "school", icon: BookOpen, color: "violet", defaultText: "Stay on top of classwork" },
    { key: "masters", label: "Masters", domain: "school", icon: GraduationCap, color: "blue", defaultText: "Move one application task forward" },
    { key: "work", label: "Work", domain: "work", icon: Briefcase, color: "amber", defaultText: "Make progress on your priority project" },
    { key: "money", label: "Money", domain: "finance", icon: Wallet, color: "blue", defaultText: "Review today's money priorities" },
    { key: "relationships", label: "People", domain: "relationships", icon: Users, color: "rose", defaultText: "Reach out to someone important" },
  ];
  const [todayPlan, setTodayPlan] = useState({});
  const [todayDraft, setTodayDraft] = useState({});
  const [debtAction, setDebtAction] = useState(null);
  const previewMode = import.meta.env.VITE_PREVIEW_MODE === "true";
  const { user, loading: authLoading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: !previewMode });
  const snapshotQuery = trpc.dashboard.load.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const saveSnapshot = trpc.dashboard.save.useMutation();
  const [snapshotReady, setSnapshotReady] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [performanceAdvice, setPerformanceAdvice] = useState("");
  const [coachMessages, setCoachMessages] = useState([]);
  const [coachInput, setCoachInput] = useState("");
  const [ideaResult, setIdeaResult] = useState(null);
  const performanceAdviceMutation = trpc.advice.performance.useMutation();
  const coachMutation = trpc.advice.coach.useMutation();
  const ideasMutation = trpc.advice.ideas.useMutation();
  const voiceUpdateMutation = trpc.advice.voiceUpdate.useMutation();
  const rewindStatusQuery = trpc.dailyRewind.status.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: true });
  const rewindEnabledMutation = trpc.dailyRewind.setEnabled.useMutation({ onSuccess: () => rewindStatusQuery.refetch() });
  const rewindDismissMutation = trpc.dailyRewind.dismiss.useMutation({ onSuccess: () => rewindStatusQuery.refetch() });
  const rewindCompleteMutation = trpc.dailyRewind.complete.useMutation({ onSuccess: () => rewindStatusQuery.refetch() });

  function askPerformanceAdvice() {
    performanceAdviceMutation.mutate({ context: JSON.stringify({ overall, financeScore, fitnessScore, workScore, schoolScore, relationshipScore, unfinishedTodos: todos.filter((t) => !t.done), overduePeople: people.filter((p) => daysSince(p.lastContacted) > p.threshold) }) }, { onSuccess: (data) => setPerformanceAdvice(data.text), onError: () => setPerformanceAdvice("I couldn’t generate advice right now. Please try again.") });
  }
  function askLifeCoach(message) {
    const trimmed = message.trim();
    if (!trimmed || coachMutation.isPending) return;
    const nextHistory = [...coachMessages, { role: "user", text: trimmed }];
    setCoachMessages(nextHistory);
    coachMutation.mutate({ message: trimmed, context: JSON.stringify({ overall, unfinishedTodos: todos.filter((t) => !t.done), debts: debtRows, income: incomeRows, history: nextHistory }) }, { onSuccess: (data) => setCoachMessages((prev) => [...prev, { role: "assistant", text: data.text }]), onError: () => setCoachMessages((prev) => [...prev, { role: "assistant", text: "I couldn’t respond right now. Please try again." }]) });
  }
  function askIdeas(section, context) {
    setIdeaResult({ section, text: "" });
    ideasMutation.mutate({ section, context }, { onSuccess: (data) => setIdeaResult({ section, text: data.text }), onError: () => setIdeaResult({ section, text: "I couldn’t generate ideas right now. Please try again." }) });
  }
  function openNotification(target, sub) {
    setTab(target);
    if (target === "home" && sub) setHomeSub(sub);
    if (target === "school" && sub && ["Georgetown", "Masters"].includes(sub)) setSchoolSub(sub);
    if (target === "finance" && sub && ["income", "debts"].includes(sub)) setFinanceSub(sub);
    if (target === "relationships" && sub && ["Family", "Friends", "Other"].includes(sub)) setRelationshipsSub(sub);
    if (target === "work" && sub) {
      const project = projects.find((p) => p.name === sub);
      if (project) setActiveProject(project.id);
    }
    setShowNotifications(false);
  }
  function notificationTargetForTodo(todo) {
    if (todo.domain === "work") {
      const project = projects.find((p) => todo.text.toLowerCase().includes(p.name.toLowerCase())) || currentProject;
      return { target: "work", sub: project?.name };
    }
    return { target: todo.domain || "home", sub: todo.domain ? undefined : "upcoming" };
  }

  // Todos & reminders (freeform, not tied to a specific tracker record)
  const [todos, setTodos] = useState([
    { id: 1, text: "Pay Pig Sales invoice", due: "2026-08-30", time: "", domain: "finance", done: false },
    { id: 2, text: "Call Nicole back", due: "2026-08-29", time: "18:00", domain: "relationships", done: false },
    { id: 3, text: "Pick up prescription refill", due: "2026-08-29", time: "09:00", domain: "health", done: false },
    { id: 4, text: "Renew gym membership", due: "2026-09-03", time: "", domain: "", done: true },
    { id: 5, text: "Build hero section — Flame Guard site", due: "2026-09-02", time: "", domain: "work", done: false, taskId: 1, projectId: 1 },
    { id: 6, text: "Wire contact form — Flame Guard site", due: "2026-09-05", time: "", domain: "work", done: false, taskId: 2, projectId: 1 },
    { id: 7, text: "Client billing module — Agency OS", due: "2026-08-20", time: "", domain: "work", done: false, taskId: 3, projectId: 2 },
    { id: 8, text: "Define the next rug mosaic deliverable", due: "2026-09-01", time: "", domain: "work", done: false, projectId: 3 },
  ]);
  const [newTodo, setNewTodo] = useState({ text: "", due: "", time: "", domain: "" });
  function addTodo() {
    if (!newTodo.text) return;
    setTodos([...todos, { id: Date.now(), ...newTodo, done: false }]);
    setNewTodo({ text: "", due: "", time: "", domain: "" });
  }
  const [newTodayItem, setNewTodayItem] = useState({ text: "", time: "" });
  function addTodayItem() {
    if (!newTodayItem.text) return;
    setTodos([...todos, { id: Date.now(), text: newTodayItem.text, due: today, time: newTodayItem.time, domain: "", done: false }]);
    setNewTodayItem({ text: "", time: "" });
  }
  const [newUpcomingItem, setNewUpcomingItem] = useState({ text: "", due: "", time: "" });
  function addUpcomingItem() {
    if (!newUpcomingItem.text || !newUpcomingItem.due) return;
    setTodos([...todos, { id: Date.now(), ...newUpcomingItem, domain: "", done: false }]);
    setNewUpcomingItem({ text: "", due: "", time: "" });
  }
  function toggleTodo(id) {
    setTodos((prev) => prev.map((t) => (t.id !== id ? t : { ...t, done: !t.done })));
  }
  function deleteTodo(id) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }
  const sortedTodos = [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.time || "24:00").localeCompare(b.time || "24:00");
  });
  const todayTodos = sortedTodos.filter((t) => !t.due || t.due === today);
  const upcomingTodos = [...todos]
    .filter((t) => t.due && t.due > today)
    .sort((a, b) => new Date(a.due) - new Date(b.due));

  // Finance data
  const [income, setIncome] = useState([
    { id: 1, source: "Job Payment", toReceive: 1000000, paid: 0, date: "2026-08-06", from: "Job" },
    { id: 2, source: "Pig Sales", toReceive: 1000000, paid: 720000, date: "2026-06-24", from: "Pigs" },
    { id: 3, source: "Dress Sales B2", toReceive: 3000000, paid: 0, date: "2026-06-12", from: "Dresses" },
    { id: 4, source: "Salary - Aug 15", toReceive: 900000, paid: 900000, date: "2026-08-15", from: "Salary" },
  ]);
  const [incomeView, setIncomeView] = useState("All Incoming");
  const [newIncome, setNewIncome] = useState({ source: "", toReceive: "", from: "" });

  const incomeRows = income.map((r) => ({
    ...r,
    remaining: r.toReceive - r.paid,
    status: r.toReceive - r.paid <= 0 ? "Received" : "Pending",
  }));
  const filteredIncome = incomeRows.filter((r) => {
    if (incomeView === "Expected") return r.status === "Pending";
    if (incomeView === "Received") return r.status === "Received";
    return true;
  }).sort((a, b) => incomeView === "By Date" ? new Date(a.date) - new Date(b.date) : 0);

  const [debts, setDebts] = useState([
    { id: 1, name: "Mama", debt: 2010000, paid: 75000, date: "2026-07-10", status: "Active" },
    { id: 2, name: "Nicole", debt: 200000, paid: 0, date: "2026-07-17", status: "Active" },
    { id: 3, name: "BOB", debt: 6000000, paid: 330000, date: "2026-09-01", status: "Active" },
    { id: 4, name: "Jeannot", debt: 2900000, paid: 2000000, date: "2026-09-02", status: "Active" },
  ]);
  const [debtView, setDebtView] = useState("Active");
  const [newDebt, setNewDebt] = useState({ name: "", debt: "" });
  function addDebt() {
    if (!newDebt.name || !newDebt.debt) return;
    setDebts([...debts, { id: Date.now(), name: newDebt.name, debt: Number(newDebt.debt), paid: 0, date: today, status: "Active" }]);
    setNewDebt({ name: "", debt: "" });
  }
  function receiveIncome(id) {
    const amount = Number(window.prompt("How much did you receive? You can enter a partial amount.") || 0);
    if (!amount || amount < 0) return;
    setIncome((prev) => prev.map((r) => r.id === id ? { ...r, ...applyIncomeReceipt(r, amount) } : r));
  }
  function addIncomeAmount(id) {
    const amount = Number(window.prompt("How much should be added to this expected income?") || 0);
    if (!amount || amount < 0) return;
    setIncome((prev) => prev.map((r) => r.id === id ? { ...r, ...addIncomeExpected(r, amount) } : r));
  }
  function submitDebtAction() {
    const amount = Number(debtAction?.amount || 0);
    if (!debtAction?.id || !Number.isFinite(amount) || amount <= 0) return;
    setDebts((prev) => prev.map((d) => {
      if (d.id !== debtAction.id) return d;
      return { ...d, ...(debtAction.type === "pay" ? applyDebtPayment(d, amount) : addDebtPrincipal(d, amount)) };
    }));
    setDebtAction(null);
  }
  const debtRows = debts.map((d) => ({ ...d, balance: d.debt - d.paid }));
  const filteredDebts = debtRows.filter((d) => debtView === "Table" ? true : d.status === debtView);
  const debtChartData = debtRows.filter((d) => d.status === "Active").map((d) => ({ name: d.name, value: d.balance }));
  const pieColors = ["#60A5FA", "#FBBF24", "#A78BFA", "#FB7185", "#34D399", "#F97316"];

  const totalExpectedIncome = incomeRows.reduce((s, r) => s + r.remaining + r.paid, 0);
  const totalOutstandingDebt = debtRows.filter((d) => d.status === "Active").reduce((s, d) => s + d.balance, 0);
  const netPosition = totalExpectedIncome - totalOutstandingDebt;
  const financeInsights = useMemo(() => buildFinanceInsights(incomeRows, debtRows), [incomeRows, debtRows]);

  // Health & fitness
  const [weight, setWeight] = useState([
    { date: "Jul 1", weight: 68 }, { date: "Jul 8", weight: 68.4 }, { date: "Jul 15", weight: 69 },
    { date: "Jul 22", weight: 69.3 }, { date: "Jul 29", weight: 70.1 }, { date: "Aug 5", weight: 70.5 },
  ]);
  const targetWeight = 78;
  const targetDate = "Dec 1";
  const startWeight = weight[0].weight;
  const currentWeight = weight[weight.length - 1].weight;
  const goalProgress = Math.min(100, ((currentWeight - startWeight) / (targetWeight - startWeight)) * 100);

  const [workouts, setWorkouts] = useState([
    { id: 1, date: "Aug 26", type: "Push Day", duration: "52 min" },
    { id: 2, date: "Aug 24", type: "Legs", duration: "61 min" },
    { id: 3, date: "Aug 22", type: "Cardio", duration: "30 min" },
  ]);
  const defaultFitnessPlan = [
    { key: "push", label: "Push", focus: "Chest · Shoulders · Triceps", exercises: [{ name: "Bench press", sets: 4, reps: "6–10", rest: "2–3 min" }, { name: "Incline dumbbell press", sets: 3, reps: "8–12", rest: "90 sec" }, { name: "Overhead shoulder press", sets: 3, reps: "8–10", rest: "90 sec" }, { name: "Lateral raises", sets: 3, reps: "12–15", rest: "60 sec" }, { name: "Triceps rope pushdown", sets: 3, reps: "10–15", rest: "60 sec" }, { name: "Overhead triceps extension", sets: 2, reps: "10–12", rest: "60 sec" }] },
    { key: "pull", label: "Pull", focus: "Back · Biceps", exercises: [{ name: "Deadlift", sets: 4, reps: "5–8", rest: "2–3 min" }, { name: "Pull-ups / lat pulldown", sets: 4, reps: "6–10", rest: "90 sec" }, { name: "Barbell row", sets: 3, reps: "8–12", rest: "90 sec" }, { name: "Face pulls", sets: 3, reps: "12–15", rest: "60 sec" }, { name: "Barbell curl", sets: 3, reps: "10–12", rest: "60 sec" }, { name: "Hammer curl", sets: 2, reps: "10–12", rest: "60 sec" }] },
    { key: "legs", label: "Legs & core", focus: "Quads · Hamstrings · Glutes · Calves · Abs", exercises: [{ name: "Back squat", sets: 4, reps: "6–10", rest: "2–3 min" }, { name: "Romanian deadlift", sets: 3, reps: "8–12", rest: "90 sec" }, { name: "Walking lunges", sets: 3, reps: "10–12 / leg", rest: "90 sec" }, { name: "Leg press", sets: 3, reps: "10–12", rest: "90 sec" }, { name: "Calf raise", sets: 4, reps: "12–15", rest: "60 sec" }, { name: "Hanging leg raise", sets: 3, reps: "12–15", rest: "60 sec" }, { name: "Plank", sets: 3, reps: "30–60 sec", rest: "45 sec" }] },
    { key: "rest", label: "Rest & recover", focus: "Walking · Mobility · Light activity", exercises: [] },
  ];
  const [fitnessPlan, setFitnessPlan] = useState(defaultFitnessPlan);
  const [fitnessDayIndex, setFitnessDayIndex] = useState(0);
  const currentFitnessDay = fitnessPlan[fitnessDayIndex % fitnessPlan.length] || defaultFitnessPlan[0];
  const exerciseMuscles = { "Bench press": ["Chest", "Triceps"], "Incline dumbbell press": ["Upper chest", "Shoulders"], "Overhead shoulder press": ["Shoulders", "Triceps"], "Lateral raises": ["Side delts"], "Triceps rope pushdown": ["Triceps"], "Overhead triceps extension": ["Triceps"], "Pull-ups": ["Back", "Biceps"], "Barbell row": ["Back", "Biceps"], "Face pulls": ["Rear delts"], "Barbell curl": ["Biceps"], "Back squat": ["Quads", "Glutes"], "Romanian deadlift": ["Hamstrings", "Glutes"], "Leg press": ["Quads"], "Calf raises": ["Calves"], "Plank": ["Core"] };
  function exerciseRange(value) { const numbers = String(value || "8–12").match(/\d+/g)?.map(Number) || [8, 12]; return { min: numbers[0], max: numbers[1] || numbers[0] }; }
  function coachRecommendation(exercise) {
    const history = liftLog.filter((entry) => entry.exercise === exercise.name).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const previous = history[0];
    const range = exerciseRange(exercise.reps);
    const baseLoad = previous?.load || 20;
    const progressed = previous && Number(previous.reps) >= range.max ? baseLoad + 2.5 : baseLoad;
    const adjusted = previous && Number(previous.reps) < range.min ? Math.max(2.5, baseLoad - 2.5) : progressed;
    return { load: adjusted, reps: previous?.reps && Number(previous.reps) >= range.min ? Math.min(range.max, Number(previous.reps)) : range.min, rationale: previous ? (Number(previous.reps) >= range.max ? "You reached the top of your rep range last time, so the coach suggests a small load increase." : Number(previous.reps) < range.min ? "Your last set fell below the target range, so the coach is holding or slightly reducing load." : "The coach is holding your last successful load while you build repeatable reps.") : "No previous entry yet; start conservatively and adjust if your form changes." };
  }
  const coachMuscleCoverage = [...new Set(currentFitnessDay.exercises.flatMap((exercise) => exerciseMuscles[exercise.name] || []))];

  const [coachSession, setCoachSession] = useState({ active: false, exerciseIndex: 0, setIndex: 1, reps: "", load: "" });
  const [coachSeconds, setCoachSeconds] = useState(0);
  const [coachRestSeconds, setCoachRestSeconds] = useState(0);
  useEffect(() => {
    if (!coachSession.active) return undefined;
    const timer = window.setInterval(() => { setCoachSeconds((seconds) => seconds + 1); setCoachRestSeconds((seconds) => Math.max(0, seconds - 1)); }, 1000);
    return () => window.clearInterval(timer);
  }, [coachSession.active]);
  const coachExercise = currentFitnessDay.exercises[coachSession.exerciseIndex];
  const coachCompleted = currentFitnessDay.exercises.length ? Math.round((coachSession.exerciseIndex / currentFitnessDay.exercises.length) * 100) : 100;
  function startCoach() { if (!currentFitnessDay.exercises.length) return; const first = coachRecommendation(currentFitnessDay.exercises[0]); setCoachSession({ active: true, exerciseIndex: 0, setIndex: 1, reps: String(first.reps), load: String(first.load) }); setCoachSeconds(0); setCoachRestSeconds(0); }
  function finishCoachSet() {
    if (!coachExercise || !coachSession.reps || !coachSession.load) return;
    setLiftLog((prev) => [{ id: Date.now(), date: today, exercise: coachExercise.name, load: Number(coachSession.load), unit: "kg", reps: Number(coachSession.reps), sets: 1, note: `Live coach · set ${coachSession.setIndex}` }, ...prev]);
    const nextSet = coachSession.setIndex + 1;
    setCoachRestSeconds(Number(String(coachExercise.rest).match(/\d+/)?.[0] || 90));
    if (nextSet <= coachExercise.sets) { const nextRecommendation = coachRecommendation(coachExercise); setCoachSession((prev) => ({ ...prev, setIndex: nextSet, reps: String(nextRecommendation.reps), load: String(nextRecommendation.load) })); }
    else if (coachSession.exerciseIndex + 1 < currentFitnessDay.exercises.length) { const nextExercise = currentFitnessDay.exercises[coachSession.exerciseIndex + 1]; const nextRecommendation = coachRecommendation(nextExercise); setCoachSession((prev) => ({ ...prev, exerciseIndex: prev.exerciseIndex + 1, setIndex: 1, reps: String(nextRecommendation.reps), load: String(nextRecommendation.load) })); }
    else setCoachSession((prev) => ({ ...prev, active: false }));
  }
  function stopCoach() { setCoachSession((prev) => ({ ...prev, active: false })); }
  const [liftLog, setLiftLog] = useState([{ id: 1, date: "Aug 26", exercise: "Bench press", load: 45, unit: "kg", reps: 8, sets: 4, note: "Controlled reps" }, { id: 2, date: "Aug 24", exercise: "Back squat", load: 60, unit: "kg", reps: 8, sets: 4, note: "Felt steady" }]);
  const favoriteExercises = Object.entries(liftLog.reduce((counts, entry) => ({ ...counts, [entry.exercise]: (counts[entry.exercise] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
  const currentCoachRecommendation = coachExercise ? coachRecommendation(coachExercise) : null;
  const muscleFrequency = liftLog.reduce((counts, entry) => { (exerciseMuscles[entry.exercise] || []).forEach((muscle) => { counts[muscle] = (counts[muscle] || 0) + 1; }); return counts; }, {});
  const priorityMuscle = coachMuscleCoverage.slice().sort((a, b) => (muscleFrequency[a] || 0) - (muscleFrequency[b] || 0))[0];
  const [newLift, setNewLift] = useState({ exercise: "", load: "", reps: "", sets: "" });
  const [newPlanExercise, setNewPlanExercise] = useState({ name: "", sets: "3", reps: "8–12", rest: "90 sec" });
  function addPlanExercise() {
    if (!newPlanExercise.name || currentFitnessDay.key === "rest") return;
    setFitnessPlan((prev) => prev.map((day) => day.key !== currentFitnessDay.key ? day : { ...day, exercises: [...day.exercises, { ...newPlanExercise, sets: Number(newPlanExercise.sets || 3) }] }));
    setNewPlanExercise({ name: "", sets: "3", reps: "8–12", rest: "90 sec" });
  }
  function addLift() {
    if (!newLift.exercise || !newLift.load || !newLift.reps) return;
    setLiftLog((prev) => [{ id: Date.now(), date: today, exercise: newLift.exercise, load: Number(newLift.load), unit: "kg", reps: Number(newLift.reps), sets: Number(newLift.sets || 1), note: "" }, ...prev]);
    setNewLift({ exercise: "", load: "", reps: "", sets: "" });
  }
  const nutritionPlan = [{ slot: "Breakfast", meal: "Eggs, oats, fruit, and milk", cue: "Add a protein source" }, { slot: "Lunch", meal: "Rice or potatoes, beans or lean meat, vegetables", cue: "Build a full plate" }, { slot: "Pre-workout", meal: "Banana with yogurt or peanut butter", cue: "Keep it easy to digest" }, { slot: "Dinner", meal: "Carbs, protein, vegetables, and healthy fats", cue: "Eat enough to recover" }, { slot: "Before sleep", meal: "Milk or yogurt with nuts", cue: "Optional if hungry" }];
  const [newWorkout, setNewWorkout] = useState({ type: "", duration: "" });
  function addWorkout() {
    if (!newWorkout.type) return;
    setWorkouts([{ id: Date.now(), date: today, type: newWorkout.type, duration: newWorkout.duration || "—" }, ...workouts]);
    setNewWorkout({ type: "", duration: "" });
  }

  const [newWeight, setNewWeight] = useState("");
  function addWeight() {
    if (!newWeight) return;
    setWeight((prev) => {
      const rest = prev.filter((w) => w.date !== today);
      return [...rest, { date: today, weight: Number(newWeight) }];
    });
    setNewWeight("");
  }

  const [sleep, setSleep] = useState([
    { date: "Aug 22", hours: 6.5, quality: "Fair" }, { date: "Aug 23", hours: 7, quality: "Good" }, { date: "Aug 24", hours: 5.5, quality: "Low" },
    { date: "Aug 25", hours: 7.5, quality: "Good" }, { date: "Aug 26", hours: 6, quality: "Fair" }, { date: "Aug 27", hours: 8, quality: "Good" },
  ]);
  const [newSleep, setNewSleep] = useState("");
  const [newSleepMeta, setNewSleepMeta] = useState({ bedtime: "", wake: "", quality: "Good" });
  function addSleep() {
    if (!newSleep) return;
    setSleep((prev) => {
      const rest = prev.filter((s) => s.date !== today);
      return [...rest, { date: today, hours: Number(newSleep), quality: newSleepMeta.quality, bedtime: newSleepMeta.bedtime, wake: newSleepMeta.wake }];
    });
    setNewSleep("");
    setNewSleepMeta({ bedtime: "", wake: "", quality: "Good" });
  }
  const avgSleep = sleep.length ? (sleep.reduce((s, x) => s + x.hours, 0) / sleep.length).toFixed(1) : 0;

  const [conditionLog, setConditionLog] = useState([
    { id: 1, date: "Aug 27", note: "Stable, no symptoms", medTaken: true, nextAppointment: "2026-09-10" },
    { id: 2, date: "Aug 26", note: "Mild headache in the evening", medTaken: true, nextAppointment: "2026-09-10" },
    { id: 3, date: "Aug 25", note: "Stable", medTaken: false, nextAppointment: "2026-09-10" },
    { id: 4, date: "Aug 24", note: "Stable", medTaken: true, nextAppointment: "2026-09-10" },
  ]);
  const adherencePct = Math.round((conditionLog.filter((c) => c.medTaken).length / conditionLog.length) * 100);
  const nextAppointment = conditionLog[0]?.nextAppointment;
  const [newCondition, setNewCondition] = useState({ note: "", medTaken: true });
  function addCondition() {
    setConditionLog([{ id: Date.now(), date: today, note: newCondition.note || "No note", medTaken: newCondition.medTaken, nextAppointment }, ...conditionLog]);
    setNewCondition({ note: "", medTaken: true });
  }

  const [diseases, setDiseases] = useState([{ id: 1, name: "Seasonal allergies", status: "Active", since: "2026-08-01" }]);
  const [diseaseArchive, setDiseaseArchive] = useState([]);
  const [healthSchedules, setHealthSchedules] = useState([{ id: 1, title: "Sleep log", time: "22:00", cadence: "Daily", enabled: true }, { id: 2, title: "Wake-up check-in", time: "07:00", cadence: "Daily", enabled: true }, { id: 3, title: "Weight check", time: "07:10", cadence: "Daily", enabled: false }]);
  const [newHealthSchedule, setNewHealthSchedule] = useState({ title: "", time: "", cadence: "Daily" });
  const [customHealthActivity, setCustomHealthActivity] = useState("");
  function addHealthSchedule(title = newHealthSchedule.title, time = newHealthSchedule.time, cadence = newHealthSchedule.cadence) {
    if (!title || !time) return;
    const id = Date.now();
    setHealthSchedules((prev) => [...prev, { id, title, time, cadence, enabled: true }]);
    setTodos((prev) => [...prev, { id: `health-schedule-${id}`, text: `Check in: ${title}`, due: today, time, domain: "health", done: false, scheduleId: id }]);
    setNewHealthSchedule({ title: "", time: "", cadence: "Daily" });
    setCustomHealthActivity("");
  }
  function toggleHealthSchedule(id) { setHealthSchedules((prev) => prev.map((item) => item.id === id ? { ...item, enabled: !item.enabled } : item)); }
  function archiveDisease(id) { const resolved = diseases.find((disease) => disease.id === id); if (!resolved) return; setDiseases((prev) => prev.filter((disease) => disease.id !== id)); setDiseaseArchive((prev) => [{ ...resolved, status: "Resolved", resolvedOn: today }, ...prev]); }
  const [newDisease, setNewDisease] = useState("");
  function addDisease() {
    if (!newDisease) return;
    setDiseases([...diseases, { id: Date.now(), name: newDisease, status: "Active", since: today }]);
    setNewDisease("");
  }
  function toggleDiseaseStatus(id) { archiveDisease(id); }
  function deleteDisease(id) {
    setDiseases((prev) => prev.filter((d) => d.id !== id));
  }

  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState([
    { role: "assistant", text: "Tell me what's going on — e.g. \"I got the flu\" — and I'll suggest a few temporary habits, and add them to your todos and reminders." },
  ]);
  const [aiLoading, setAiLoading] = useState(false);

  async function askHealthAI() {
    if (!aiInput.trim() || aiLoading) return;
    const userText = aiInput.trim();
    setAiMessages((prev) => [...prev, { role: "user", text: userText }]);
    setAiInput("");
    setAiLoading(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: `You are a supportive health-habit assistant inside a personal dashboard app. The user will describe a symptom or condition (e.g. "I got the flu"). Respond ONLY with a raw JSON object — no markdown fences, no preamble, no extra text — in exactly this shape:
{"diseaseName":"short name of the condition","summary":"one or two short, encouraging, plain-language sentences of practical advice","habits":["short imperative habit 1","short imperative habit 2"],"clinicVisit":true or false,"medication":{"name":"generic OTC name or empty string","times":["HH:MM","HH:MM"]}}
Keep habits to 2-4 short, concrete, temporary actions (e.g. "Drink plenty of water", "Rest this afternoon"). Only set clinicVisit true if the condition plausibly warrants seeing a doctor. Only fill medication with a common generic over-the-counter suggestion and reminder times — never a prescription-only drug or a specific dosage. If nothing medication-related applies, return medication as null.`,
          messages: [{ role: "user", content: userText }],
        }),
      });
      const data = await response.json();
      const raw = (data.content || []).map((b) => b.text || "").join("");
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      setDiseases((prev) => {
        const exists = prev.some((d) => d.name.toLowerCase() === (parsed.diseaseName || "").toLowerCase());
        return exists ? prev : [...prev, { id: Date.now(), name: parsed.diseaseName || userText, status: "Active", since: today }];
      });

      const newItems = [];
      (parsed.habits || []).forEach((h) => newItems.push({ id: Date.now() + Math.random(), text: h, due: today, time: "", domain: "health", done: false }));
      if (parsed.clinicVisit) newItems.push({ id: Date.now() + Math.random(), text: `Visit the clinic for ${parsed.diseaseName || "this"}`, due: today, time: "", domain: "health", done: false });
      if (parsed.medication && parsed.medication.times && parsed.medication.times.length) {
        parsed.medication.times.forEach((t) => newItems.push({ id: Date.now() + Math.random(), text: `Take ${parsed.medication.name || "medication"}`, due: today, time: t, domain: "health", done: false }));
      }
      if (newItems.length) setTodos((prev) => [...prev, ...newItems]);

      setAiMessages((prev) => [...prev, { role: "assistant", text: parsed.summary || "Here's what I'd suggest.", added: newItems.length }]);
    } catch (err) {
      setAiMessages((prev) => [...prev, { role: "assistant", text: "Sorry, I couldn't reach the assistant just now — try again in a moment." }]);
    }
    setAiLoading(false);
  }

  // Work
  const [projects, setProjects] = useState([
    {
      id: 1, name: "Flame Guard site", tasks: [
        { id: 1, name: "Build hero section", status: "In Progress", deadline: "2026-09-02", priority: "High" },
        { id: 2, name: "Wire contact form", status: "Not Started", deadline: "2026-09-05", priority: "Medium" },
      ],
    },
    {
      id: 2, name: "Agency OS", tasks: [
        { id: 3, name: "Client billing module", status: "Blocked", deadline: "2026-08-20", priority: "High" },
      ],
    },
    {
      id: 3, name: "Rug Mosaic", tasks: [],
    },
  ]);
  const [activeProject, setActiveProject] = useState(1);
  const currentProject = projects.find((p) => p.id === activeProject);
  const [newTask, setNewTask] = useState({ name: "", deadline: "", priority: "Medium" });
  const [newProjectTodo, setNewProjectTodo] = useState({ text: "", due: "" });
  const currentProjectTodos = filterTodosForProject(todos, activeProject, currentProject?.name || "");
  function addTask() {
    if (!newTask.name) return;
    const taskId = Date.now();
    const deadline = newTask.deadline || "2026-09-01";
    setProjects((prev) => prev.map((p) => p.id !== activeProject ? p : {
      ...p, tasks: [...p.tasks, { id: taskId, name: newTask.name, status: "Not Started", deadline, priority: newTask.priority }]
    }));
    setTodos((prev) => [...prev, { id: Date.now() + 1, text: `${newTask.name} — ${currentProject?.name}`, due: deadline, time: "", domain: "work", done: false, taskId, projectId: activeProject }]);
    setNewTask({ name: "", deadline: "", priority: "Medium" });
  }
  function addProjectTodo() {
    if (!newProjectTodo.text || !currentProject) return;
    setTodos((prev) => [...prev, { id: Date.now(), text: newProjectTodo.text, due: newProjectTodo.due || today, time: "", domain: "work", done: false, projectId: activeProject }]);
    setNewProjectTodo({ text: "", due: "" });
  }
  const [newProjectName, setNewProjectName] = useState("");
  function addProject() {
    if (!newProjectName) return;
    const id = Date.now();
    setProjects([...projects, { id, name: newProjectName, tasks: [] }]);
    setActiveProject(id);
    setNewProjectName("");
  }

  function cycleStatus(taskId) {
    const order = ["Not Started", "In Progress", "Blocked", "Done"];
    const task = currentProject?.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newStatus = order[(order.indexOf(task.status) + 1) % order.length];
    setProjects((prev) => prev.map((p) => p.id !== activeProject ? p : {
      ...p, tasks: p.tasks.map((t) => t.id !== taskId ? t : { ...t, status: newStatus })
    }));
    setTodos((prev) => prev.map((td) => td.taskId === taskId ? { ...td, done: newStatus === "Done" } : td));
  }

  // School
  const [assignments, setAssignments] = useState([
    { id: 1, title: "Essay 3", course: "Econ 201", due: "2026-09-01", status: "In Progress", grade: null, program: "Georgetown" },
    { id: 2, title: "Problem Set 4", course: "Calc II", due: "2026-08-30", status: "Not Started", grade: null, program: "Georgetown" },
    { id: 3, title: "Lab Report", course: "Chem 101", due: "2026-08-20", status: "Graded", grade: "A-", program: "Georgetown" },
    { id: 4, title: "Thesis outline", course: "Research Seminar", due: "2026-09-05", status: "In Progress", grade: null, program: "Masters" },
    { id: 5, title: "Case study response", course: "Strategy", due: "2026-08-22", status: "Graded", grade: "A", program: "Masters" },
  ]);
  const [readings, setReadings] = useState([
    { id: 1, title: "Ch. 6 — Supply & Demand", course: "Econ 201", done: true, program: "Georgetown" },
    { id: 2, title: "Ch. 4 — Derivatives", course: "Calc II", done: false, program: "Georgetown" },
    { id: 3, title: "Lit review — Ch. 2", course: "Research Seminar", done: false, program: "Masters" },
  ]);
  const schoolAssignments = assignments.filter((a) => a.program === schoolSub);
  const schoolReadings = readings.filter((r) => r.program === schoolSub);
  const gradedByCourse = schoolAssignments.filter((a) => a.grade).reduce((acc, a) => {
    acc[a.course] = acc[a.course] || [];
    acc[a.course].push(a.grade);
    return acc;
  }, {});
  const [newAssignment, setNewAssignment] = useState({ title: "", course: "", due: "" });
  function addAssignment() {
    if (!newAssignment.title) return;
    setAssignments([...assignments, { id: Date.now(), title: newAssignment.title, course: newAssignment.course || "General", due: newAssignment.due || "2026-09-01", status: "Not Started", grade: null, program: schoolSub }]);
    setNewAssignment({ title: "", course: "", due: "" });
  }
  function cycleAssignmentStatus(id) {
    const order = ["Not Started", "In Progress", "Submitted", "Graded"];
    setAssignments((prev) => prev.map((item) => String(item.id) !== String(id) ? item : { ...item, status: order[(order.indexOf(item.status) + 1) % order.length] }));
  }
  const [newReading, setNewReading] = useState({ title: "", course: "" });
  function addReading() {
    if (!newReading.title) return;
    setReadings([...readings, { id: Date.now(), title: newReading.title, course: newReading.course || "General", done: false, program: schoolSub }]);
    setNewReading({ title: "", course: "" });
  }

  // School — Georgetown: classes & syllabus
  const [classes, setClasses] = useState([]);
  const [newClass, setNewClass] = useState({ name: "", professor: "", schedule: "" });
  function addClass() {
    if (!newClass.name) return;
    setClasses([...classes, { id: Date.now(), name: newClass.name, professor: newClass.professor, schedule: newClass.schedule }]);
    setNewClass({ name: "", professor: "", schedule: "" });
  }
  function deleteClass(id) {
    setClasses((prev) => prev.filter((c) => c.id !== id));
  }

  const [syllabusEvents, setSyllabusEvents] = useState([]);
  const [newSyllabusEvent, setNewSyllabusEvent] = useState({ course: "", title: "", type: "Quiz", date: "" });
  function addSyllabusEvent() {
    if (!newSyllabusEvent.title || !newSyllabusEvent.date) return;
    setSyllabusEvents([...syllabusEvents, { id: Date.now(), ...newSyllabusEvent }]);
    setTodos((prev) => [...prev, { id: Date.now() + 1, text: `${newSyllabusEvent.title} — ${newSyllabusEvent.course || "class"}`, due: newSyllabusEvent.date, time: "", domain: "school", done: false }]);
    setNewSyllabusEvent({ course: "", title: "", type: "Quiz", date: "" });
  }
  function deleteSyllabusEvent(id) {
    setSyllabusEvents((prev) => prev.filter((e) => e.id !== id));
  }
  const upcomingSyllabusEvents = [...syllabusEvents].sort((a, b) => new Date(a.date) - new Date(b.date));

  // School — Masters: applications & recommendations
  const [applications, setApplications] = useState([]);
  const [newApplication, setNewApplication] = useState({ school: "", program: "", deadline: "" });
  function addApplication() {
    if (!newApplication.school) return;
    setApplications([...applications, { id: Date.now(), school: newApplication.school, program: newApplication.program, deadline: newApplication.deadline, status: "Not Started" }]);
    if (newApplication.deadline) {
      setTodos((prev) => [...prev, { id: Date.now() + 1, text: `Application deadline — ${newApplication.school}`, due: newApplication.deadline, time: "", domain: "school", done: false }]);
    }
    setNewApplication({ school: "", program: "", deadline: "" });
  }
  function cycleApplicationStatus(id) {
    const order = ["Not Started", "In Progress", "Submitted", "Received"];
    setApplications((prev) => prev.map((a) => String(a.id) !== String(id) ? a : { ...a, status: order[(order.indexOf(a.status) + 1) % order.length] }));
  }
  function deleteApplication(id) {
    setApplications((prev) => prev.filter((a) => a.id !== id));
  }

  const [recommenders, setRecommenders] = useState([]);
  const [newRecommender, setNewRecommender] = useState({ name: "", relationship: "", dueDate: "" });
  function addRecommender() {
    if (!newRecommender.name) return;
    setRecommenders([...recommenders, { id: Date.now(), name: newRecommender.name, relationship: newRecommender.relationship, dueDate: newRecommender.dueDate, status: "Not Asked" }]);
    setNewRecommender({ name: "", relationship: "", dueDate: "" });
  }
  function cycleRecommenderStatus(id) {
    const order = ["Not Asked", "Asked", "Confirmed", "Submitted"];
    setRecommenders((prev) => prev.map((r) => r.id !== id ? r : { ...r, status: order[(order.indexOf(r.status) + 1) % order.length] }));
  }
  function deleteRecommender(id) {
    setRecommenders((prev) => prev.filter((r) => r.id !== id));
  }
  const mastersTodos = todos.filter((t) => t.domain === "school");

  const todayLinkedTodos = (domain, extraFilter = () => true) => todayTodos.filter((todo) => todo.domain === domain && extraFilter(todo)).map((todo) => ({ ...todo, source: "todo" }));
  const todayCardItems = useMemo(() => {
    const sources = {
      gym: [
        ...todayLinkedTodos("health", (todo) => /gym|workout|exercise|run|lift/i.test(todo.text)),
        ...workouts.filter((workout) => workout.date === today || workout.date === "Aug 28").map((workout) => ({ id: `workout-${workout.id}`, text: `${workout.type}${workout.duration ? ` · ${workout.duration}` : ""}`, done: true, source: "workout" })),
        ...healthSchedules.filter((schedule) => schedule.enabled).map((schedule) => ({ id: `schedule-${schedule.id}`, text: `${schedule.title} · ${schedule.time}`, done: Boolean(todayTodos.some((todo) => todo.scheduleId === schedule.id && todo.done)), source: "schedule" })),
        ...currentFitnessDay.exercises.map((exercise) => ({ id: `plan-${currentFitnessDay.key}-${exercise.name}`, text: `${exercise.name} · ${exercise.sets} sets · ${exercise.reps}`, done: false, source: "plan" })),
      ],
      food: [
        ...todayLinkedTodos("health", (todo) => /food|meal|eat|water|hydrate|nutrition/i.test(todo.text)),
        ...nutritionPlan.map((meal) => ({ id: `meal-${meal.slot}`, text: `${meal.slot}: ${meal.meal}`, done: false, source: "plan" })),
      ],
      classes: [...todayLinkedTodos("school", (todo) => !/application|masters|recommend/i.test(todo.text)), ...assignments.filter((item) => item.due === today && item.status !== "Graded").map((item) => ({ id: `assignment-${item.id}`, text: `${item.title}${item.course ? ` · ${item.course}` : ""}`, done: item.status === "Submitted" || item.status === "Graded", source: "assignment" }))],
      masters: [...todayLinkedTodos("school", (todo) => /application|masters|recommend/i.test(todo.text)), ...applications.filter((item) => item.deadline === today && item.status !== "Received").map((item) => ({ id: `application-${item.id}`, text: `Application · ${item.school}`, done: item.status === "Submitted" || item.status === "Received", source: "application" }))],
      work: todayLinkedTodos("work"),
      money: todayLinkedTodos("finance"),
      relationships: todayLinkedTodos("relationships"),
    };
    return todayCategories.reduce((result, category) => {
      const custom = todayPlan[category.key] || [];
      const items = [...sources[category.key], ...custom].filter((item, index, list) => list.findIndex((candidate) => String(candidate.id) === String(item.id)) === index);
      result[category.key] = items.length ? items : [{ id: `${category.key}-default`, text: category.defaultText, done: false, source: "plan" }];
      return result;
    }, {});
  }, [todayPlan, todayTodos, workouts, assignments, applications, currentFitnessDay, nutritionPlan, healthSchedules]);
  function toggleTodayItem(categoryKey, item) {
    if (item.source === "todo") return toggleTodo(item.id);
    if (item.source === "assignment") return cycleAssignmentStatus(String(item.id).replace("assignment-", ""));
    if (item.source === "application") return cycleApplicationStatus(String(item.id).replace("application-", ""));
    if (item.source === "schedule") { const scheduledTodo = todayTodos.find((todo) => todo.scheduleId === Number(String(item.id).replace("schedule-", ""))); if (scheduledTodo) return toggleTodo(scheduledTodo.id); }
    if (item.source === "workout") return;
    setTodayPlan((prev) => {
      const existing = prev[categoryKey] || [];
      const next = existing.some((entry) => entry.id === item.id)
        ? existing.map((entry) => entry.id === item.id ? { ...entry, done: !entry.done } : entry)
        : [...existing, { ...item, source: "plan", done: !item.done }];
      return { ...prev, [categoryKey]: next };
    });
  }
  function addTodayPlanItem(categoryKey) {
    const text = (todayDraft[categoryKey] || "").trim();
    if (!text) return;
    setTodayPlan((prev) => ({ ...prev, [categoryKey]: [...(prev[categoryKey] || []), { id: `plan-${Date.now()}`, text, done: false, source: "plan" }] }));
    setTodayDraft((prev) => ({ ...prev, [categoryKey]: "" }));
  }
  const todayOverall = Math.round(todayCategories.reduce((sum, category) => {
    const items = todayCardItems[category.key] || [];
    return sum + (items.length ? items.filter((item) => item.done).length / items.length * 100 : 0);
  }, 0) / todayCategories.length);

  // Relationships
  const [relationshipsSub, setRelationshipsSub] = useState("Family");
  const [people, setPeople] = useState([
    { id: 1, name: "Mom", type: "Family", lastContacted: "2026-08-25", threshold: 7, goals: [], notes: "", talkingPoints: [], activity: [] },
    { id: 2, name: "Elvin", type: "Friend", lastContacted: "2026-08-10", threshold: 14, goals: [], notes: "", talkingPoints: [], activity: [] },
    { id: 3, name: "Nicole", type: "Friend", lastContacted: "2026-07-30", threshold: 14, goals: [], notes: "", talkingPoints: [], activity: [] },
  ]);
  const daysSince = (d) => Math.floor((new Date("2026-08-28") - new Date(d)) / 86400000);
  const relationshipsFiltered = people.filter((p) =>
    relationshipsSub === "Family" ? ["Family", "Mother", "Father", "Brother", "Sister", "Uncle", "Aunt", "Cousin"].includes(p.type) :
    relationshipsSub === "Friends" ? ["Friend", "Girlfriend", "Boyfriend", "Ex-girlfriend", "Ex-boyfriend", "Partner", "Classmate"].includes(p.type) :
    !["Family", "Mother", "Father", "Brother", "Sister", "Uncle", "Aunt", "Cousin", "Friend", "Girlfriend", "Boyfriend", "Ex-girlfriend", "Ex-boyfriend", "Partner", "Classmate"].includes(p.type)
  );

  function addActivity(personId, type, text) {
    setPeople((prev) => prev.map((p) => p.id !== personId ? p : { ...p, activity: [{ id: Date.now(), date: today, type, text }, ...(p.activity || [])] }));
  }
  function markContacted(id) {
    setPeople((prev) => prev.map((p) => p.id !== id ? p : { ...p, lastContacted: today, activity: [{ id: Date.now(), date: today, type: "Contact", text: "Marked as contacted" }, ...(p.activity || [])] }));
  }
  function deletePerson(id) {
    setPeople((prev) => prev.filter((p) => p.id !== id));
  }
  const [newPerson, setNewPerson] = useState({ name: "", type: "Friend", threshold: "14" });
  function addPerson() {
    if (!newPerson.name) return;
    setPeople([...people, { id: Date.now(), name: newPerson.name, type: newPerson.type, lastContacted: today, threshold: Number(newPerson.threshold) || 14, goals: [], notes: "", talkingPoints: [], activity: [{ id: Date.now() + 1, date: today, type: "Profile", text: "Added to relationships" }] }]);
    setNewPerson({ name: "", type: "Friend", threshold: "14" });
  }

  // Relationship goals & notes
  const [newGoalText, setNewGoalText] = useState({});
  function setGoalDraft(personId, value) {
    setNewGoalText((prev) => ({ ...prev, [personId]: value }));
  }
  function addGoal(personId) {
    const text = (newGoalText[personId] || "").trim();
    if (!text) return;
    setPeople((prev) => prev.map((p) => p.id !== personId ? p : addRelationshipGoal(p, { id: Date.now(), text, done: false }, { id: Date.now() + 1, date: today, type: "Goal", text: `Added goal: ${text}` })));
    setGoalDraft(personId, "");
  }
  function toggleGoal(personId, goalId) {
    setPeople((prev) => prev.map((p) => p.id !== personId ? p : toggleRelationshipGoal(p, goalId, { id: Date.now(), date: today, type: "Goal", text: "Updated goal completion" })));
  }
  function editGoal(personId, goalId) {
    const person = people.find((p) => p.id === personId);
    const goal = person?.goals?.find((g) => g.id === goalId);
    const text = window.prompt("Edit this goal", goal?.text || "")?.trim();
    if (!text) return;
    setPeople((prev) => prev.map((p) => p.id !== personId ? p : editRelationshipGoal(p, goalId, text, { id: Date.now(), date: today, type: "Goal", text: `Edited goal: ${text}` })));
  }
  function deleteGoal(personId, goalId) {
    setPeople((prev) => prev.map((p) => p.id !== personId ? p : deleteRelationshipGoal(p, goalId, { id: Date.now(), date: today, type: "Goal", text: "Deleted a goal" })));
  }
  function updateNotes(personId, notes) {
    setPeople((prev) => prev.map((p) => p.id !== personId ? p : { ...p, notes, activity: [{ id: Date.now(), date: today, type: "Note", text: "Added a voice note" }, ...(p.activity || [])] }));
  }

  // AI conversation-starter suggestions per person
  const [talkingPointsLoading, setTalkingPointsLoading] = useState({});
  async function getTalkingPoints(personId) {
    const person = people.find((p) => p.id === personId);
    if (!person) return;
    setTalkingPointsLoading((prev) => ({ ...prev, [personId]: true }));
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          system: `You help someone prepare for a catch-up conversation with a person in their life. Respond ONLY with a raw JSON object, no markdown fences, no preamble, in exactly this shape:
{"points":["short conversation starter 1","short conversation starter 2","short conversation starter 3"]}
Keep each point to one short, warm, specific sentence or question. Ground them in the goals and notes provided when relevant; otherwise suggest natural, caring check-in questions appropriate for the relationship type and how long it's been since they last talked.`,
          messages: [{
            role: "user",
            content: `Name: ${person.name}\nRelationship: ${person.type}\nDays since last contact: ${daysSince(person.lastContacted)}\nGoals with them: ${(person.goals || []).map((g) => g.text).join("; ") || "none noted"}\nNotes: ${person.notes || "none"}`,
          }],
        }),
      });
      const data = await response.json();
      const raw = (data.content || []).map((b) => b.text || "").join("");
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setPeople((prev) => prev.map((p) => p.id !== personId ? p : { ...p, talkingPoints: parsed.points || [], activity: [{ id: Date.now(), date: today, type: "Conversation", text: "Refreshed conversation talking points" }, ...(p.activity || [])] }));
    } catch (err) {
      setPeople((prev) => prev.map((p) => p.id !== personId ? p : { ...p, talkingPoints: ["Couldn't reach the assistant just now — try again in a moment."] }));
    }
    setTalkingPointsLoading((prev) => ({ ...prev, [personId]: false }));
  }

  // ---------- generic AI voice-note update pipeline ----------
  const [voiceLog, setVoiceLog] = useState([]);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [showGlobalVoiceLog, setShowGlobalVoiceLog] = useState(false);
  const [voiceConfirmation, setVoiceConfirmation] = useState(null);

  function applyAIActions(actions) {
    let next = { todos, projects, debts, income, workouts, liftLog, weight, sleep, conditionLog };
    (actions || []).forEach((action, index) => {
      next = applyVoiceActionToState(next, action, today, `voice-${Date.now()}-${index}`);
    });
    setTodos(next.todos);
    setProjects(next.projects);
    setDebts(next.debts);
    setIncome(next.income);
    setWorkouts(next.workouts);
    setLiftLog(next.liftLog || liftLog);
    setWeight(next.weight);
    setSleep(next.sleep);
    setConditionLog(next.conditionLog);
  }


  function navigateToVoiceTarget(targetTab, targetSubpage) {
    if (!targetTab) return;
    setTab(targetTab);
    if (targetTab === "home" && targetSubpage) setHomeSub(targetSubpage);
    if (targetTab === "health" && targetSubpage) setHealthSub(targetSubpage);
    if (targetTab === "finance" && targetSubpage) setFinanceSub(targetSubpage);
    if (targetTab === "school" && targetSubpage) setSchoolSub(targetSubpage);
    if (targetTab === "relationships" && targetSubpage) setRelationshipsSub(targetSubpage);
    if (targetTab === "work" && targetSubpage) {
      const project = projects.find((item) => item.name.toLowerCase() === targetSubpage.toLowerCase());
      if (project) setActiveProject(project.id);
    }
  }

  async function processVoiceNote(transcript) {
    const trimmed = transcript.trim();
    if (!trimmed || voiceUpdateMutation.isPending) return false;
    setVoiceLoading(true);
    const context = JSON.stringify({
      page: { tab, subpage: tab === "home" ? homeSub : tab === "health" ? healthSub : tab === "finance" ? financeSub : tab === "school" ? schoolSub : tab === "relationships" ? relationshipsSub : tab === "work" ? currentProject?.name : null, date: today },
      instructions: "Use the current page and subpage as the primary context. Decide whether this note should create or complete a task, update a tracker, add a finance transaction, update a workout/health log, or add a note. Only return actions supported by the existing dashboard data.",
      projects: projects.map((p) => ({ id: p.id, name: p.name, tasks: p.tasks.map((t) => ({ id: t.id, name: t.name, status: t.status })) })),
      todos: todos.filter((t) => !t.done).map((t) => ({ id: t.id, text: t.text, due: t.due, domain: t.domain })),
      debts: debts.map((d) => ({ id: d.id, name: d.name, balance: d.debt - d.paid })),
      income: income.map((r) => ({ id: r.id, source: r.source, remaining: r.toReceive - r.paid })),
      fitnessPlan, currentFitnessDay, workouts, liftLog, weight, sleep, diseases, conditionLog, nutritionPlan,
    });
    try {
      const result = await voiceUpdateMutation.mutateAsync({ transcript: trimmed, context });
      if (result.needsConfirmation && result.actions?.length) {
        setVoiceConfirmation({ summary: result.summary, actions: result.actions, targetTab: result.targetTab, targetSubpage: result.targetSubpage, reason: result.confirmationReason, transcript: trimmed });
        return true;
      }
      applyAIActions(result.actions);
      setVoiceLog((prev) => [{ id: Date.now(), text: result.summary || "Updated.", count: (result.actions || []).length, time: "Just now" }, ...prev]);
      return true;
    } catch {
      setVoiceLog((prev) => [{ id: Date.now(), text: "Couldn't process that note — try again.", count: 0, time: "Just now", failed: true }, ...prev]);
      return false;
    } finally {
      setVoiceLoading(false);
    }
  }

  // ---------- daily rewind ----------
  const [showRewind, setShowRewind] = useState(false);
  const userTimezone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  useEffect(() => {
    if (rewindStatusQuery.data?.pending) setShowRewind(true);
  }, [rewindStatusQuery.data?.pending]);
  async function submitRewind(transcript) {
    const processed = await processVoiceNote(transcript);
    if (!processed) return;
    rewindCompleteMutation.mutate();
    setShowRewind(false);
  }

  // Home scores
  const financeScore = Math.max(0, Math.min(100, 100 - (totalOutstandingDebt / (totalExpectedIncome || 1)) * 40));
  const fitnessScore = Math.max(0, Math.min(100, goalProgress * 0.5 + 70 * 0.5));
  const workScore = 62;
  const schoolScore = 71;
  const relationshipScore = Math.max(0, Math.min(100, 100 - people.filter((p) => daysSince(p.lastContacted) > p.threshold).length * 20));
  const overall = Math.round((financeScore + fitnessScore + workScore + schoolScore + relationshipScore) / 5);

  const trendData = [
    { day: "W1", score: 58 }, { day: "W2", score: 61 }, { day: "W3", score: 64 },
    { day: "W4", score: 63 }, { day: "W5", score: 68 }, { day: "W6", score: overall },
  ];

  const weekEvents = [
    { title: "Job Payment due", date: "Aug 6", domain: "finance", sub: "Income" },
    { title: "Client billing module", date: "Aug 20", domain: "work", sub: "Agency OS" },
    { title: "Lab Report graded", date: "Aug 20", domain: "school", sub: "Assignments" },
    { title: "Nicole check-in overdue", date: "Aug 28", domain: "relationships", sub: "People" },
    { title: "Problem Set 4 due", date: "Aug 30", domain: "school", sub: "Assignments" },
  ];

  const nudges = [
    { text: `${debtRows.filter(d => d.status === "Active" && d.balance > 1000000).length} debts have a balance over 1,000,000`, icon: AlertTriangle, target: "finance", sub: "debts" },
    { text: `${people.filter(p => daysSince(p.lastContacted) > p.threshold).length} people are overdue for a check-in`, icon: Users, target: "relationships", sub: "Friends" },
    { text: `${assignments.filter(a => a.status === "Not Started").length} assignment not started this week`, icon: GraduationCap, target: "school", sub: schoolSub },
  ];

  const navItems = [
    { key: "home", icon: Home },
    { key: "health", icon: HeartPulse },
    { key: "finance", icon: Wallet },
    { key: "work", icon: Briefcase },
    { key: "school", icon: GraduationCap },
    { key: "relationships", icon: Users },
    { key: "calendar", icon: Calendar },
  ];

  useEffect(() => {
    if (!isAuthenticated || snapshotQuery.isLoading || snapshotReady) return;
    const saved = snapshotQuery.data;
    if (saved) {
      const loadedProjects = [...(saved.projects || projects)];
      if (!loadedProjects.some((project) => project?.name === "Rug Mosaic")) {
        const numericIds = loadedProjects.map((project) => Number(project?.id)).filter(Number.isFinite);
        loadedProjects.push({ id: numericIds.length ? Math.max(...numericIds) + 1 : `project-${Date.now()}`, name: "Rug Mosaic", tasks: [] });
      }
      const linkedTodos = (saved.todos || []).map((todo) => {
        if (todo.projectId !== undefined || todo.domain !== "work") return todo;
        const project = loadedProjects.find((candidate) => typeof candidate.name === "string" && typeof todo.text === "string" && todo.text.includes(candidate.name));
        return project ? { ...todo, projectId: project.id } : todo;
      });
      const coveredTodos = [...linkedTodos];
      loadedProjects.forEach((project) => {
        if (!project?.id || !project?.name || coveredTodos.some((todo) => todo.domain === "work" && todo.projectId === project.id)) return;
        coveredTodos.push({ id: `project-${project.id}-starter`, text: `Define the next ${project.name} deliverable`, due: today, time: "", domain: "work", done: false, projectId: project.id });
      });
      setTodos(coveredTodos);
      if (saved.income) setIncome(saved.income);
      if (saved.debts) setDebts(saved.debts);
      if (saved.weight) setWeight(saved.weight);
      if (saved.workouts) setWorkouts(saved.workouts);
      if (saved.fitnessPlan) setFitnessPlan(saved.fitnessPlan);
      if (Number.isFinite(saved.fitnessDayIndex)) setFitnessDayIndex(saved.fitnessDayIndex);
      if (saved.liftLog) setLiftLog(saved.liftLog);
      if (saved.sleep) setSleep(saved.sleep);
      if (saved.conditionLog) setConditionLog(saved.conditionLog);
      if (saved.diseases) setDiseases(saved.diseases);
      if (saved.diseaseArchive) setDiseaseArchive(saved.diseaseArchive);
      if (saved.healthSchedules) setHealthSchedules(saved.healthSchedules);
      setProjects(loadedProjects);
      if (saved.assignments) setAssignments(saved.assignments);
      if (saved.readings) setReadings(saved.readings);
      if (saved.classes) setClasses(saved.classes);
      if (saved.syllabusEvents) setSyllabusEvents(saved.syllabusEvents);
      if (saved.applications) setApplications(saved.applications);
      if (saved.recommenders) setRecommenders(saved.recommenders);
      if (saved.people) setPeople(saved.people);
      if (saved.voiceLog) setVoiceLog(saved.voiceLog);
      if (saved.todayPlan) setTodayPlan(saved.todayPlan);
    }
    setSnapshotReady(true);
  }, [isAuthenticated, snapshotQuery.isLoading, snapshotQuery.data, snapshotReady]);

  useEffect(() => {
    if (!isAuthenticated || !snapshotReady) return;
    const payload = { todos, income, debts, weight, workouts, fitnessPlan, fitnessDayIndex, liftLog, sleep, conditionLog, diseases, diseaseArchive, healthSchedules, projects, assignments, readings, classes, syllabusEvents, applications, recommenders, people, voiceLog, todayPlan };
    const timer = window.setTimeout(() => saveSnapshot.mutate(payload), 500);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, snapshotReady, todos, income, debts, weight, workouts, fitnessPlan, fitnessDayIndex, liftLog, sleep, conditionLog, diseases, diseaseArchive, healthSchedules, projects, assignments, readings, classes, syllabusEvents, applications, recommenders, people, voiceLog, todayPlan]);

  if (authLoading || (isAuthenticated && snapshotQuery.isLoading)) {
    return <div className="min-h-screen bg-neutral-100 flex items-center justify-center text-sm text-neutral-500">Loading your workspace…</div>;
  }
  if (!isAuthenticated && !previewMode) return null;
  if (snapshotQuery.error) {
    return <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-6 text-sm text-rose-600">We couldn’t load your workspace right now. Please refresh and try again.</div>;
  }

  return (
    <div className="dashboard-shell flex min-h-screen font-sans">
      {showGlobalVoiceLog && (
        <div className="fixed inset-0 z-40 pointer-events-none" role="presentation">
          <div className="pointer-events-auto absolute right-4 top-20 w-[min(28rem,calc(100vw-2rem))] rounded-[1.35rem] bg-white/95 p-5 shadow-[0_20px_60px_rgba(53,64,37,0.18)] ring-1 ring-neutral-950/10 backdrop-blur-xl" role="dialog" aria-modal="false" aria-labelledby="global-voice-log-title">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-lime-700">Voice log</p>
                <h2 id="global-voice-log-title" className="text-xl font-semibold tracking-tight text-neutral-950">Tell your dashboard what changed.</h2>
                <p className="text-sm text-neutral-500 mt-1">I’ll analyse this note in the context of {tab === "home" ? homeSub : domainMeta[tab]?.label || tab}{tab === "home" ? "" : ` · ${tab === "health" ? healthSub : tab === "finance" ? financeSub : tab === "school" ? schoolSub : tab === "relationships" ? relationshipsSub : tab === "work" ? currentProject?.name || "Projects" : "Today"}`}, then update the relevant records.</p>
              </div>
              <button type="button" aria-label="Close voice log" onClick={() => setShowGlobalVoiceLog(false)} className="dashboard-action w-9 h-9 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="mt-5 rounded-[1.2rem] border border-neutral-100 bg-neutral-50/70 p-4">
              <VoiceNoteBox onSubmit={async (value) => { const processed = await processVoiceNote(value); if (processed) setShowGlobalVoiceLog(false); }} loading={voiceLoading} placeholder="Say what happened, what needs doing, or what should be updated…" />
            </div>
            <p className="mt-3 text-xs text-neutral-400">Examples: “Mark my gym session complete”, “Add a task to submit my Masters transcript”, or “I paid Nicole RWF 50,000.”</p>
          </div>
        </div>
      )}
      {voiceConfirmation && (
        <div className="fixed right-4 top-20 z-50 w-[min(28rem,calc(100vw-2rem))] rounded-[1.35rem] bg-neutral-950 p-5 text-white shadow-[0_20px_60px_rgba(21,23,19,0.24)]" role="alertdialog" aria-modal="false" aria-labelledby="voice-confirm-title">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-lime-300">Check the destination</p>
          <h2 id="voice-confirm-title" className="mt-1 text-base font-semibold">This sounds like a {voiceConfirmation.targetSubpage || voiceConfirmation.targetTab || "different area"} update.</h2>
          <p className="mt-2 text-sm leading-5 text-white/70">{voiceConfirmation.reason || "The note appears to belong to a different page than the one you were viewing."} Apply it there instead?</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setVoiceConfirmation(null)} className="dashboard-action rounded-full px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/10">Keep here</button>
            <button type="button" onClick={() => { navigateToVoiceTarget(voiceConfirmation.targetTab, voiceConfirmation.targetSubpage); applyAIActions(voiceConfirmation.actions); setVoiceLog((prev) => [{ id: Date.now(), text: voiceConfirmation.summary || "Updated.", count: voiceConfirmation.actions.length, time: "Just now" }, ...prev]); setVoiceConfirmation(null); setShowGlobalVoiceLog(false); }} className="dashboard-action rounded-full bg-lime-300 px-3 py-2 text-xs font-semibold text-neutral-950">Apply update</button>
          </div>
        </div>
      )}
      {showRewind && (
        <div className="fixed inset-0 z-50 bg-neutral-950/35 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="daily-rewind-title">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-neutral-200 p-6">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-neutral-400">10:00 PM check-in</p>
                <h2 id="daily-rewind-title" className="text-xl font-semibold text-neutral-900 mt-1">Daily Rewind</h2>
              </div>
              <button onClick={() => { rewindDismissMutation.mutate(); setShowRewind(false); }} className="text-sm text-neutral-500 hover:text-neutral-900">Not now</button>
            </div>
            <p className="text-sm text-neutral-600 mb-4">Tell your dashboard what happened today. The coach will turn clear updates into tasks, logs, payments, and notes.</p>
            <VoiceNoteBox onSubmit={submitRewind} loading={voiceLoading || rewindCompleteMutation.isPending} placeholder="What did you do today, and what changed?" />
          </div>
        </div>
      )}
      {saveSnapshot.isError && <div className="fixed top-3 right-3 z-50 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow-sm">Your latest change could not be saved. Please retry.</div>}
      {/* sidebar — desktop only */}
      <nav aria-label="Primary" className="dashboard-sidebar hidden md:flex fixed inset-y-0 left-0 z-20 w-20 flex-col items-center py-6 gap-2 overflow-hidden">
        <div className="w-9 h-9 rounded-xl bg-lime-400 flex items-center justify-center mb-6">
          <Gauge size={18} className="text-neutral-950" />
        </div>
        {navItems.map(({ key, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition ${
              tab === key ? "bg-lime-400 text-neutral-950" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <Icon size={19} />
          </button>
        ))}
      </nav>

      {/* dock — mobile only */}
      <MobileDock items={navItems} active={tab} onChange={setTab} />

      {/* main */}
      <main id="main-content" className="dashboard-main flex-1 md:ml-20 p-4 md:p-6 overflow-y-auto pb-28 md:pb-6 min-w-0">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-neutral-900">
              {tab === "home" ? "Good morning" : domainMeta[tab]?.label}
            </h1>
            <p className="text-sm text-neutral-500">
              {tab === "home" ? "Here's where things stand across your week." : formattedToday}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {tab !== "home" && <IdeaButton loading={ideasMutation.isPending && ideaResult?.section === (domainMeta[tab]?.label || tab)} onClick={() => askIdeas(domainMeta[tab]?.label || tab, JSON.stringify({ tab, todos, income: incomeRows, debts: debtRows, applications, assignments, people }))} />}
            <button type="button" aria-label="Open voice log" onClick={() => setShowGlobalVoiceLog(true)} className={`dashboard-action relative w-9 h-9 rounded-full flex items-center justify-center ${voiceLoading ? "bg-lime-400 text-neutral-950" : "bg-white text-neutral-500"}`}>
              {voiceLoading ? <span className="absolute inset-0 rounded-full border-2 border-neutral-950/20 border-t-neutral-950 animate-spin" /> : null}
              <Mic size={16} className="relative" />
            </button>
            <div className="relative">
              <button onClick={() => setShowNotifications((v) => !v)} aria-label="Notifications" className="w-9 h-9 rounded-full bg-white flex items-center justify-center">
                <Bell size={16} className="text-neutral-400" />
              </button>
              {(nudges.length > 0) && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-lime-400 text-[10px] text-neutral-950 flex items-center justify-center">{nudges.length}</span>}
              {showNotifications && <div className="absolute right-0 top-11 z-30 w-72 rounded-2xl bg-white p-4 shadow-xl border border-neutral-100">
                <div className="flex items-center justify-between mb-3"><p className="text-sm font-semibold text-neutral-900">Notifications</p><button onClick={() => setShowNotifications(false)} className="text-xs text-neutral-400">Close</button></div>
                <div className="flex flex-col gap-2">{nudges.length === 0 && upcomingTodos.length === 0 && <div className="rounded-xl bg-neutral-50 px-3 py-3 text-xs text-neutral-500">You’re all caught up. No new notifications.</div>}{nudges.map((n, i) => <button type="button" key={i} onClick={() => openNotification(n.target, n.sub)} className="text-left rounded-xl bg-lime-50 px-3 py-2 text-xs text-lime-900 transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.99]">{n.text}<span className="block text-[10px] text-lime-700 mt-0.5">Open {domainMeta[n.target]?.label || n.target}</span></button>)}{upcomingTodos.slice(0, 3).map((t) => <button type="button" key={t.id} onClick={() => { const destination = notificationTargetForTodo(t); openNotification(destination.target, destination.sub); }} className="text-left rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-700 transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.99]">Upcoming: {t.text} · {t.due}<span className="block text-[10px] text-neutral-400 mt-0.5">Open related section</span></button>)}</div>
              </div>}
            </div>
          </div>
        </div>

        {tab === "home" && (
          <div className="flex flex-col gap-5">
            <SubTabs
              tabs={[{ key: "dashboard", label: "Dashboard" }, { key: "today", label: "Today" }, { key: "todo", label: "Todo" }, { key: "upcoming", label: "Upcoming" }]}
              active={homeSub}
              onChange={setHomeSub}
            />

            {homeSub === "today" && (
              <div className="flex flex-col gap-5">
                <div className="bg-neutral-950 rounded-2xl p-6 text-white flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                  <div>
                    <p className="text-sm text-neutral-400 mb-1">Your focus for today</p>
                    <h2 className="text-2xl font-semibold tracking-tight">One clear step in every part of life.</h2>
                    <p className="text-sm text-neutral-400 mt-2">{todayCategories.reduce((sum, category) => sum + (todayCardItems[category.key] || []).filter((item) => item.done).length, 0)} completed items across {todayCategories.length} areas</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <ScoreRing label="Today" score={todayOverall} colorKey="lime" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {todayCategories.map((category) => {
                    const Icon = category.icon;
                    const c = colorMap[category.color];
                    const items = todayCardItems[category.key] || [];
                    const completed = items.filter((item) => item.done).length;
                    const progress = Math.round((completed / Math.max(items.length, 1)) * 100);
                    return (
                      <div key={category.key} className="bg-white rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-xl ${c.badgeBg} flex items-center justify-center shrink-0`}><Icon size={18} className={c.badgeText} /></div>
                            <div className="min-w-0"><h3 className="font-semibold text-neutral-900">{category.label}</h3><p className="text-xs text-neutral-400">{completed}/{items.length} complete</p></div>
                          </div>
                          <div className="relative w-12 h-12 shrink-0">
                            <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90"><circle cx="24" cy="24" r="19" fill="none" stroke="#F1F1EF" strokeWidth="5" /><circle cx="24" cy="24" r="19" fill="none" stroke={c.ring} strokeWidth="5" strokeLinecap="round" strokeDasharray={2 * Math.PI * 19} strokeDashoffset={2 * Math.PI * 19 - (progress / 100) * 2 * Math.PI * 19} /></svg>
                            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-neutral-700">{progress}%</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {items.map((item) => (
                            <div key={item.id} className="flex items-start gap-2.5 rounded-xl bg-neutral-50 px-3 py-2.5">
                              <button type="button" onClick={() => toggleTodayItem(category.key, item)} disabled={item.source === "workout"} aria-label={`${item.done ? "Completed" : "Complete"}: ${item.text}`} className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${item.done ? "bg-lime-400" : "border border-neutral-300 bg-white"} disabled:cursor-default`}>
                                {item.done && <Check size={12} className="text-neutral-950" />}
                              </button>
                              <p className={`text-sm leading-5 ${item.done ? "text-neutral-400 line-through" : "text-neutral-700"}`}>{item.text}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <input value={todayDraft[category.key] || ""} onChange={(e) => setTodayDraft((prev) => ({ ...prev, [category.key]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") addTodayPlanItem(category.key); }} placeholder={`Add ${category.label.toLowerCase()} item…`} className="min-w-0 flex-1 text-xs border border-neutral-200 rounded-lg px-3 py-2" />
                          <button type="button" onClick={() => addTodayPlanItem(category.key)} className="px-3 py-2 bg-neutral-950 text-white text-xs font-medium rounded-lg flex items-center gap-1"><Plus size={13} /> Add</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {homeSub === "dashboard" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="md:col-span-2 flex flex-col gap-5">
                  <div className="bg-neutral-950 rounded-2xl p-6 text-white">
                    <div className="flex items-end justify-between mb-4">
                      <div>
                        <p className="text-sm text-neutral-400 mb-1">Overall life score</p>
                        <p className="text-4xl font-semibold text-lime-400">{overall}%</p>
                      </div>
                      <div className="flex items-center gap-1 text-emerald-400 text-sm">
                        <TrendingUp size={14} /> +5 this week
                      </div>
                    </div>
                    <div style={{ height: 90 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                          <defs>
                            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#A3E635" stopOpacity={0.5} />
                              <stop offset="100%" stopColor="#A3E635" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="score" stroke="#A3E635" strokeWidth={2} fill="url(#g)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <SectionCard title="Domain scores">
                    <div className="flex justify-between px-2">
                      <ScoreRing label="Finance" score={financeScore} colorKey="blue" />
                      <ScoreRing label="Fitness" score={fitnessScore} colorKey="emerald" />
                      <ScoreRing label="Work" score={workScore} colorKey="amber" />
                      <ScoreRing label="School" score={schoolScore} colorKey="violet" />
                      <ScoreRing label="Relationships" score={relationshipScore} colorKey="rose" />
                    </div>
                  </SectionCard>
                </div>

                <div className="flex flex-col gap-5">
                  <SectionCard title="Coach">
                    <div className="flex flex-col gap-3">
                      {nudges.map((n, i) => (
                        <div key={i} className="flex items-start gap-3 bg-lime-50 rounded-xl p-3">
                          <n.icon size={16} className="text-lime-700 mt-0.5" />
                          <p className="text-sm text-lime-900">{n.text}</p>
                        </div>
                      ))}
                      <button onClick={askPerformanceAdvice} disabled={performanceAdviceMutation.isPending} className="px-3 py-2 bg-neutral-950 text-white text-xs font-medium rounded-lg">{performanceAdviceMutation.isPending ? "Reviewing…" : "Get advice on my performance"}</button>
                      {performanceAdvice && <div className="bg-neutral-50 rounded-xl p-3 text-sm text-neutral-700 whitespace-pre-wrap">{performanceAdvice}</div>}
                      <div className="flex justify-end"><IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Overall performance"} onClick={() => askIdeas("Overall performance", JSON.stringify({ overall, financeScore, fitnessScore, workScore, schoolScore, relationshipScore, unfinishedTodos: todos.filter((t) => !t.done) }))} /></div>
                      {ideaResult && <div className="bg-lime-50 rounded-xl p-3 text-xs text-lime-900 whitespace-pre-wrap"><p className="font-medium mb-1">{ideaResult.section}</p>{ideaResult.text || "Generating ideas…"}</div>}
                      <div className="pt-2 border-t border-neutral-100">
                        <p className="text-xs font-medium text-neutral-500 mb-2">Ask your AI life coach</p>
                        <div className="flex gap-2"><input id="life-coach-input" value={coachInput} onChange={(e) => setCoachInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { askLifeCoach(coachInput); setCoachInput(""); } }} placeholder="What should I focus on today?" className="flex-1 text-xs border border-neutral-200 rounded-lg px-3 py-2" /><button onClick={() => { askLifeCoach(coachInput); setCoachInput(""); }} disabled={coachMutation.isPending || !coachInput.trim()} className="px-3 py-2 bg-lime-400 text-neutral-950 text-xs font-medium rounded-lg">{coachMutation.isPending ? "…" : "Ask"}</button></div>
                        {coachMessages.slice(-2).map((m, i) => <div key={i} className={`mt-2 rounded-xl px-3 py-2 text-xs ${m.role === "user" ? "bg-neutral-950 text-white" : "bg-lime-50 text-lime-900"}`}>{m.text}</div>)}
                      </div>
                      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-neutral-700">Daily Rewind</p>
                          <p className="text-[11px] text-neutral-400">Optional 10 PM local voice check-in</p>
                        </div>
                        <button type="button" onClick={() => rewindEnabledMutation.mutate({ enabled: !rewindStatusQuery.data?.enabled, timezone: userTimezone })} disabled={rewindEnabledMutation.isPending || rewindStatusQuery.isLoading} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${rewindStatusQuery.data?.enabled ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-700"}`}>
                          {rewindEnabledMutation.isPending ? "Saving…" : rewindStatusQuery.data?.enabled ? "On" : "Enable"}
                        </button>
                      </div>
                    </div>
                  </SectionCard>
                  <SectionCard title="Net position">
                    <p className="text-2xl font-semibold text-neutral-900">{fmt(netPosition)}</p>
                    <p className="text-xs text-neutral-500 mt-1">Expected income minus outstanding debt</p>
                  </SectionCard>
                  <SectionCard title="Weight goal">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-neutral-600">{currentWeight}kg → {targetWeight}kg</span>
                      <span className="text-sm font-medium text-emerald-600">{Math.round(goalProgress)}%</span>
                    </div>
                    <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${goalProgress}%` }} />
                    </div>
                  </SectionCard>
                </div>
              </div>
            )}

            {homeSub === "todo" && (
              <SectionCard title={`Today — ${formattedToday}`}>
                <div className="flex flex-col">
                  {todayTodos.length === 0 && <p className="text-sm text-neutral-400 py-4">Nothing on today's list yet.</p>}
                  {todayTodos.map((t) => (
                    <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-0">
                      <button onClick={() => toggleTodo(t.id)} className="flex items-center gap-3 text-left">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${t.done ? "bg-lime-400" : "border border-neutral-300"}`}>
                          {t.done && <Check size={12} className="text-neutral-950" />}
                        </span>
                        <div>
                          <p className={`text-sm ${t.done ? "text-neutral-400 line-through" : "text-neutral-800"}`}>{t.text}</p>
                          {t.time && <p className="text-xs text-neutral-400">{t.time}</p>}
                        </div>
                      </button>
                      <button onClick={() => deleteTodo(t.id)} className="text-neutral-300 hover:text-rose-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <input placeholder="e.g. Eat chocolate" value={newTodayItem.text} onChange={(e) => setNewTodayItem({ ...newTodayItem, text: e.target.value })} className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                  <input type="time" value={newTodayItem.time} onChange={(e) => setNewTodayItem({ ...newTodayItem, time: e.target.value })} className="text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                  <button onClick={addTodayItem} className="px-4 py-2 bg-lime-400 text-neutral-950 text-sm font-medium rounded-lg flex items-center justify-center gap-1">
                    <Plus size={14} /> Add
                  </button>
                </div>
              </SectionCard>
            )}

            {homeSub === "upcoming" && (
              <SectionCard title="Next few days">
                <div className="flex flex-col">
                  {weekEvents.map((e, i) => {
                    const c = colorMap[domainMeta[e.domain].color];
                    return (
                      <div key={`e${i}`} className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                          <div>
                            <p className="text-sm text-neutral-800">{e.title}</p>
                            <p className={`text-xs ${c.badgeText}`}>{domainMeta[e.domain].label} · {e.sub}</p>
                          </div>
                        </div>
                        <span className="text-xs text-neutral-400">{e.date}</span>
                      </div>
                    );
                  })}
                  {upcomingTodos.map((t) => (
                    <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-0">
                      <button onClick={() => toggleTodo(t.id)} className="flex items-center gap-3 text-left">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${t.done ? "bg-lime-400" : "border border-neutral-300"}`}>
                          {t.done && <Check size={12} className="text-neutral-950" />}
                        </span>
                        <div>
                          <p className={`text-sm ${t.done ? "text-neutral-400 line-through" : "text-neutral-800"}`}>{t.text}</p>
                          <p className="text-xs text-neutral-400">{t.due}{t.time ? ` · ${t.time}` : ""}</p>
                        </div>
                      </button>
                      <button onClick={() => deleteTodo(t.id)} className="text-neutral-300 hover:text-rose-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <input placeholder="Add an upcoming task or event…" value={newUpcomingItem.text} onChange={(e) => setNewUpcomingItem({ ...newUpcomingItem, text: e.target.value })} className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                  <input type="date" value={newUpcomingItem.due} onChange={(e) => setNewUpcomingItem({ ...newUpcomingItem, due: e.target.value })} className="text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                  <input type="time" value={newUpcomingItem.time} onChange={(e) => setNewUpcomingItem({ ...newUpcomingItem, time: e.target.value })} className="text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                  <button onClick={addUpcomingItem} className="px-4 py-2 bg-lime-400 text-neutral-950 text-sm font-medium rounded-lg flex items-center justify-center gap-1">
                    <Plus size={14} /> Add
                  </button>
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {tab === "finance" && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
              <StatCard icon={Wallet} iconColor="blue" label="Total expected income" value={fmt(totalExpectedIncome)} delta="+1.3% vs last month" positive />
              <StatCard icon={AlertTriangle} iconColor="rose" label="Total outstanding debt" value={fmt(totalOutstandingDebt)} delta="-2.1% vs last month" />
              <StatCard icon={TrendingUp} iconColor="emerald" label="Net position" value={fmt(netPosition)} />
            </div>

            <SubTabs
              tabs={[{ key: "insights", label: "Insights" }, { key: "income", label: "Income" }, { key: "debts", label: "Debts" }]}
              active={financeSub}
              onChange={setFinanceSub}
            />

            {financeSub === "insights" && (
              <div className="flex flex-col gap-5">
                <SectionCard title="Finance insights" right={<IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Finance insights"} onClick={() => askIdeas("Finance insights", JSON.stringify({ insights: financeInsights, income: incomeRows, debts: debtRows }))} />}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-blue-50 p-4"><p className="text-xs text-blue-600">Collection rate</p><p className="text-2xl font-semibold text-neutral-900 mt-1">{financeInsights.collectionRate}%</p><p className="text-xs text-neutral-500 mt-1">{fmt(financeInsights.received)} received of {fmt(financeInsights.expected)}</p></div>
                    <div className="rounded-xl bg-rose-50 p-4"><p className="text-xs text-rose-600">Debt coverage</p><p className="text-2xl font-semibold text-neutral-900 mt-1">{financeInsights.coverage}%</p><p className="text-xs text-neutral-500 mt-1">Received income compared with active debt</p></div>
                    <div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs text-emerald-600">Outstanding debt</p><p className="text-2xl font-semibold text-neutral-900 mt-1">{fmt(financeInsights.outstandingDebt)}</p><p className="text-xs text-neutral-500 mt-1">Across active balances</p></div>
                  </div>
                </SectionCard>
                <SectionCard title="Recommended next actions">
                  <div className="flex flex-col gap-3">{financeInsights.actions.map((action) => <div key={action} className="flex items-start gap-3 text-sm text-neutral-700"><span className="mt-1 h-2 w-2 rounded-full bg-lime-400 shrink-0" />{action}</div>)}</div>
                </SectionCard>
                <SectionCard title="Voice update inbox" right={<IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Voice update inbox"} onClick={() => askIdeas("Voice update inbox", JSON.stringify({ voiceLog }))} />}>
                  <VoiceNoteBox onSubmit={processVoiceNote} loading={voiceLoading} placeholder="Say what changed in your money, work, health, or plans…" />
                  <p className="text-xs text-neutral-400 mt-3">The assistant will suggest safe updates first, then apply them to the relevant tracker fields.</p>
                </SectionCard>
              </div>
            )}

            {financeSub === "income" && (
            <SectionCard title="Income tracker" right={<div className="flex items-center gap-2"><IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Income"} onClick={() => askIdeas("Income", JSON.stringify({ income: incomeRows }))} /><ViewTabs views={["Expected", "Received", "All Incoming", "By Date"]} active={incomeView} onChange={setIncomeView} /></div>}>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-neutral-400 text-xs">
                    <th className="pb-2 font-medium">Income source</th>
                    <th className="pb-2 font-medium">To receive</th>
                    <th className="pb-2 font-medium">Paid</th>
                    <th className="pb-2 font-medium">Remaining</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">From</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIncome.map((r) => (
                    <tr key={r.id} className="border-t border-neutral-100">
                      <td className="py-3 text-neutral-800"><div>{r.source}</div><div className="flex gap-1 mt-1"><button onClick={() => receiveIncome(r.id)} className="text-[11px] text-emerald-600">Receive</button><button onClick={() => addIncomeAmount(r.id)} className="text-[11px] text-blue-600">Add on</button></div></td>
                      <td className="py-3 text-neutral-600">{fmt(r.toReceive)}</td>
                      <td className="py-3 text-neutral-600">{fmt(r.paid)}</td>
                      <td className="py-3 text-neutral-600">{fmt(r.remaining)}</td>
                      <td className="py-3 text-neutral-500">{r.date}</td>
                      <td className="py-3 text-neutral-500">{r.from}</td>
                      <td className="py-3"><StatusPill status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <input placeholder="Income source" value={newIncome.source} onChange={(e) => setNewIncome({ ...newIncome, source: e.target.value })} className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                <input placeholder="Amount" value={newIncome.toReceive} onChange={(e) => setNewIncome({ ...newIncome, toReceive: e.target.value })} className="w-32 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                <input placeholder="From" value={newIncome.from} onChange={(e) => setNewIncome({ ...newIncome, from: e.target.value })} className="w-28 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                <button
                  onClick={() => {
                    if (!newIncome.source || !newIncome.toReceive) return;
                    setIncome([...income, { id: Date.now(), source: newIncome.source, toReceive: Number(newIncome.toReceive), paid: 0, date: "2026-08-28", from: newIncome.from || "Other" }]);
                    setNewIncome({ source: "", toReceive: "", from: "" });
                  }}
                  className="px-4 py-2 bg-lime-400 text-neutral-950 text-sm font-medium rounded-lg flex items-center gap-1"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </SectionCard>
            )}

            {financeSub === "debts" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2">
                <SectionCard title="Debt tracker" right={<div className="flex items-center gap-2"><IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Debt"} onClick={() => askIdeas("Debt", JSON.stringify({ debts: debtRows }))} /><ViewTabs views={["Table", "Active", "Paid"]} active={debtView} onChange={setDebtView} /></div>}>
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="text-left text-neutral-400 text-xs">
                        <th className="pb-2 font-medium">Name</th>
                        <th className="pb-2 font-medium">Debt</th>
                        <th className="pb-2 font-medium">Paid</th>
                        <th className="pb-2 font-medium">Balance</th>
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDebts.map((d) => (
                        <tr key={d.id} className="border-t border-neutral-100">
                          <td className="py-3 text-neutral-800"><div className="font-medium">{d.name}</div><div className="text-[11px] text-neutral-400 mt-1">Added {d.date}</div></td>
                          <td className="py-3 text-neutral-600">{fmt(d.debt)}</td>
                          <td className="py-3 text-neutral-600">{fmt(d.paid)}</td>
                          <td className="py-3 text-neutral-600">{fmt(d.balance)}</td>
                          <td className="py-3 text-neutral-500">{d.date}</td>
                          <td className="py-3">
                            <button type="button" onClick={() => setDebts(prev => prev.map(x => x.id !== d.id ? x : { ...x, status: x.status === "Active" ? "Paid" : "Active" }))} aria-label={`Mark ${d.name} as ${d.status === "Active" ? "paid" : "active"}`}>
                              <StatusPill status={d.status} />
                            </button>
                          </td>
                          <td className="py-3">
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => setDebtAction({ id: d.id, type: "pay", amount: "" })} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100">Pay</button>
                              <button type="button" onClick={() => setDebtAction({ id: d.id, type: "add", amount: "" })} className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100">Add on</button>
                            </div>
                            {debtAction?.id === d.id && (
                              <div className="mt-2 flex items-center justify-end gap-2">
                                <input autoFocus type="number" min="1" value={debtAction.amount} onChange={(e) => setDebtAction((prev) => ({ ...prev, amount: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") submitDebtAction(); if (e.key === "Escape") setDebtAction(null); }} placeholder={debtAction.type === "pay" ? "Payment" : "Add amount"} aria-label={`${debtAction.type === "pay" ? "Payment" : "Add-on"} amount for ${d.name}`} className="w-24 rounded-lg border border-neutral-200 px-2 py-1.5 text-xs" />
                                <button type="button" onClick={submitDebtAction} className="rounded-lg bg-neutral-950 px-2.5 py-1.5 text-[11px] font-medium text-white">Save</button>
                                <button type="button" onClick={() => setDebtAction(null)} className="rounded-lg bg-neutral-100 px-2.5 py-1.5 text-[11px] font-medium text-neutral-600">Cancel</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <input placeholder="Name" value={newDebt.name} onChange={(e) => setNewDebt({ ...newDebt, name: e.target.value })} className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                    <input placeholder="Amount" value={newDebt.debt} onChange={(e) => setNewDebt({ ...newDebt, debt: e.target.value })} className="sm:w-32 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                    <button onClick={addDebt} className="px-4 py-2 bg-lime-400 text-neutral-950 text-sm font-medium rounded-lg flex items-center justify-center gap-1"><Plus size={14} /> Add</button>
                  </div>
                </SectionCard>
              </div>
              <SectionCard title="Active balance" right={<IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Active balance"} onClick={() => askIdeas("Active balance", JSON.stringify({ debts: debtRows, income: incomeRows }))} />}>
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={debtChartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={2}>
                        {debtChartData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-center text-lg font-semibold text-neutral-900 -mt-24 mb-16">{fmt(totalOutstandingDebt)}</p>
                <div className="flex flex-col gap-1 mt-2">
                  {debtChartData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-neutral-600">
                        <span className="w-2 h-2 rounded-full" style={{ background: pieColors[i % pieColors.length] }} />
                        {d.name}
                      </span>
                      <span className="text-neutral-400">{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
            )}
          </div>
        )}

        {tab === "health" && (
          <div className="flex flex-col gap-5">
            <SubTabs
              tabs={[{ key: "fitness", label: "Fitness" }, { key: "sleep", label: "Sleep" }, { key: "disease", label: "Disease control" }]}
              active={healthSub}
              onChange={setHealthSub}
            />

            {healthSub === "fitness" && (
              <>
                <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-5">
                  <SectionCard title="Your training cycle" right={<div className="flex items-center gap-2"><IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Training plan"} onClick={() => askIdeas("Training plan", JSON.stringify({ fitnessPlan, currentFitnessDay }))} /><button type="button" onClick={coachSession.active ? stopCoach : startCoach} className={`dashboard-action rounded-full px-3 py-1.5 text-xs font-semibold ${coachSession.active ? "bg-rose-50 text-rose-700" : "bg-neutral-950 text-white"}`}>{coachSession.active ? "End coach" : "Live coach"}</button>{favoriteExercises.length > 0 && <span className="hidden lg:inline text-[11px] text-neutral-400">Learns from {favoriteExercises.slice(0, 2).join(" · ")}</span>}</div>}>
                    <div className="flex flex-wrap gap-2 mb-5">
                      {fitnessPlan.map((day, index) => <button key={day.key} type="button" onClick={() => setFitnessDayIndex(index)} className={`dashboard-action rounded-full px-3 py-2 text-xs font-semibold ${index === fitnessDayIndex % fitnessPlan.length ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>{index + 1} · {day.label}</button>)}
                    </div>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div><p className="text-2xl font-semibold tracking-tight text-neutral-950">{currentFitnessDay.label}</p><p className="mt-1 text-sm text-neutral-500">{currentFitnessDay.focus}</p></div>
                      <button type="button" onClick={() => setFitnessDayIndex((index) => (index + 1) % fitnessPlan.length)} className="dashboard-action rounded-full bg-lime-300 px-3 py-2 text-xs font-semibold text-neutral-950">Next day</button>
                    </div>
                    {coachSession.active && coachExercise && <div className="mb-5 rounded-2xl bg-neutral-950 p-4 text-white"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-lime-300">Live coach · {Math.floor(coachSeconds / 60)}:{String(coachSeconds % 60).padStart(2, "0")}</p><p className="mt-2 text-lg font-semibold">{coachExercise.name}</p><p className="mt-1 text-xs text-white/60">Set {coachSession.setIndex} of {coachExercise.sets} · Target {coachExercise.reps} · {coachExercise.rest} rest</p><p className="mt-2 max-w-[34rem] text-xs leading-5 text-white/70">Recommended now: <strong className="font-semibold text-white">{currentCoachRecommendation?.load} kg × {currentCoachRecommendation?.reps} reps</strong>. {currentCoachRecommendation?.rationale} {priorityMuscle ? `Current focus: ${priorityMuscle}.` : ""}</p><div className="mt-3 flex flex-wrap gap-1.5">{coachMuscleCoverage.map((muscle) => <span key={muscle} className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-white/75">{muscle}</span>)}{coachRestSeconds > 0 && <span className="rounded-full bg-lime-300/15 px-2 py-1 text-[11px] text-lime-200">Rest {Math.floor(coachRestSeconds / 60)}:{String(coachRestSeconds % 60).padStart(2, "0")}</span>}</div></div><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/75">{coachCompleted}%</span></div><div className="mt-4 grid grid-cols-2 gap-2"><select value={coachSession.load} onChange={(e) => setCoachSession({ ...coachSession, load: e.target.value })} className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none"><option value="" className="text-neutral-900">Load (kg)</option>{[2.5, 5, 7.5, 10, 12.5, 15, 20, 25, 30, 40, 50, 60, 70, 80, 100, Number(currentCoachRecommendation?.load)].filter((load, index, list) => Number.isFinite(load) && list.indexOf(load) === index).sort((a, b) => a - b).map((load) => <option key={load} value={load} className="text-neutral-900">{load} kg</option>)}</select><select value={coachSession.reps} onChange={(e) => setCoachSession({ ...coachSession, reps: e.target.value })} className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none"><option value="" className="text-neutral-900">Reps completed</option>{Array.from({ length: 20 }, (_, index) => index + 1).map((reps) => <option key={reps} value={reps} className="text-neutral-900">{reps} reps</option>)}</select></div><button type="button" onClick={finishCoachSet} disabled={!coachSession.load || !coachSession.reps} className="mt-3 w-full rounded-xl bg-lime-300 px-3 py-2 text-sm font-semibold text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40">Save set & continue</button></div>}
                    {currentFitnessDay.exercises.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="text-left text-xs text-neutral-400"><th className="pb-2 font-medium">Exercise</th><th className="pb-2 font-medium">Sets</th><th className="pb-2 font-medium">Reps</th><th className="pb-2 font-medium">Rest</th><th className="pb-2 font-medium">Done</th></tr></thead><tbody>{currentFitnessDay.exercises.map((exercise) => { const item = { id: `plan-${currentFitnessDay.key}-${exercise.name}`, text: `${exercise.name} · ${exercise.sets} sets · ${exercise.reps}`, done: Boolean(todayPlan.gym?.some((entry) => entry.id === `plan-${currentFitnessDay.key}-${exercise.name}` && entry.done)), source: "plan" }; return <tr key={exercise.name} className="border-t border-neutral-100"><td className="py-3 font-medium text-neutral-800">{exercise.name}</td><td className="py-3 text-neutral-500">{exercise.sets}</td><td className="py-3 text-neutral-500">{exercise.reps}</td><td className="py-3 text-neutral-500">{exercise.rest}</td><td className="py-3"><button type="button" onClick={() => toggleTodayItem("gym", item)} aria-label={`${item.done ? "Unmark" : "Mark"} ${exercise.name}`} className={`h-7 w-7 rounded-full flex items-center justify-center ${item.done ? "bg-lime-300 text-neutral-950" : "bg-neutral-100 text-neutral-400"}`}>{item.done ? <Check size={14} /> : <Plus size={14} />}</button></td></tr>; })}</tbody></table></div> : <p className="rounded-2xl bg-lime-50 p-4 text-sm text-lime-900">Active recovery only: walk, stretch, or do light mobility. No lifting today.</p>}
                    {currentFitnessDay.key !== "rest" && <div className="mt-4 grid grid-cols-2 md:grid-cols-[1.4fr_0.45fr_0.65fr_0.65fr_auto] gap-2"><input placeholder="Add exercise" value={newPlanExercise.name} onChange={(e) => setNewPlanExercise({ ...newPlanExercise, name: e.target.value })} className="col-span-2 md:col-span-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm" /><input type="number" placeholder="Sets" value={newPlanExercise.sets} onChange={(e) => setNewPlanExercise({ ...newPlanExercise, sets: e.target.value })} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm" /><input placeholder="Reps" value={newPlanExercise.reps} onChange={(e) => setNewPlanExercise({ ...newPlanExercise, reps: e.target.value })} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm" /><input placeholder="Rest" value={newPlanExercise.rest} onChange={(e) => setNewPlanExercise({ ...newPlanExercise, rest: e.target.value })} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm" /><button type="button" onClick={addPlanExercise} className="rounded-xl bg-neutral-950 px-3 py-2 text-xs font-semibold text-white">Add to plan</button></div>}
                  </SectionCard>
                  <SectionCard title="Weight goal" right={<IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Weight goal"} onClick={() => askIdeas("Weight goal", JSON.stringify({ currentWeight, targetWeight, targetDate, goalProgress }))} />}>
                    <p className="text-sm text-neutral-500">Current → target</p><p className="mt-1 text-2xl font-semibold text-neutral-950">{currentWeight}kg <span className="text-neutral-300">→</span> {targetWeight}kg</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${goalProgress}%` }} /></div><p className="mt-2 text-xs text-neutral-500">{Math.round(goalProgress)}% toward {targetDate}. Use the same scale and conditions when possible.</p><div className="mt-5 flex gap-2"><input type="number" step="0.1" placeholder="Today's kg" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm" /><button onClick={addWeight} className="dashboard-action rounded-xl bg-lime-300 px-3 py-2 text-xs font-semibold text-neutral-950">Log weight</button></div>
                  </SectionCard>
                </div>
                <SectionCard title="Weight trend & strength progress" right={<IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Progress"} onClick={() => askIdeas("Progress", JSON.stringify({ weight, liftLog }))} />}>
                  <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6"><div style={{ height: 220 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={weight}><CartesianGrid stroke="#F5F5F4" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 11, fill: "#A3A3A3" }} axisLine={false} tickLine={false} /><YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "#A3A3A3" }} axisLine={false} tickLine={false} /><Tooltip /><Line type="monotone" dataKey="weight" stroke="#34D399" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div><div><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-neutral-950">Lift log</p><p className="text-xs text-neutral-500">Compare load × reps over time</p></div><span className="rounded-full bg-lime-50 px-2.5 py-1 text-xs font-medium text-lime-700">{liftLog.length} entries</span></div><div className="max-h-48 overflow-y-auto">{liftLog.map((lift) => <div key={lift.id} className="flex items-center justify-between border-t border-neutral-100 py-2.5"><div><p className="text-sm font-medium text-neutral-800">{lift.exercise}</p><p className="text-xs text-neutral-400">{lift.date} · {lift.sets} sets × {lift.reps} reps</p></div><span className="text-sm font-semibold tabular-nums text-neutral-700">{lift.load}{lift.unit}</span></div>)}</div><div className="mt-4 grid grid-cols-2 gap-2"><input placeholder="Exercise" value={newLift.exercise} onChange={(e) => setNewLift({ ...newLift, exercise: e.target.value })} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm" /><input type="number" placeholder="Load kg" value={newLift.load} onChange={(e) => setNewLift({ ...newLift, load: e.target.value })} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm" /><input type="number" placeholder="Reps" value={newLift.reps} onChange={(e) => setNewLift({ ...newLift, reps: e.target.value })} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm" /><input type="number" placeholder="Sets" value={newLift.sets} onChange={(e) => setNewLift({ ...newLift, sets: e.target.value })} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm" /></div><button type="button" onClick={addLift} className="mt-2 rounded-xl bg-neutral-950 px-3 py-2 text-xs font-semibold text-white">Add lift</button></div></div>
                </SectionCard>
                <SectionCard title="Eat to recover" right={<IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Nutrition"} onClick={() => askIdeas("Nutrition", JSON.stringify({ currentWeight, targetWeight, nutritionPlan }))} />}>
                  <div className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">Start with a gradual surplus</p><p className="mt-1 text-amber-900/75">Use the meal rhythm below as a template. A starting point of roughly 300–500 extra calories per day can be adjusted from your weight trend, appetite, and clinician or dietitian advice.</p></div><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">{nutritionPlan.map((meal) => <div key={meal.slot} className="rounded-2xl bg-neutral-50 p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{meal.slot}</p><p className="mt-2 text-sm font-medium leading-5 text-neutral-800">{meal.meal}</p><p className="mt-2 text-xs text-neutral-500">{meal.cue}</p></div>)}</div><p className="mt-4 text-xs text-neutral-400">Favor balanced meals and protein foods; do not rely on chocolate or sugary drinks as the main weight-gain strategy.</p>
                </SectionCard>
              </>
            )}

            {healthSub === "sleep" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5"><StatCard icon={Moon} iconColor="blue" label="Average sleep" value={`${avgSleep}h`} delta="Target: 7h+" positive={Number(avgSleep) >= 7} /><StatCard icon={Moon} iconColor="violet" label="Last night" value={`${sleep[sleep.length - 1]?.hours || 0}h`} /><SectionCard title="Recovery signal"><p className="text-sm font-medium text-neutral-800">{Number(avgSleep) >= 7 ? "Your recent average is meeting the adult sleep target." : "Your recent average is below the 7-hour target."}</p><p className="mt-1 text-xs leading-5 text-neutral-500">Track timing and quality for a clearer pattern, not just one night.</p></SectionCard></div>
                <SectionCard title="Sleep diary" right={<div className="flex items-center gap-2"><IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Sleep"} onClick={() => askIdeas("Sleep", JSON.stringify({ sleep }))} /><button type="button" onClick={() => setShowGlobalVoiceLog(true)} className="dashboard-action rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white">Log by voice</button></div>}>
                  <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-2"><input type="number" step="0.5" placeholder="Hours" value={newSleep} onChange={(e) => setNewSleep(e.target.value)} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm" /><input type="time" aria-label="Bedtime" value={newSleepMeta.bedtime} onChange={(e) => setNewSleepMeta({ ...newSleepMeta, bedtime: e.target.value })} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm" /><input type="time" aria-label="Wake time" value={newSleepMeta.wake} onChange={(e) => setNewSleepMeta({ ...newSleepMeta, wake: e.target.value })} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm" /><button onClick={addSleep} className="dashboard-action rounded-xl bg-lime-300 px-3 py-2 text-xs font-semibold text-neutral-950">Log sleep</button></div>
                  <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="text-left text-xs text-neutral-400"><th className="pb-2 font-medium">Date</th><th className="pb-2 font-medium">Hours</th><th className="pb-2 font-medium">Timing</th><th className="pb-2 font-medium">Quality</th></tr></thead><tbody>{sleep.slice().reverse().map((entry) => <tr key={entry.date} className="border-t border-neutral-100"><td className="py-3 text-neutral-800">{entry.date}</td><td className="py-3 font-medium tabular-nums">{entry.hours}h</td><td className="py-3 text-neutral-500">{entry.bedtime && entry.wake ? `${entry.bedtime} → ${entry.wake}` : "Not logged"}</td><td className="py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${entry.quality === "Good" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{entry.quality || "—"}</span></td></tr>)}</tbody></table></div><p className="mt-4 text-xs text-neutral-400">A sleep diary is most useful when it includes bedtime, awakenings, wake time, naps, exercise, caffeine or alcohol, and medication. Regular sleep problems should be discussed with a healthcare professional.</p>
                </SectionCard>
                <SectionCard title="Daily check-ins" right={<span className="text-xs text-neutral-400">Synced to Today</span>}>
                  <div className="flex flex-wrap gap-2 mb-4">{[["Sleep log", "22:00"], ["Wake-up check-in", "07:00"], ["Weight check", "07:10"], ["Workout check-in", "18:00"]].map(([title, time]) => <button key={title} type="button" onClick={() => addHealthSchedule(title, time)} className="dashboard-action rounded-full bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-200">+ {title} · {time}</button>)}</div>
                  <div className="grid grid-cols-1 md:grid-cols-[1.3fr_0.9fr_0.5fr_0.7fr_auto] gap-2"><select value={newHealthSchedule.title} onChange={(e) => setNewHealthSchedule({ ...newHealthSchedule, title: e.target.value })} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"><option value="">Choose activity</option><option>Sleep log</option><option>Wake-up check-in</option><option>Weight check</option><option>Workout check-in</option><option value="custom">Custom activity</option></select>{newHealthSchedule.title === "custom" ? <input placeholder="Name the activity" value={customHealthActivity} onChange={(e) => setCustomHealthActivity(e.target.value)} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm" /> : <div className="hidden md:block" />}<input type="time" value={newHealthSchedule.time} onChange={(e) => setNewHealthSchedule({ ...newHealthSchedule, time: e.target.value })} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm" /><select value={newHealthSchedule.cadence} onChange={(e) => setNewHealthSchedule({ ...newHealthSchedule, cadence: e.target.value })} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"><option>Daily</option><option>Weekdays</option><option>Weekends</option></select><button type="button" onClick={() => addHealthSchedule(newHealthSchedule.title === "custom" ? customHealthActivity : newHealthSchedule.title, newHealthSchedule.time, newHealthSchedule.cadence)} className="rounded-xl bg-neutral-950 px-3 py-2 text-xs font-semibold text-white">Add</button></div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">{healthSchedules.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2.5"><div><p className="text-sm font-medium text-neutral-800">{item.title}</p><p className="text-xs text-neutral-400">{item.time} · {item.cadence}</p></div><button type="button" onClick={() => toggleHealthSchedule(item.id)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.enabled ? "bg-lime-100 text-lime-800" : "bg-neutral-200 text-neutral-500"}`}>{item.enabled ? "On" : "Off"}</button></div>)}</div>
                </SectionCard>
              </>
            )}

            {healthSub === "disease" && (
              <>
                <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">Log what you notice, then decide the next safe step.</p><p className="mt-1 leading-5 text-amber-900/75">Use voice for symptoms, onset, severity, clinic visits, medicines, and follow-up dates. The assistant can organize your record and suggest questions to ask a qualified clinician; it does not diagnose or prescribe.</p></div>
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
                  <StatCard icon={Pill} iconColor="emerald" label="Medication adherence (this log)" value={`${adherencePct}%`} />
                  <StatCard icon={Calendar} iconColor="blue" label="Next appointment" value={nextAppointment} />
                </div>

                <SectionCard title="Diseases & conditions" right={<IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Health conditions"} onClick={() => askIdeas("Health conditions", JSON.stringify({ diseases, conditionLog }))} />}>
                  <div className="flex flex-col">
                    {diseases.map((d) => (
                      <div key={d.id} className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-0">
                        <div>
                          <p className="text-sm text-neutral-800">{d.name}</p>
                          <p className="text-xs text-neutral-400">Since {d.since}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => toggleDiseaseStatus(d.id)}>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${d.status === "Active" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>
                              {d.status}
                            </span>
                          </button>
                          <button onClick={() => deleteDisease(d.id)} className="text-neutral-300 hover:text-rose-500">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <input placeholder="Add a disease or condition" value={newDisease} onChange={(e) => setNewDisease(e.target.value)} className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                    <button onClick={addDisease} className="px-4 py-2 bg-lime-400 text-neutral-950 text-sm font-medium rounded-lg flex items-center justify-center gap-1"><Plus size={14} /> Add</button>
                  </div>
                </SectionCard>

                {diseaseArchive.length > 0 && <SectionCard title="Archive" right={<span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-500">{diseaseArchive.length} resolved</span>}><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{diseaseArchive.map((disease) => <div key={disease.id} className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2.5"><div><p className="text-sm text-neutral-700">{disease.name}</p><p className="text-xs text-neutral-400">Resolved {disease.resolvedOn || "—"}</p></div><span className="text-xs font-medium text-emerald-700">Resolved</span></div>)}</div></SectionCard>}
                <SectionCard title="Ask the health assistant" right={<IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Health assistant"} onClick={() => askIdeas("Health assistant", JSON.stringify({ diseases, diseaseArchive, conditionLog }))} />}>
                  <div className="flex flex-col gap-2 max-h-72 overflow-y-auto mb-4">
                    {aiMessages.map((m, i) => (
                      <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "self-end bg-neutral-950 text-white" : "self-start bg-lime-50 text-lime-900"}`}>
                        <p>{m.text}</p>
                        {m.role === "assistant" && m.added > 0 && (
                          <p className="text-xs text-lime-700 mt-1">Added {m.added} item{m.added > 1 ? "s" : ""} to your todos.</p>
                        )}
                      </div>
                    ))}
                    {aiLoading && <div className="self-start bg-lime-50 text-lime-900 rounded-2xl px-4 py-2.5 text-sm">Thinking…</div>}
                  </div>
                  <div className="flex gap-2">
                    <input
                      placeholder="e.g. I got the flu"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && askHealthAI()}
                      className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2"
                    />
                    <button onClick={askHealthAI} disabled={aiLoading} className="px-4 py-2 bg-lime-400 text-neutral-950 text-sm font-medium rounded-lg disabled:opacity-50">
                      Ask
                    </button>
                  </div>
                  <p className="text-xs text-neutral-400 mt-2">General habit suggestions only — not a substitute for medical advice.</p>
                </SectionCard>

                <SectionCard title="Condition log" right={<div className="flex items-center gap-2"><IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Condition log"} onClick={() => askIdeas("Condition log", JSON.stringify({ conditionLog, diseases }))} /><button type="button" onClick={() => setShowGlobalVoiceLog(true)} className="dashboard-action rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white">Log by voice</button></div>}>
                  <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <div className="flex-1"><VoiceNoteBox onSubmit={(value) => setNewCondition({ ...newCondition, note: value })} placeholder="Record how you are feeling today, or type it here…" /></div>
                    <label className="flex items-center gap-2 text-sm text-neutral-600 px-2">
                      <input type="checkbox" checked={newCondition.medTaken} onChange={(e) => setNewCondition({ ...newCondition, medTaken: e.target.checked })} />
                      Took medication
                    </label>
                    <button onClick={addCondition} className="px-4 py-2 bg-lime-400 text-neutral-950 text-sm font-medium rounded-lg flex items-center justify-center gap-1"><Plus size={14} /> Log today</button>
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="text-left text-neutral-400 text-xs">
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium">Note</th>
                        <th className="pb-2 font-medium">Medication taken</th>
                        <th className="pb-2 font-medium">Next appointment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conditionLog.map((c) => (
                        <tr key={c.id} className="border-t border-neutral-100">
                          <td className="py-3 text-neutral-800">{c.date}</td>
                          <td className="py-3 text-neutral-600">{c.note}</td>
                          <td className="py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${c.medTaken ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                              {c.medTaken ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="py-3 text-neutral-500">{c.nextAppointment}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </SectionCard>
              </>
            )}
          </div>
        )}

        {tab === "work" && (
          <div className="flex flex-col gap-5">
            <div className="flex gap-2 flex-wrap">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActiveProject(p.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium ${activeProject === p.id ? "bg-neutral-950 text-white" : "bg-white text-neutral-600"}`}
                >
                  {p.name}
                </button>
              ))}
              <input
                placeholder="New project name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addProject()}
                className="text-sm border border-neutral-200 rounded-full px-4 py-2 w-40"
              />
              <button onClick={addProject} className="px-4 py-2 rounded-full text-sm font-medium bg-lime-400 text-neutral-950 flex items-center gap-1">
                <Plus size={14} /> New project
              </button>
            </div>

            <SectionCard title={currentProject?.name} right={<IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Work project"} onClick={() => askIdeas("Work project", JSON.stringify({ project: currentProject }))} />}>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="text-left text-neutral-400 text-xs">
                    <th className="pb-2 font-medium">Task</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Deadline</th>
                    <th className="pb-2 font-medium">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {currentProject?.tasks.map((t) => {
                    const overdue = new Date(t.deadline) < new Date("2026-08-28") && t.status !== "Done";
                    return (
                      <tr key={t.id} className="border-t border-neutral-100">
                        <td className="py-3 text-neutral-800">{t.name}</td>
                        <td className="py-3">
                          <button onClick={() => cycleStatus(t.id)}><StatusPill status={t.status} /></button>
                        </td>
                        <td className={`py-3 ${overdue ? "text-rose-500 font-medium" : "text-neutral-500"}`}>{t.deadline}{overdue && " (overdue)"}</td>
                        <td className="py-3 text-neutral-500">{t.priority}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <input placeholder="Task name" value={newTask.name} onChange={(e) => setNewTask({ ...newTask, name: e.target.value })} className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                <input type="date" value={newTask.deadline} onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })} className="text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} className="text-sm border border-neutral-200 rounded-lg px-3 py-2">
                  <option>Low</option><option>Medium</option><option>High</option>
                </select>
                <button onClick={addTask} className="px-4 py-2 bg-lime-400 text-neutral-950 text-sm font-medium rounded-lg flex items-center justify-center gap-1"><Plus size={14} /> Add task</button>
              </div>
              <div className="mt-5 pt-4 border-t border-neutral-100">
                <div className="flex items-center justify-between mb-3"><p className="text-sm font-medium text-neutral-800">Project todos</p><span className="text-xs text-neutral-400">{currentProjectTodos.filter((todo) => !todo.done).length} open</span></div>
                {currentProjectTodos.length === 0 && <p className="text-sm text-neutral-400 mb-3">No todos for this project yet.</p>}
                <div className="flex flex-col">{currentProjectTodos.map((todo) => <div key={todo.id} className="flex items-center gap-3 py-2 border-b border-neutral-100 last:border-0"><button onClick={() => toggleTodo(todo.id)} className={`w-4 h-4 rounded-full border flex items-center justify-center ${todo.done ? "bg-emerald-400 border-emerald-400" : "border-neutral-300"}`} aria-label={`Mark ${todo.text} ${todo.done ? "open" : "done"}`}>{todo.done && <Check size={10} className="text-white" />}</button><span className={`text-sm flex-1 ${todo.done ? "text-neutral-400 line-through" : "text-neutral-700"}`}>{todo.text}</span><button onClick={() => deleteTodo(todo.id)} className="text-xs text-neutral-400 hover:text-rose-500">Remove</button></div>)}</div>
                <div className="flex flex-col sm:flex-row gap-2 mt-3"><input placeholder="Add a todo for this project" value={newProjectTodo.text} onChange={(e) => setNewProjectTodo({ ...newProjectTodo, text: e.target.value })} className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2" /><input type="date" value={newProjectTodo.due} onChange={(e) => setNewProjectTodo({ ...newProjectTodo, due: e.target.value })} className="text-sm border border-neutral-200 rounded-lg px-3 py-2" /><button onClick={addProjectTodo} className="px-4 py-2 bg-lime-400 text-neutral-950 text-sm font-medium rounded-lg flex items-center justify-center gap-1"><Plus size={14} /> Add todo</button></div>
              </div>
            </SectionCard>
          </div>
        )}

        {tab === "school" && (
          <div className="flex flex-col gap-5">
            <SubTabs
              tabs={[{ key: "Georgetown", label: "Georgetown" }, { key: "Masters", label: "Masters" }]}
              active={schoolSub}
              onChange={setSchoolSub}
            />

            {schoolSub === "Georgetown" && (
              <>
                <SectionCard title="My Classes" right={<IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "My Classes"} onClick={() => askIdeas("My Classes", JSON.stringify({ classes, schoolSub }))} />}>
                  {classes.length === 0 && (
                    <p className="text-sm text-neutral-400 mb-2">No classes added yet — add the classes you're taking this semester below.</p>
                  )}
                  <div className="flex flex-col">
                    {classes.map((c) => (
                      <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
                            <BookOpen size={14} className="text-violet-600" />
                          </span>
                          <div>
                            <p className="text-sm font-medium text-neutral-800">{c.name}</p>
                            <p className="text-xs text-neutral-400">{[c.professor, c.schedule].filter(Boolean).join(" · ") || "—"}</p>
                          </div>
                        </div>
                        <button onClick={() => deleteClass(c.id)}><Trash2 size={14} className="text-neutral-300" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <input placeholder="Class (e.g. Econ 201)" value={newClass.name} onChange={(e) => setNewClass({ ...newClass, name: e.target.value })} className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                    <input placeholder="Professor" value={newClass.professor} onChange={(e) => setNewClass({ ...newClass, professor: e.target.value })} className="text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                    <input placeholder="Schedule (e.g. Mon/Wed 10am)" value={newClass.schedule} onChange={(e) => setNewClass({ ...newClass, schedule: e.target.value })} className="text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                    <button onClick={addClass} className="px-4 py-2 bg-lime-400 text-neutral-950 text-sm font-medium rounded-lg flex items-center justify-center gap-1"><Plus size={14} /> Add class</button>
                  </div>
                </SectionCard>

                <SectionCard title="Syllabus & Key Dates" right={<IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Syllabus & Key Dates"} onClick={() => askIdeas("Syllabus & Key Dates", JSON.stringify({ syllabusEvents, schoolSub }))} />}>
                  {upcomingSyllabusEvents.length === 0 ? (
                    <p className="text-sm text-neutral-400">No quizzes, midterms, or exams tracked yet — add syllabus dates below as you get them, and they'll show up in your todos too.</p>
                  ) : (
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="text-left text-neutral-400 text-xs">
                          <th className="pb-2 font-medium">Event</th>
                          <th className="pb-2 font-medium">Course</th>
                          <th className="pb-2 font-medium">Type</th>
                          <th className="pb-2 font-medium">Date</th>
                          <th className="pb-2 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {upcomingSyllabusEvents.map((ev) => {
                          const evDate = new Date(ev.date);
                          const todayDate = new Date(today);
                          const daysOut = Math.floor((evDate - todayDate) / 86400000);
                          const soon = daysOut >= 0 && daysOut <= 7;
                          const past = daysOut < 0;
                          const typeStyle = ev.type === "Exam" ? "bg-rose-50 text-rose-600" : ev.type === "Midterm" ? "bg-amber-50 text-amber-600" : "bg-violet-50 text-violet-600";
                          return (
                            <tr key={ev.id} className="border-t border-neutral-100">
                              <td className="py-3 text-neutral-800">{ev.title}</td>
                              <td className="py-3 text-neutral-500">{ev.course || "—"}</td>
                              <td className="py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${typeStyle}`}>{ev.type}</span></td>
                              <td className={`py-3 ${soon ? "text-amber-600 font-medium" : past ? "text-neutral-300" : "text-neutral-500"}`}>{ev.date}{soon && " (soon)"}</td>
                              <td className="py-3"><button onClick={() => deleteSyllabusEvent(ev.id)}><Trash2 size={14} className="text-neutral-300" /></button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <select value={newSyllabusEvent.course} onChange={(e) => setNewSyllabusEvent({ ...newSyllabusEvent, course: e.target.value })} className="text-sm border border-neutral-200 rounded-lg px-3 py-2">
                      <option value="">Course…</option>
                      {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <input placeholder="e.g. Midterm 1" value={newSyllabusEvent.title} onChange={(e) => setNewSyllabusEvent({ ...newSyllabusEvent, title: e.target.value })} className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                    <select value={newSyllabusEvent.type} onChange={(e) => setNewSyllabusEvent({ ...newSyllabusEvent, type: e.target.value })} className="text-sm border border-neutral-200 rounded-lg px-3 py-2">
                      <option>Quiz</option><option>Midterm</option><option>Exam</option><option>Assignment Due</option>
                    </select>
                    <input type="date" value={newSyllabusEvent.date} onChange={(e) => setNewSyllabusEvent({ ...newSyllabusEvent, date: e.target.value })} className="text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                    <button onClick={addSyllabusEvent} className="px-4 py-2 bg-lime-400 text-neutral-950 text-sm font-medium rounded-lg flex items-center justify-center gap-1"><Plus size={14} /> Add</button>
                  </div>
                </SectionCard>
              </>
            )}

            {ideaResult && tab !== "home" && <div className="bg-lime-50 rounded-2xl p-4 text-sm text-lime-900 whitespace-pre-wrap"><p className="font-medium mb-1">{ideaResult.section}</p>{ideaResult.text || "Generating ideas…"}</div>}
            {schoolSub === "Masters" && (
              <>
                <p className="text-xs text-neutral-500 -mb-2">AI Ideas uses the deadlines you enter here and will clearly flag anything that must be verified on each program’s official admissions website.</p>
                <SectionCard title="Applications" right={<IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Masters applications"} onClick={() => askIdeas("Masters applications", JSON.stringify({ applications, recommenders, mastersTodos }))} />}>
                  {applications.length === 0 ? (
                    <p className="text-sm text-neutral-400">No programs added yet — add schools you're applying to below.</p>
                  ) : (
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="text-left text-neutral-400 text-xs">
                          <th className="pb-2 font-medium">School</th>
                          <th className="pb-2 font-medium">Program</th>
                          <th className="pb-2 font-medium">Deadline</th>
                          <th className="pb-2 font-medium">Status</th>
                          <th className="pb-2 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {applications.map((a) => {
                          const overdue = a.deadline && new Date(a.deadline) < new Date(today) && a.status !== "Submitted" && a.status !== "Received";
                          return (
                            <tr key={a.id} className="border-t border-neutral-100">
                              <td className="py-3 text-neutral-800">{a.school}</td>
                              <td className="py-3 text-neutral-500">{a.program || "—"}</td>
                              <td className={`py-3 ${overdue ? "text-rose-500 font-medium" : "text-neutral-500"}`}>{a.deadline || "—"}{overdue && " (overdue)"}</td>
                              <td className="py-3"><button onClick={() => cycleApplicationStatus(a.id)}><StatusPill status={a.status} /></button></td>
                              <td className="py-3"><button onClick={() => deleteApplication(a.id)}><Trash2 size={14} className="text-neutral-300" /></button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <input placeholder="School" value={newApplication.school} onChange={(e) => setNewApplication({ ...newApplication, school: e.target.value })} className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                    <input placeholder="Program" value={newApplication.program} onChange={(e) => setNewApplication({ ...newApplication, program: e.target.value })} className="sm:w-40 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                    <input type="date" value={newApplication.deadline} onChange={(e) => setNewApplication({ ...newApplication, deadline: e.target.value })} className="text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                    <button onClick={addApplication} className="px-4 py-2 bg-lime-400 text-neutral-950 text-sm font-medium rounded-lg flex items-center justify-center gap-1"><Plus size={14} /> Add</button>
                  </div>
                  <p className="text-xs text-neutral-400 mt-3">Tap a status pill to cycle: Not Started → In Progress → Submitted → Received.</p>
                </SectionCard>

                <SectionCard title="Recommendations & Materials" right={<IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Masters recommendations"} onClick={() => askIdeas("Masters recommendations", JSON.stringify({ applications, recommenders, mastersTodos }))} />}>
                  {recommenders.length === 0 ? (
                    <p className="text-sm text-neutral-400">No recommenders added yet — track who you're asking and where things stand below.</p>
                  ) : (
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="text-left text-neutral-400 text-xs">
                          <th className="pb-2 font-medium">Recommender</th>
                          <th className="pb-2 font-medium">Relationship</th>
                          <th className="pb-2 font-medium">Due</th>
                          <th className="pb-2 font-medium">Status</th>
                          <th className="pb-2 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {recommenders.map((r) => (
                          <tr key={r.id} className="border-t border-neutral-100">
                            <td className="py-3 text-neutral-800">{r.name}</td>
                            <td className="py-3 text-neutral-500">{r.relationship || "—"}</td>
                            <td className="py-3 text-neutral-500">{r.dueDate || "—"}</td>
                            <td className="py-3"><button onClick={() => cycleRecommenderStatus(r.id)}><StatusPill status={r.status} /></button></td>
                            <td className="py-3"><button onClick={() => deleteRecommender(r.id)}><Trash2 size={14} className="text-neutral-300" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <input placeholder="Recommender name" value={newRecommender.name} onChange={(e) => setNewRecommender({ ...newRecommender, name: e.target.value })} className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                    <input placeholder="Relationship (e.g. former manager)" value={newRecommender.relationship} onChange={(e) => setNewRecommender({ ...newRecommender, relationship: e.target.value })} className="text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                    <input type="date" value={newRecommender.dueDate} onChange={(e) => setNewRecommender({ ...newRecommender, dueDate: e.target.value })} className="text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                    <button onClick={addRecommender} className="px-4 py-2 bg-lime-400 text-neutral-950 text-sm font-medium rounded-lg flex items-center justify-center gap-1"><Plus size={14} /> Add</button>
                  </div>
                  <p className="text-xs text-neutral-400 mt-3">Tap a status pill to cycle: Not Asked → Asked → Confirmed → Submitted.</p>
                </SectionCard>

                <SectionCard title="Masters To-Dos" right={<IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Masters preparation"} onClick={() => askIdeas("Masters preparation", JSON.stringify({ applications, recommenders, mastersTodos, today }))} />}>
                  {mastersTodos.length === 0 && <p className="text-sm text-neutral-400 mb-2">Nothing here yet — anything you add with the "school" domain from your Todos will also show up here.</p>}
                  <div className="flex flex-col">
                    {mastersTodos.map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-0">
                        <button onClick={() => toggleTodo(t.id)} className="flex items-center gap-3">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center ${t.done ? "bg-emerald-400" : "border border-neutral-300"}`}>
                            {t.done && <Check size={12} className="text-white" />}
                          </span>
                          <span className={`text-sm ${t.done ? "text-neutral-400 line-through" : "text-neutral-800"}`}>{t.text}</span>
                        </button>
                        <span className="text-xs text-neutral-400">{t.due || "—"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <input
                      placeholder="e.g. Draft personal statement"
                      value={newTodo.domain === "school" ? newTodo.text : ""}
                      onChange={(e) => setNewTodo({ text: e.target.value, due: newTodo.due, time: "", domain: "school" })}
                      className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2"
                    />
                    <input
                      type="date"
                      value={newTodo.domain === "school" ? newTodo.due : ""}
                      onChange={(e) => setNewTodo({ text: newTodo.text, due: e.target.value, time: "", domain: "school" })}
                      className="text-sm border border-neutral-200 rounded-lg px-3 py-2"
                    />
                    <button onClick={addTodo} className="px-4 py-2 bg-lime-400 text-neutral-950 text-sm font-medium rounded-lg flex items-center justify-center gap-1"><Plus size={14} /> Add</button>
                  </div>
                </SectionCard>
              </>
            )}

            <div className="flex gap-4 flex-wrap">
              {Object.entries(gradedByCourse).map(([course, grades]) => (
                <StatCard key={course} icon={GraduationCap} iconColor="violet" label={course} value={grades[grades.length - 1]} />
              ))}
            </div>

            <SectionCard title="Assignments" right={<IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Assignments"} onClick={() => askIdeas("Assignments", JSON.stringify({ assignments, schoolSub }))} />}>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="text-left text-neutral-400 text-xs">
                    <th className="pb-2 font-medium">Title</th>
                    <th className="pb-2 font-medium">Course</th>
                    <th className="pb-2 font-medium">Due</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {schoolAssignments.map((a) => (
                    <tr key={a.id} className="border-t border-neutral-100">
                      <td className="py-3 text-neutral-800">{a.title}</td>
                      <td className="py-3 text-neutral-500">{a.course}</td>
                      <td className="py-3 text-neutral-500">{a.due}</td>
                      <td className="py-3"><StatusPill status={a.status} /></td>
                      <td className="py-3 text-neutral-500">{a.grade || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <input placeholder="Assignment title" value={newAssignment.title} onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })} className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                <input placeholder="Course" value={newAssignment.course} onChange={(e) => setNewAssignment({ ...newAssignment, course: e.target.value })} className="sm:w-32 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                <input type="date" value={newAssignment.due} onChange={(e) => setNewAssignment({ ...newAssignment, due: e.target.value })} className="text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                <button onClick={addAssignment} className="px-4 py-2 bg-lime-400 text-neutral-950 text-sm font-medium rounded-lg flex items-center justify-center gap-1"><Plus size={14} /> Add</button>
              </div>
            </SectionCard>

            <SectionCard title="Readings" right={<IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Readings"} onClick={() => askIdeas("Readings", JSON.stringify({ readings, schoolSub }))} />}>
              <div className="flex flex-col">
                {schoolReadings.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-0">
                    <button
                      onClick={() => setReadings(prev => prev.map(x => x.id !== r.id ? x : { ...x, done: !x.done }))}
                      className="flex items-center gap-3"
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center ${r.done ? "bg-emerald-400" : "border border-neutral-300"}`}>
                        {r.done && <Check size={12} className="text-white" />}
                      </span>
                      <span className={`text-sm ${r.done ? "text-neutral-400 line-through" : "text-neutral-800"}`}>{r.title}</span>
                    </button>
                    <span className="text-xs text-neutral-400">{r.course}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <input placeholder="Reading title" value={newReading.title} onChange={(e) => setNewReading({ ...newReading, title: e.target.value })} className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                <input placeholder="Course" value={newReading.course} onChange={(e) => setNewReading({ ...newReading, course: e.target.value })} className="sm:w-32 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                <button onClick={addReading} className="px-4 py-2 bg-lime-400 text-neutral-950 text-sm font-medium rounded-lg flex items-center justify-center gap-1"><Plus size={14} /> Add</button>
              </div>
            </SectionCard>
          </div>
        )}

        {tab === "calendar" && (
          <CalendarWorkspace
            todos={todos}
            assignments={assignments}
            syllabusEvents={syllabusEvents}
            projects={projects}
            people={people}
            onIdeas={askIdeas}
          />
        )}

        {tab === "relationships" && (
          <div className="flex flex-col gap-5">
            <SubTabs
              tabs={[{ key: "Family", label: "Family" }, { key: "Friends", label: "Friends" }, { key: "Other", label: "Other" }]}
              active={relationshipsSub}
              onChange={setRelationshipsSub}
            />

            <SectionCard title={relationshipsSub} right={<IdeaButton loading={ideasMutation.isPending && ideaResult?.section === "Relationships"} onClick={() => askIdeas("Relationships", JSON.stringify({ people }))} />}>
              {relationshipsFiltered.length === 0 && (
                <p className="text-sm text-neutral-400 mb-2">No one here yet — add someone below.</p>
              )}
              <div className="flex flex-col gap-3">
                {relationshipsFiltered.map((p) => (
                  <PersonCard
                    key={p.id}
                    person={p}
                    daysSinceFn={daysSince}
                    onMarkContacted={markContacted}
                    onAddGoal={addGoal}
                    onToggleGoal={toggleGoal}
                    onEditGoal={editGoal}
                    onDeleteGoal={deleteGoal}
                    onUpdateNotes={updateNotes}
                    onGetTalkingPoints={getTalkingPoints}
                    onDelete={deletePerson}
                    goalDraft={newGoalText[p.id]}
                    onGoalDraftChange={setGoalDraft}
                    loading={!!talkingPointsLoading[p.id]}
                  />
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-neutral-100">
                <input placeholder="Name" value={newPerson.name} onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })} className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                <select value={newPerson.type} onChange={(e) => setNewPerson({ ...newPerson, type: e.target.value })} className="text-sm border border-neutral-200 rounded-lg px-3 py-2">
                  <option>Family</option><option>Mother</option><option>Father</option><option>Brother</option><option>Sister</option><option>Uncle</option><option>Aunt</option><option>Cousin</option><option>Friend</option><option>Girlfriend</option><option>Boyfriend</option><option>Ex-girlfriend</option><option>Ex-boyfriend</option><option>Partner</option><option>Classmate</option><option>Colleague</option><option>Mentor</option><option>Neighbor</option><option>Other</option>
                </select>
                <input placeholder="Check-in every (days)" value={newPerson.threshold} onChange={(e) => setNewPerson({ ...newPerson, threshold: e.target.value })} className="sm:w-40 text-sm border border-neutral-200 rounded-lg px-3 py-2" />
                <button onClick={addPerson} className="px-4 py-2 bg-lime-400 text-neutral-950 text-sm font-medium rounded-lg flex items-center justify-center gap-1"><Plus size={14} /> Add</button>
              </div>
            </SectionCard>
          </div>
        )}
      </main>
    </div>
  );
}
