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
