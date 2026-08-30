export function applyIncomeReceipt(row: { toReceive: number; paid: number }, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return row;
  return { ...row, paid: Math.min(row.toReceive, row.paid + amount) };
}

export function addIncomeExpected(row: { toReceive: number }, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return row;
  return { ...row, toReceive: row.toReceive + amount };
}

export function applyDebtPayment(row: { debt: number; paid: number; status?: string }, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return row;
  const paid = Math.min(row.debt, row.paid + amount);
  return { ...row, paid, status: paid >= row.debt ? "Paid" : row.status };
}

export function addDebtPrincipal(row: { debt: number; status?: string }, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return row;
  return { ...row, debt: row.debt + amount, status: "Active" };
}

export function appendVoiceNote(existing: string, next: string) {
  const value = next.trim();
  if (!value) return existing;
  return existing ? `${existing}\n${value}` : value;
}

export function buildFinanceInsights(
  incomeRows: Array<{ toReceive?: number; paid?: number }> = [],
  debtRows: Array<{ status?: string; balance?: number; debt?: number; paid?: number }> = [],
) {
  const expected = incomeRows.reduce((sum, row) => sum + Number(row.toReceive || 0), 0);
  const received = incomeRows.reduce((sum, row) => sum + Number(row.paid || 0), 0);
  const outstandingDebt = debtRows.filter((row) => row.status === "Active").reduce((sum, row) => sum + Number(row.balance ?? (Number(row.debt || 0) - Number(row.paid || 0))), 0);
  const collectionRate = expected > 0 ? Math.round((received / expected) * 100) : 0;
  const coverage = outstandingDebt > 0 ? Math.round((received / outstandingDebt) * 100) : 100;
  const actions: string[] = [];
  if (collectionRate < 50) actions.push("Follow up on the oldest unpaid income first.");
  if (outstandingDebt > received) actions.push("Prioritize a partial payment plan on the highest-cost active debt.");
  if (!actions.length) actions.push("Keep the current cadence and log every partial receipt or payment.");
  return { expected, received, outstandingDebt, collectionRate, coverage, actions };
}

type VoiceUpdateState = {
  todos: any[];
  projects: any[];
  debts: any[];
  income: any[];
  workouts: any[];
  liftLog?: any[];
  weight: any[];
  sleep: any[];
  conditionLog: any[];
};

export function filterTodosForProject(todos: any[], projectId: string | number, projectName = "") {
  return todos.filter((todo) => todo.domain === "work" && (todo.projectId === projectId || (projectName && typeof todo.text === "string" && todo.text.includes(projectName))));
}

export function applyVoiceActionToState(state: VoiceUpdateState, action: any, date: string, id: string | number = `voice-${Date.now()}`): VoiceUpdateState {
  if (!action || !action.type) return state;
  switch (action.type) {
    case "add_todo":
      return { ...state, todos: [...state.todos, { id, text: action.text || "New task", due: action.due || date, time: action.time || "", domain: action.domain || "", done: false }] };
    case "update_task_status":
      return {
        ...state,
        projects: state.projects.map((project) => ({ ...project, tasks: (project.tasks || []).map((task: any) => task.id !== action.taskId ? task : { ...task, status: action.status }) })),
        todos: state.todos.map((todo) => todo.taskId === action.taskId ? { ...todo, done: action.status === "Done" } : todo),
      };
    case "log_debt_payment":
      return { ...state, debts: state.debts.map((debt) => debt.id !== action.debtId ? debt : applyDebtPayment(debt, Number(action.amount || 0))) };
    case "log_income_payment":
      return { ...state, income: state.income.map((row) => row.id !== action.incomeId ? row : applyIncomeReceipt(row, Number(action.amount || 0))) };
    case "log_workout":
      return { ...state, workouts: [{ id, date, type: action.workoutType || "Workout", duration: action.duration || "—" }, ...state.workouts] };
    case "log_lift": {
      const load = Number(action.load);
      const reps = Number(action.reps);
      const sets = Number(action.sets || 1);
      if (!action.exercise || !Number.isFinite(load) || load <= 0 || !Number.isFinite(reps) || reps <= 0) return state;
      return { ...state, liftLog: [{ id, date, exercise: action.exercise, load, unit: "kg", reps, sets, note: action.note || "" }, ...(state.liftLog || [])] };
    }
    case "log_weight": {
      const weight = Number(action.weight);
      if (!Number.isFinite(weight) || weight <= 0) return state;
      return { ...state, weight: [...state.weight.filter((row) => row.date !== date), { date, weight }] };
    }
    case "log_sleep": {
      const hours = Number(action.hours);
      if (!Number.isFinite(hours) || hours < 0 || hours > 24) return state;
      return { ...state, sleep: [...state.sleep.filter((row) => row.date !== date), { date, hours }] };
    }
    case "log_condition":
      return { ...state, conditionLog: [{ id, date, note: action.note || "No note", medTaken: Boolean(action.medTaken) }, ...state.conditionLog] };
    default:
      return state;
  }
}
