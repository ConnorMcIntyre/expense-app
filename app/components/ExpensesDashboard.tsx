'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import db from "@/lib/db";
import { id, type InstaQLEntity } from "@instantdb/react";
import schema from "../../instant.schema";
import {
  calendarYearFromTimestamp,
  isLocalMidnight,
  localTimeHm,
  localYearMonthNow,
  parseLocalDateTimeYmdHm,
  parseLocalDateYmd,
  timestampToLocalHm,
  timestampToLocalYmd,
  yearMonthFromTimestamp,
} from "@/lib/dateUtils";
import { ExpenseForm } from "./ExpenseForm";

type ExpenseEntity = InstaQLEntity<typeof schema, "expenses", { owner: {} }>;
type BudgetEntity = InstaQLEntity<typeof schema, "budgets", { owner: {} }>;

type ActiveTab = "expenses" | "totals" | "yearly" | "budget" | "compare";

const PIE_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f97316",
  "#ec4899",
  "#06b6d4",
  "#eab308",
];

function formatMonthLabel(value: string | null | undefined, opts?: { emptyLabel?: string }) {
  if (!value) {
    return opts?.emptyLabel ?? "all months";
  }
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  const monthIndex = Number(month) - 1;
  if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return value;
  const date = new Date(Number(year), monthIndex, 1);
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatYearLabel(value: string | null | undefined, opts?: { emptyLabel?: string }) {
  if (!value) {
    return opts?.emptyLabel ?? "all years";
  }
  const [year] = value.split("-");
  if (!year) return value;
  return year;
}

function formatExpenseWhen(createdAt: number): string {
  const d = new Date(createdAt);
  return isLocalMidnight(createdAt)
    ? d.toLocaleDateString()
    : d.toLocaleString();
}

/** Matches how we bucket types in totals / yearly breakdowns. */
function expenseTypeCategory(type: string | undefined | null): string {
  return (type || "Uncategorized").trim() || "Uncategorized";
}

type BudgetEntry = {
  id: string;
  type: string;
  month: string; // YYYY-MM
  amount: number;
};

export function ExpensesDashboard() {
  const user = db.useUser();
  const userId = user?.id;
  const [activeTab, setActiveTab] = useState<ActiveTab>("expenses");
  const [totalsMonth, setTotalsMonth] = useState(() => localYearMonthNow());
  const [totalsStore, setTotalsStore] = useState("");
  const [totalsCategoryTypeFilter, setTotalsCategoryTypeFilter] = useState<
    string | null
  >(null);
  const [yearlyYear, setYearlyYear] = useState(() =>
    String(new Date().getFullYear()),
  );
  const [yearlyStore, setYearlyStore] = useState("");
  const [yearlyCategoryTypeFilter, setYearlyCategoryTypeFilter] = useState<
    string | null
  >(null);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(
    null,
  );
  const [recordExpensesScope, setRecordExpensesScope] = useState<
    "recent" | "all"
  >("recent");
  /** Empty = all months (default) when viewing All expenses */
  const [recordAllExpensesMonth, setRecordAllExpensesMonth] = useState("");

  const toggleYearlyCategoryFilter = useCallback((typeKey: string) => {
    setYearlyCategoryTypeFilter((prev) =>
      prev === typeKey ? null : typeKey,
    );
  }, []);

  const toggleTotalsCategoryFilter = useCallback((typeKey: string) => {
    setTotalsCategoryTypeFilter((prev) =>
      prev === typeKey ? null : typeKey,
    );
  }, []);

  useEffect(() => {
    setYearlyCategoryTypeFilter(null);
  }, [yearlyYear, yearlyStore]);

  useEffect(() => {
    setTotalsCategoryTypeFilter(null);
  }, [totalsMonth, totalsStore]);

  useEffect(() => {
    if (activeTab !== "totals") setTotalsCategoryTypeFilter(null);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "yearly") setYearlyCategoryTypeFilter(null);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "expenses") {
      setRecordExpensesScope("recent");
      setRecordAllExpensesMonth("");
    }
  }, [activeTab]);

  useEffect(() => {
    if (recordExpensesScope !== "all") {
      setRecordAllExpensesMonth("");
    }
  }, [recordExpensesScope]);

  const { isLoading, error, data } = db.useQuery(
    userId
      ? {
          expenses: {
            $: {
              where: {
                owner: userId,
              },
              order: {
                createdAt: "desc",
              },
            },
          },
          budgets: {
            $: {
              where: {
                owner: userId,
              },
              order: {
                createdAt: "desc",
              },
            },
          },
        }
      : null,
  );

  const expenses = (data?.expenses as ExpenseEntity[]) ?? [];
  const budgets = (data?.budgets as BudgetEntity[]) ?? [];
  const selectedExpense =
    selectedExpenseId != null
      ? expenses.find((e) => e.id === selectedExpenseId) ?? null
      : null;

  const recentExpensesFive = useMemo(
    () => expenses.slice(0, 5),
    [expenses],
  );

  const recordAllFilteredExpenses = useMemo(() => {
    const m = recordAllExpensesMonth.trim();
    if (!m) return expenses;
    return expenses.filter(
      (e) => yearMonthFromTimestamp(e.createdAt) === m,
    );
  }, [expenses, recordAllExpensesMonth]);

  const recordTabListExpenses =
    recordExpensesScope === "all"
      ? recordAllFilteredExpenses
      : recentExpensesFive;

  useEffect(() => {
    if (recordExpensesScope !== "recent" || selectedExpenseId == null) return;
    const stillVisible = recentExpensesFive.some(
      (e) => e.id === selectedExpenseId,
    );
    if (!stillVisible) setSelectedExpenseId(null);
  }, [recordExpensesScope, selectedExpenseId, recentExpensesFive]);

  useEffect(() => {
    if (recordExpensesScope !== "all" || selectedExpenseId == null) return;
    const stillVisible = recordAllFilteredExpenses.some(
      (e) => e.id === selectedExpenseId,
    );
    if (!stillVisible) setSelectedExpenseId(null);
  }, [
    recordExpensesScope,
    selectedExpenseId,
    recordAllFilteredExpenses,
  ]);

  const { total, byType } = useMemo(() => {
    const summary = new Map<string, number>();
    let runningTotal = 0;

    for (const exp of expenses) {
      const monthKey = yearMonthFromTimestamp(exp.createdAt);
      if (totalsMonth && monthKey !== totalsMonth) continue;

      const price = Number(exp.price) || 0;
      runningTotal += price;
      const key = (exp.type || "Uncategorized").trim() || "Uncategorized";
      summary.set(key, (summary.get(key) ?? 0) + price);
    }

    const byTypeArr = Array.from(summary.entries())
      .map(([type, amount]) => ({
        type,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { total: runningTotal, byType: byTypeArr };
  }, [expenses, totalsMonth]);

  const monthExpensesForTotals = useMemo(
    () =>
      expenses.filter((exp) => {
        const monthKey = yearMonthFromTimestamp(exp.createdAt);
        return totalsMonth ? monthKey === totalsMonth : true;
      }),
    [expenses, totalsMonth],
  );

  const filteredMonthExpenses = useMemo(() => {
    const q = totalsStore.trim().toLowerCase();
    if (!q) return monthExpensesForTotals;
    return monthExpensesForTotals.filter((exp) =>
      (exp.store || "").toLowerCase().includes(q),
    );
  }, [monthExpensesForTotals, totalsStore]);

  const totalsListExpenses = useMemo(() => {
    if (!totalsCategoryTypeFilter) return filteredMonthExpenses;
    return filteredMonthExpenses.filter(
      (exp) =>
        expenseTypeCategory(exp.type) === totalsCategoryTypeFilter,
    );
  }, [filteredMonthExpenses, totalsCategoryTypeFilter]);

  const yearOptions = useMemo(() => {
    const set = new Set<number>();
    set.add(new Date().getFullYear());
    const selected = Number.parseInt(yearlyYear, 10);
    if (!Number.isNaN(selected)) set.add(selected);
    for (const e of expenses) {
      set.add(calendarYearFromTimestamp(e.createdAt));
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [expenses, yearlyYear]);

  const yearExpensesForYear = useMemo(() => {
    const y = Number.parseInt(yearlyYear, 10);
    if (Number.isNaN(y)) return [];
    return expenses.filter(
      (exp) => calendarYearFromTimestamp(exp.createdAt) === y,
    );
  }, [expenses, yearlyYear]);

  const filteredYearExpenses = useMemo(() => {
    const q = yearlyStore.trim().toLowerCase();
    if (!q) return yearExpensesForYear;
    return yearExpensesForYear.filter((exp) =>
      (exp.store || "").toLowerCase().includes(q),
    );
  }, [yearExpensesForYear, yearlyStore]);

  const { yearlyTotal, yearlyByType } = useMemo(() => {
    const summary = new Map<string, number>();
    let runningTotal = 0;
    for (const exp of filteredYearExpenses) {
      const price = Number(exp.price) || 0;
      runningTotal += price;
      const key = (exp.type || "Uncategorized").trim() || "Uncategorized";
      summary.set(key, (summary.get(key) ?? 0) + price);
    }
    const byTypeArr = Array.from(summary.entries())
      .map(([type, amount]) => ({
        type,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
    return { yearlyTotal: runningTotal, yearlyByType: byTypeArr };
  }, [filteredYearExpenses]);

  const yearlyListExpenses = useMemo(() => {
    if (!yearlyCategoryTypeFilter) return filteredYearExpenses;
    return filteredYearExpenses.filter(
      (exp) => expenseTypeCategory(exp.type) === yearlyCategoryTypeFilter,
    );
  }, [filteredYearExpenses, yearlyCategoryTypeFilter]);

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              ExpenseBetter
            </h1>
            <p className="text-sm text-zinc-500">
              Track your expenses in seconds.
            </p>
          </div>
          {user && (
            <div className="flex flex-col items-start gap-2 text-xs text-zinc-500 sm:flex-row sm:items-center">
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                Signed in as{" "}
                <span className="font-medium">{user.email ?? "Unknown"}</span>
              </span>
              <button
                type="button"
                onClick={() => db.auth.signOut()}
                className="rounded-full border border-white px-3 py-1 text-xs font-medium text-white transition hover:bg-white/10"
              >
                Sign out
              </button>
            </div>
          )}
        </header>

        <nav className="flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-zinc-100/60 p-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60">
          <button
            type="button"
            onClick={() => setActiveTab("expenses")}
            className={`min-w-[6.5rem] flex-1 rounded-full px-3 py-1.5 transition ${
              activeTab === "expenses"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                : "hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80"
            }`}
          >
            Record Expense
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("totals")}
            className={`min-w-[6.5rem] flex-1 rounded-full px-3 py-1.5 transition ${
              activeTab === "totals"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                : "hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80"
            }`}
          >
            Total Expenses by Month
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("yearly")}
            className={`min-w-[6.5rem] flex-1 rounded-full px-3 py-1.5 transition ${
              activeTab === "yearly"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                : "hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80"
            }`}
          >
            Yearly Breakdown
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("budget")}
            className={`min-w-[6.5rem] flex-1 rounded-full px-3 py-1.5 transition ${
              activeTab === "budget"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                : "hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80"
            }`}
          >
            Budget
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("compare")}
            className={`min-w-[6.5rem] flex-1 rounded-full px-3 py-1.5 transition ${
              activeTab === "compare"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                : "hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80"
            }`}
          >
            Expenses vs Budget
          </button>
        </nav>

        {activeTab === "expenses" ? (
          <section className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
                Add expense
              </h2>
              <ExpenseForm />
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <div>
                  <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                    {recordExpensesScope === "all"
                      ? "All expenses"
                      : "Recent expenses"}
                  </h2>
                  {recordExpensesScope === "recent" && expenses.length > 0 ? (
                    <p className="text-[11px] text-zinc-400">
                      Showing {recentExpensesFive.length} most recent
                      {expenses.length > 5
                        ? ` of ${expenses.length} total`
                        : ""}
                      .
                    </p>
                  ) : null}
                  {recordExpensesScope === "all" && expenses.length > 0 ? (
                    <p className="text-[11px] text-zinc-400">
                      {recordAllExpensesMonth.trim()
                        ? `Filtered to ${formatMonthLabel(recordAllExpensesMonth)} (${recordTabListExpenses.length} of ${expenses.length} expenses).`
                        : "Showing every expense."}
                    </p>
                  ) : null}
                </div>
                <span className="text-xs text-zinc-400">
                  {expenses.length} total
                </span>
              </div>
              {recordExpensesScope === "all" ? (
                <div className="mb-3 space-y-3">
                  <button
                    type="button"
                    onClick={() => setRecordExpensesScope("recent")}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:w-auto"
                  >
                    ← Back to recent
                  </button>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                    <div className="space-y-1">
                      <label
                        htmlFor="recordAllExpensesMonth"
                        className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                      >
                        Month filter
                      </label>
                      <input
                        id="recordAllExpensesMonth"
                        type="month"
                        value={recordAllExpensesMonth}
                        onChange={(e) =>
                          setRecordAllExpensesMonth(e.target.value)
                        }
                        className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-black outline-none ring-0 transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-800 sm:w-40"
                      />
                      <p className="text-[11px] text-zinc-400">
                        Leave unset to include all months (default).
                      </p>
                    </div>
                    {recordAllExpensesMonth ? (
                      <button
                        type="button"
                        onClick={() => setRecordAllExpensesMonth("")}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                      >
                        Show all months
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {recordExpensesScope === "all" && selectedExpense ? (
                <ExpenseDetails
                  key={selectedExpense.id}
                  expense={selectedExpense}
                  onDeleted={() => setSelectedExpenseId(null)}
                  onClose={() => setSelectedExpenseId(null)}
                />
              ) : null}
              {isLoading ? (
                <p className="text-sm text-zinc-500">Loading expenses...</p>
              ) : error ? (
                <p className="text-sm text-red-500">
                  Error loading expenses: {error.message}
                </p>
              ) : expenses.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No expenses yet. Add your first one on the left.
                </p>
              ) : (
                <>
                  {recordExpensesScope === "all" &&
                  recordTabListExpenses.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No expenses in{" "}
                      {formatMonthLabel(recordAllExpensesMonth)}.
                    </p>
                  ) : (
                    <ExpensesList
                      expenses={recordTabListExpenses}
                      selectedExpenseId={selectedExpenseId}
                      onSelect={(expense) =>
                        setSelectedExpenseId(
                          expense.id === selectedExpenseId
                            ? null
                            : expense.id,
                        )
                      }
                    />
                  )}
                  {recordExpensesScope === "recent" && selectedExpense ? (
                    <ExpenseDetails
                      key={selectedExpense.id}
                      expense={selectedExpense}
                      onDeleted={() => setSelectedExpenseId(null)}
                      onClose={() => setSelectedExpenseId(null)}
                    />
                  ) : null}
                  {recordExpensesScope === "recent" &&
                  expenses.length > 5 ? (
                    <button
                      type="button"
                      onClick={() => setRecordExpensesScope("all")}
                      className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                    >
                      All expenses
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </section>
        ) : activeTab === "totals" ? (
          <section className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-sm font-medium uppercase tracking-wide text-black dark:text-zinc-500">
                    Total Expenses by Month
                  </h2>
                  <p className="text-xs text-black dark:text-zinc-400">
                    Showing expenses for{" "}
                    <span className="font-medium">
                      {formatMonthLabel(totalsMonth)}
                    </span>
                    .
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label
                      htmlFor="totalsMonth"
                      className="block text-[11px] font-medium uppercase tracking-wide text-black dark:text-zinc-500"
                    >
                      Month filter
                    </label>
                    <input
                      id="totalsMonth"
                      type="month"
                      value={totalsMonth}
                      onChange={(e) => setTotalsMonth(e.target.value)}
                      className="w-40 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-black outline-none ring-0 transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="totalsStore"
                      className="block text-[11px] font-medium uppercase tracking-wide text-black dark:text-zinc-500"
                    >
                      Store filter (month)
                    </label>
                    <input
                      id="totalsStore"
                      type="text"
                      value={totalsStore}
                      onChange={(e) => setTotalsStore(e.target.value)}
                      placeholder="e.g. Trader Joe's"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-black outline-none ring-0 transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                    />
                  </div>
                </div>
              </div>
              {expenses.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No expenses yet. Add an expense to see totals.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-black dark:text-zinc-500">
                      Total spent
                    </span>
                    <span className="text-2xl font-semibold tabular-nums text-black dark:text-zinc-50">
                      ${total.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-2 space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      By type
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      Click a type to see those expenses below. Click again to
                      show all.
                    </p>
                    <ul className="space-y-1.5 text-sm">
                      {byType.map((row, index) => {
                        const percentage =
                          total > 0 ? (row.amount / total) * 100 : 0;
                        const selected =
                          totalsCategoryTypeFilter === row.type;
                        return (
                          <li key={row.type} className="flex items-center">
                            <button
                              type="button"
                              onClick={() =>
                                toggleTotalsCategoryFilter(row.type)
                              }
                              className={`flex w-full items-center justify-between gap-3 rounded-lg border px-2 py-1.5 text-left transition ${
                                selected
                                  ? "border-zinc-400 bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-800/80"
                                  : "border-transparent hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor:
                                      PIE_COLORS[index % PIE_COLORS.length],
                                  }}
                                />
                                <span className="text-zinc-700 dark:text-zinc-200">
                                  {row.type}
                                </span>
                              </div>
                              <div className="flex items-baseline gap-3 text-xs text-zinc-500">
                                <span className="tabular-nums">
                                  ${row.amount.toFixed(2)}
                                </span>
                                <span className="tabular-nums">
                                  {percentage.toFixed(1)}%
                                </span>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Expenses for this month
                      </h3>
                      {totalsCategoryTypeFilter ? (
                        <button
                          type="button"
                          onClick={() => setTotalsCategoryTypeFilter(null)}
                          className="text-[11px] font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                        >
                          Clear type filter
                        </button>
                      ) : null}
                    </div>
                    {totalsCategoryTypeFilter ? (
                      <p className="text-[11px] text-zinc-500">
                        Showing{" "}
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {totalsCategoryTypeFilter}
                        </span>{" "}
                        only.
                      </p>
                    ) : null}
                    {filteredMonthExpenses.length === 0 ? (
                      <p className="text-xs text-zinc-500">
                        No expenses match this store filter for the selected month.
                      </p>
                    ) : totalsListExpenses.length === 0 ? (
                      <p className="text-xs text-zinc-500">
                        No expenses in this category for the current filters.
                      </p>
                    ) : (
                      <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50 p-2 text-xs text-black dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-200">
                        {totalsListExpenses.map((exp) => (
                          <li
                            key={exp.id}
                            className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1 hover:bg-zinc-100/80 dark:hover:bg-zinc-900/60"
                          >
                            <div className="flex flex-col">
                              <span className="text-[11px] text-zinc-500">
                                {formatExpenseWhen(exp.createdAt)}
                              </span>
                              <span className="text-xs font-medium">
                                {exp.store}
                              </span>
                              <span className="text-[11px] text-zinc-500">
                                {exp.type} — {exp.description}
                              </span>
                            </div>
                            <span className="text-xs font-semibold tabular-nums">
                              ${Number(exp.price).toFixed(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
              {expenses.length === 0 || total === 0 ? (
                <p className="text-sm text-zinc-500">
                  Add expenses to see a breakdown by type.
                </p>
              ) : (
                <PieChart
                  byType={byType}
                  interactiveLegend
                  selectedLegendType={totalsCategoryTypeFilter}
                  onLegendTypeClick={toggleTotalsCategoryFilter}
                />
              )}
            </div>
          </section>
        ) : activeTab === "yearly" ? (
          <section className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-sm font-medium uppercase tracking-wide text-black dark:text-zinc-500">
                    Yearly Breakdown
                  </h2>
                  <p className="text-xs text-black dark:text-zinc-400">
                    Totals by category for calendar year{" "}
                    <span className="font-medium">
                      {formatYearLabel(yearlyYear)}
                    </span>
                    {yearlyStore.trim()
                      ? ` (stores matching "${yearlyStore.trim()}")`
                      : ""}
                    .
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label
                      htmlFor="yearlyYear"
                      className="block text-[11px] font-medium uppercase tracking-wide text-black dark:text-zinc-500"
                    >
                      Year
                    </label>
                    <select
                      id="yearlyYear"
                      value={yearlyYear}
                      onChange={(e) => setYearlyYear(e.target.value)}
                      className="w-full min-w-[8rem] rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-black outline-none ring-0 transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-800 sm:w-40"
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={String(y)}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="yearlyStore"
                      className="block text-[11px] font-medium uppercase tracking-wide text-black dark:text-zinc-500"
                    >
                      Store filter (year)
                    </label>
                    <input
                      id="yearlyStore"
                      type="text"
                      value={yearlyStore}
                      onChange={(e) => setYearlyStore(e.target.value)}
                      placeholder="e.g. Trader Joe's"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-black outline-none ring-0 transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                    />
                  </div>
                </div>
              </div>
              {expenses.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No expenses yet. Add an expense to see a yearly breakdown.
                </p>
              ) : yearExpensesForYear.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No expenses in {formatYearLabel(yearlyYear)} yet.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-black dark:text-zinc-500">
                      Total spent (filtered)
                    </span>
                    <span className="text-2xl font-semibold tabular-nums text-black dark:text-zinc-50">
                      ${yearlyTotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-2 space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      By category
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      Click a category to show only those expenses below. Click
                      again to show all.
                    </p>
                    <ul className="space-y-1.5 text-sm">
                      {yearlyByType.map((row, index) => {
                        const percentage =
                          yearlyTotal > 0
                            ? (row.amount / yearlyTotal) * 100
                            : 0;
                        const selected =
                          yearlyCategoryTypeFilter === row.type;
                        return (
                          <li key={row.type} className="flex items-center">
                            <button
                              type="button"
                              onClick={() =>
                                toggleYearlyCategoryFilter(row.type)
                              }
                              className={`flex w-full items-center justify-between gap-3 rounded-lg border px-2 py-1.5 text-left transition ${
                                selected
                                  ? "border-zinc-400 bg-zinc-100 dark:border-zinc-500 dark:bg-zinc-800/80"
                                  : "border-transparent hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor:
                                      PIE_COLORS[index % PIE_COLORS.length],
                                  }}
                                />
                                <span className="text-zinc-700 dark:text-zinc-200">
                                  {row.type}
                                </span>
                              </div>
                              <div className="flex items-baseline gap-3 text-xs text-zinc-500">
                                <span className="tabular-nums">
                                  ${row.amount.toFixed(2)}
                                </span>
                                <span className="tabular-nums">
                                  {percentage.toFixed(1)}%
                                </span>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Expenses for this year
                      </h3>
                      {yearlyCategoryTypeFilter ? (
                        <button
                          type="button"
                          onClick={() => setYearlyCategoryTypeFilter(null)}
                          className="text-[11px] font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                        >
                          Clear category filter
                        </button>
                      ) : null}
                    </div>
                    {yearlyCategoryTypeFilter ? (
                      <p className="text-[11px] text-zinc-500">
                        Showing{" "}
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {yearlyCategoryTypeFilter}
                        </span>{" "}
                        only.
                      </p>
                    ) : null}
                    {filteredYearExpenses.length === 0 ? (
                      <p className="text-xs text-zinc-500">
                        No expenses match this store filter for the selected
                        year.
                      </p>
                    ) : yearlyListExpenses.length === 0 ? (
                      <p className="text-xs text-zinc-500">
                        No expenses in this category for the current filters.
                      </p>
                    ) : (
                      <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50 p-2 text-xs text-black dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-200">
                        {yearlyListExpenses.map((exp) => (
                          <li
                            key={exp.id}
                            className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1 hover:bg-zinc-100/80 dark:hover:bg-zinc-900/60"
                          >
                            <div className="flex flex-col">
                              <span className="text-[11px] text-zinc-500">
                                {formatExpenseWhen(exp.createdAt)}
                              </span>
                              <span className="text-xs font-medium">
                                {exp.store}
                              </span>
                              <span className="text-[11px] text-zinc-500">
                                {exp.type} — {exp.description}
                              </span>
                            </div>
                            <span className="text-xs font-semibold tabular-nums">
                              ${Number(exp.price).toFixed(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
              {expenses.length === 0 ||
              yearExpensesForYear.length === 0 ||
              yearlyTotal === 0 ? (
                <p className="text-sm text-zinc-500">
                  {expenses.length === 0
                    ? "Add expenses to see a yearly breakdown by category."
                    : yearExpensesForYear.length === 0
                      ? "No expenses in this year to chart."
                      : "No expenses match the current filters for the chart."}
                </p>
              ) : (
                <PieChart
                  byType={yearlyByType}
                  interactiveLegend
                  selectedLegendType={yearlyCategoryTypeFilter}
                  onLegendTypeClick={toggleYearlyCategoryFilter}
                />
              )}
            </div>
          </section>
        ) : activeTab === "budget" ? (
          <BudgetSection budgets={budgets} />
        ) : (
          <CompareSection expenses={expenses} budgets={budgets} />
        )}
      </div>
    </div>
  );
}

function ExpensesList({
  expenses,
  selectedExpenseId,
  onSelect,
}: {
  expenses: ExpenseEntity[];
  selectedExpenseId?: string | null;
  onSelect?: (expense: ExpenseEntity) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.25fr)] gap-3 border-b border-zinc-100 bg-zinc-100/60 px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
        <span>Date</span>
        <span>Expense</span>
        <span>Store</span>
        <span className="text-right">Price</span>
      </div>
      <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-900/70">
        {expenses.map((expense) => (
          <li
            key={expense.id}
            className={`grid cursor-pointer grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.25fr)] gap-3 px-4 py-2.5 hover:bg-zinc-100/70 dark:hover:bg-zinc-900/60 ${
              selectedExpenseId === expense.id
                ? "bg-zinc-200/60 dark:bg-zinc-800/80"
                : ""
            }`}
            onClick={() => onSelect?.(expense)}
          >
            <span className="truncate text-xs text-zinc-500">
              {formatExpenseWhen(expense.createdAt)}
            </span>
            <div className="flex flex-col">
              <span className="truncate font-medium text-black dark:text-zinc-50">
                {expense.type}
              </span>
              <span className="truncate text-xs text-zinc-500">
                {expense.description}
              </span>
            </div>
            <span className="truncate text-sm text-zinc-600 dark:text-zinc-300">
              {expense.store}
            </span>
            <span className="text-right text-sm font-semibold tabular-nums text-black dark:text-zinc-200">
              ${expense.price.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExpenseDetails({
  expense,
  onDeleted,
  onClose,
}: {
  expense: ExpenseEntity;
  onDeleted?: () => void;
  onClose?: () => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editType, setEditType] = useState(expense.type);
  const [editStore, setEditStore] = useState(expense.store);
  const [editPrice, setEditPrice] = useState(String(expense.price));
  const [editDescription, setEditDescription] = useState(expense.description);
  const [editDate, setEditDate] = useState(() =>
    timestampToLocalYmd(expense.createdAt),
  );
  const [editTime, setEditTime] = useState(() =>
    timestampToLocalHm(expense.createdAt),
  );
  const [editIncludeTime, setEditIncludeTime] = useState(
    () => !isLocalMidnight(expense.createdAt),
  );

  function openEditMode() {
    setEditType(expense.type);
    setEditStore(expense.store);
    setEditPrice(String(expense.price));
    setEditDescription(expense.description);
    setEditDate(timestampToLocalYmd(expense.createdAt));
    setEditTime(timestampToLocalHm(expense.createdAt));
    setEditIncludeTime(!isLocalMidnight(expense.createdAt));
    setError(null);
    setIsEditing(true);
  }

  async function handleReceiptChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsUploading(true);
    try {
      const storage: any = (db as any).storage;
      const res = await storage.uploadFile(file);
      const url =
        (res && (res.url || res.signedUrl || res.publicUrl)) || "";

      await db.transact(
        db.tx.expenses[expense.id].update({
          receiptUrl: url,
        }),
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to upload receipt.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const numericPrice = Number(editPrice);
    if (
      !editType.trim() ||
      !editStore.trim() ||
      !editDescription.trim() ||
      !editDate ||
      (editIncludeTime && !editTime) ||
      Number.isNaN(numericPrice) ||
      numericPrice <= 0
    ) {
      setError("Fill all fields and use a positive price.");
      return;
    }
    const createdAt = editIncludeTime
      ? (parseLocalDateTimeYmdHm(editDate, editTime) ?? expense.createdAt)
      : (parseLocalDateYmd(editDate) ?? expense.createdAt);
    setIsSaving(true);
    try {
      await db.transact(
        db.tx.expenses[expense.id].update({
          type: editType.trim(),
          store: editStore.trim(),
          price: numericPrice,
          description: editDescription.trim(),
          createdAt,
        }),
      );
      setIsEditing(false);
    } catch (err: any) {
      setError(err?.message ?? "Failed to update expense.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditType(expense.type);
    setEditStore(expense.store);
    setEditPrice(String(expense.price));
    setEditDescription(expense.description);
    setEditDate(timestampToLocalYmd(expense.createdAt));
    setEditTime(timestampToLocalHm(expense.createdAt));
    setEditIncludeTime(!isLocalMidnight(expense.createdAt));
    setIsEditing(false);
    setError(null);
  }

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete this expense? This cannot be undone.",
      )
    ) {
      return;
    }
    setError(null);
    setIsDeleting(true);
    try {
      await db.transact(db.tx.expenses[expense.id].delete());
      onDeleted?.();
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete expense.");
    } finally {
      setIsDeleting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-black outline-none ring-0 transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-800";

  return (
    <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Expense details
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Close
            </button>
          ) : null}
          {!isEditing ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openEditMode}
              disabled={isDeleting}
              className="rounded-lg border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-800 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/70"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        ) : null}
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleSaveEdit} className="space-y-3">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
              Expense type
            </label>
            <input
              type="text"
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
              Store
            </label>
            <input
              type="text"
              value={editStore}
              onChange={(e) => setEditStore(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                Date
              </label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <label
              htmlFor="edit-include-time"
              className="flex cursor-pointer items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300"
            >
              <input
                id="edit-include-time"
                type="checkbox"
                checked={editIncludeTime}
                onChange={(e) => {
                  const on = e.target.checked;
                  setEditIncludeTime(on);
                  if (on) {
                    setEditTime(
                      !isLocalMidnight(expense.createdAt)
                        ? timestampToLocalHm(expense.createdAt)
                        : localTimeHm(),
                    );
                  }
                }}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:ring-zinc-600"
              />
              <span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Include time of transaction
                </span>
                <span className="mt-0.5 block text-[11px] font-normal text-zinc-500">
                  Same as when recording: leave off to save only the date; turn
                  on to set when the purchase happened.
                </span>
              </span>
            </label>
            {editIncludeTime ? (
              <div className="space-y-1">
                <label
                  htmlFor="edit-time"
                  className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400"
                >
                  Time
                </label>
                <input
                  id="edit-time"
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  step={60}
                  className={inputClass}
                />
              </div>
            ) : null}
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
              Price
            </label>
            <div className="flex items-center rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-within:border-zinc-500 dark:focus-within:ring-zinc-800">
              <span className="mr-1 text-zinc-500">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="w-full border-none bg-transparent text-black outline-none dark:text-zinc-50"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
              Notes
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isSaving || isDeleting}
              className="flex-1 rounded-lg border border-zinc-300 py-1.5 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isDeleting}
              className="flex-1 rounded-lg bg-zinc-900 py-1.5 text-[11px] font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
          <div className="border-t border-zinc-200 pt-3 dark:border-zinc-700">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSaving || isDeleting}
              className="w-full rounded-lg border border-red-200 bg-red-50 py-1.5 text-[11px] font-medium text-red-800 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/70"
            >
              {isDeleting ? "Deleting..." : "Delete expense"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{expense.type}</span>
              <span className="text-[11px] text-zinc-500">
                {formatExpenseWhen(expense.createdAt)}
              </span>
            </div>
            <span className="text-sm font-semibold tabular-nums">
              ${Number(expense.price).toFixed(2)}
            </span>
          </div>
          <div className="mb-3 space-y-1.5">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">
              Store
            </div>
            <div className="text-xs">{expense.store}</div>
          </div>
          <div className="mb-3 space-y-1.5">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">
              Notes
            </div>
            <div className="whitespace-pre-wrap text-xs">
              {expense.description || "No notes added."}
            </div>
          </div>
        </>
      )}

      <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
        <div className="text-[11px] uppercase tracking-wide text-zinc-500">
          Receipt
        </div>
        {expense.receiptUrl ? (
          <a
            href={expense.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-zinc-50"
          >
            View current receipt
          </a>
        ) : (
          <p className="text-[11px] text-zinc-500">
            No receipt uploaded yet.
          </p>
        )}
        {error && !isEditing && (
          <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-[11px] text-zinc-600 hover:border-zinc-400 hover:bg-zinc-100/70 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-900/60">
          <span>{isUploading ? "Uploading..." : "Upload receipt"}</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleReceiptChange}
            disabled={isUploading}
          />
        </label>
      </div>
    </div>
  );
}

function PieChart({
  byType,
  interactiveLegend,
  selectedLegendType,
  onLegendTypeClick,
}: {
  byType: { type: string; amount: number }[];
  interactiveLegend?: boolean;
  selectedLegendType?: string | null;
  onLegendTypeClick?: (type: string) => void;
}) {
  const total = byType.reduce((sum, row) => sum + row.amount, 0);
  if (total <= 0) {
    return null;
  }

  const radius = 70;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox="0 0 200 200"
        className="h-48 w-48 -rotate-90 text-zinc-200 dark:text-zinc-800"
      >
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="24"
        />
        {byType.map((row, index) => {
          const fraction = row.amount / total;
          const dash = fraction * circumference;
          const gap = circumference - dash;
          const strokeDasharray = `${dash} ${gap}`;
          const strokeDashoffset = -cumulative * circumference;
          cumulative += fraction;

          return (
            <circle
              key={row.type}
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={PIE_COLORS[index % PIE_COLORS.length]}
              strokeWidth="24"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
            />
          );
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-2 text-[11px]">
        {byType.map((row, index) => {
          const percentage = (row.amount / total) * 100;
          const selected = selectedLegendType === row.type;
          const baseClass =
            "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-black dark:text-zinc-100";
          const staticClass = interactiveLegend
            ? ""
            : "bg-zinc-100 dark:bg-zinc-800";
          const interactiveClass = interactiveLegend
            ? selected
              ? "border border-zinc-400 bg-zinc-100 ring-1 ring-zinc-300 dark:border-zinc-500 dark:bg-zinc-800 dark:ring-zinc-600"
              : "border border-transparent bg-zinc-100 hover:bg-zinc-200/90 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            : "";

          const inner = (
            <>
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                }}
              />
              <span>{row.type}</span>
              <span className="tabular-nums text-zinc-500 dark:text-zinc-300">
                {percentage.toFixed(1)}%
              </span>
            </>
          );

          if (interactiveLegend && onLegendTypeClick) {
            return (
              <button
                key={row.type}
                type="button"
                onClick={() => onLegendTypeClick(row.type)}
                className={`${baseClass} ${interactiveClass} cursor-pointer transition`}
              >
                {inner}
              </button>
            );
          }

          return (
            <div key={row.type} className={`${baseClass} ${staticClass}`}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BudgetSection({ budgets }: { budgets: BudgetEntity[] }) {
  const user = db.useUser();
  const userId = user?.id;
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [type, setType] = useState("");
  const [month, setMonth] = useState(() => localYearMonthNow());
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  // When month or user changes, defer to server data for that month
  useEffect(() => {
    setEntries([]);
  }, [month, userId]);

  const monthBudgets = budgets
    .filter((b) => b.month === month)
    .map((b) => ({
      id: b.id,
      type: b.type,
      month: b.month,
      amount: Number(b.amount) || 0,
    }));

  const effectiveEntries =
    entries.length > 0 ? entries : monthBudgets;

  const totalBudget = effectiveEntries.reduce((sum, e) => sum + e.amount, 0);

  const byType = useMemo(
    () =>
      Object.values(
        effectiveEntries.reduce<Record<string, { type: string; amount: number }>>(
          (acc, entry) => {
            const key = entry.type.trim() || "Uncategorized";
            if (!acc[key]) {
              acc[key] = { type: key, amount: 0 };
            }
            acc[key].amount += entry.amount;
            return acc;
          },
          {},
        ),
      ),
    [effectiveEntries],
  );

  async function handleAddBudget(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const numericAmount = Number(amount);
    if (
      !type ||
      !month ||
      !amount ||
      Number.isNaN(numericAmount) ||
      numericAmount <= 0
    ) {
      setError("Please enter a type, month, and positive budget amount.");
      return;
    }

    try {
      if (!userId) {
        setError("You must be signed in to save a budget.");
        return;
      }

      await db.transact(
        db.tx.budgets[id()]
          .update({
            type: type.trim(),
            month,
            amount: numericAmount,
            createdAt: Date.now(),
          })
          .link({ owner: userId }),
      );

      setAmount("");
      setEntries([]); // let fresh data come from Instant
    } catch (err: any) {
      setError(err?.message ?? "Failed to save budget.");
    }
  }

  return (
    <section className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Budget planner
        </h2>
        <p className="mb-4 text-xs text-zinc-500">
          Set a monthly budget per expense type. Budgets are stored locally in
          this browser.
        </p>
        <form onSubmit={handleAddBudget} className="space-y-3">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="budgetType"
                className="block text-xs font-medium text-black dark:text-zinc-300"
              >
                Category type
              </label>
              <input
                id="budgetType"
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="Groceries, Rent, etc."
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-black outline-none ring-0 transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="budgetMonth"
                className="block text-xs font-medium text-black dark:text-zinc-300"
              >
                Month
              </label>
              <input
                id="budgetMonth"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-black outline-none ring-0 transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="budgetAmount"
              className="block text-xs font-medium text-black dark:text-zinc-300"
            >
              Amount
            </label>
            <div className="flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-within:border-zinc-500 dark:focus-within:ring-zinc-800">
              <span className="mr-1 text-xs text-zinc-500">$</span>
              <input
                id="budgetAmount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border-none bg-transparent text-sm text-black outline-none ring-0"
              />
            </div>
          </div>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-50 transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Add budget
          </button>
        </form>

        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="block text-sm text-zinc-500">
                Total monthly budget (
                {formatMonthLabel(month, { emptyLabel: "Select month" })})
              </span>
              <span className="text-xl font-semibold tabular-nums text-black dark:text-zinc-50">
                ${totalBudget.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {byType.map((row, index) => (
                <div
                  key={row.type}
                  className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-black dark:bg-zinc-900 dark:text-zinc-300"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                    }}
                  />
                  <span>{row.type}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50 text-xs text-black dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-200">
            {effectiveEntries.length === 0 ? (
              <p className="px-3 py-2 text-zinc-500">
                No budgets for this month yet. Add one above.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-900/70">
                {effectiveEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            PIE_COLORS[
                              Math.max(
                                0,
                                byType.findIndex(
                                  (row) => row.type === entry.type.trim(),
                                ),
                              ) % PIE_COLORS.length
                            ],
                        }}
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                          {entry.type}
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          {entry.month}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                      ${entry.amount.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        {byType.length === 0 || totalBudget === 0 ? (
          <p className="text-sm text-zinc-500">
            Add budgets to see a breakdown by category.
          </p>
        ) : (
          <PieChart byType={byType} />
        )}
      </div>
    </section>
  );
}

function CompareSection({
  expenses,
  budgets,
}: {
  expenses: ExpenseEntity[];
  budgets: BudgetEntity[];
}) {
  const [month, setMonth] = useState(() => localYearMonthNow());

  const monthExpenses = useMemo(
    () =>
      expenses.filter((exp) => {
        const key = yearMonthFromTimestamp(exp.createdAt);
        return key === month;
      }),
    [expenses, month],
  );

  const monthBudgets = useMemo(
    () => budgets.filter((b) => b.month === month),
    [budgets, month],
  );

  type Row = {
    type: string;
    spent: number;
    budget: number;
  };

  const rows: Row[] = useMemo(() => {
    const spentByType = new Map<string, number>();
    for (const exp of monthExpenses) {
      const key = (exp.type || "Uncategorized").trim() || "Uncategorized";
      const prev = spentByType.get(key) ?? 0;
      spentByType.set(key, prev + (Number(exp.price) || 0));
    }

    const budgetByType = new Map<string, number>();
    for (const b of monthBudgets) {
      const key = (b.type || "Uncategorized").trim() || "Uncategorized";
      const prev = budgetByType.get(key) ?? 0;
      budgetByType.set(key, prev + (Number(b.amount) || 0));
    }

    const allTypes = new Set<string>([
      ...spentByType.keys(),
      ...budgetByType.keys(),
    ]);

    return Array.from(allTypes).map((type) => ({
      type,
      spent: spentByType.get(type) ?? 0,
      budget: budgetByType.get(type) ?? 0,
    }));
  }, [monthExpenses, monthBudgets]);

  const totalSpent = rows.reduce((sum, r) => sum + r.spent, 0);
  const totalBudget = rows.reduce((sum, r) => sum + r.budget, 0);

  const spentByType = rows.map((r) => ({ type: r.type, amount: r.spent }));
  const budgetByType = rows.map((r) => ({ type: r.type, amount: r.budget }));

  return (
    <section className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wide text-black dark:text-zinc-500">
              Expenses vs Budget
            </h2>
            <p className="text-xs text-black dark:text-zinc-400">
              Comparing for{" "}
              <span className="font-medium">
                {formatMonthLabel(month, { emptyLabel: "Select month" })}
              </span>
              .
            </p>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="compareMonth"
              className="block text-[11px] font-medium uppercase tracking-wide text-black dark:text-zinc-500"
            >
              Month
            </label>
            <input
              id="compareMonth"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-40 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-black outline-none ring-0 transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No expenses or budgets for this month yet.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="text-zinc-500">Total spent</div>
                <div className="text-lg font-semibold tabular-nums text-black dark:text-zinc-50">
                  ${totalSpent.toFixed(2)}
                </div>
              </div>
              <div className="space-y-0.5 text-right">
                <div className="text-zinc-500">Total budget</div>
                <div className="text-lg font-semibold tabular-nums text-black dark:text-zinc-50">
                  ${totalBudget.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50 text-xs text-black dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-200">
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-zinc-100 bg-zinc-100/60 px-4 py-2 font-medium uppercase tracking-wide text-[10px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60">
                <span>Type</span>
                <span className="text-right">Spent</span>
                <span className="text-right">Budget</span>
                <span className="text-right">Diff</span>
              </div>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-900/70">
                {rows.map((row) => {
                  const diff = row.spent - row.budget;
                  const over = diff > 0;
                  return (
                    <li
                      key={row.type}
                      className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-4 py-2.5"
                    >
                      <span className="truncate font-medium">{row.type}</span>
                      <span className="text-right tabular-nums">
                        ${row.spent.toFixed(2)}
                      </span>
                      <span className="text-right tabular-nums">
                        ${row.budget.toFixed(2)}
                      </span>
                      <span
                        className={`text-right tabular-nums ${
                          over
                            ? "text-red-600 dark:text-red-400"
                            : "text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {over ? "+" : ""}
                        {diff.toFixed(2)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white/80 p-6 text-xs text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300">
        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide">
                Expenses by type
              </p>
              {totalSpent === 0 ? (
                <p className="text-xs text-zinc-500">
                  No expenses recorded for this month yet.
                </p>
              ) : (
                <PieChart byType={spentByType} />
              )}
            </div>
            {totalSpent > 0 && (
              <p className="text-[11px] font-medium text-zinc-700 dark:text-zinc-200">
                Total spent:{" "}
                <span className="tabular-nums">
                  ${totalSpent.toFixed(2)}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide">
                Budget by type
              </p>
              {totalBudget === 0 ? (
                <p className="text-xs text-zinc-500">
                  No budgets set for this month yet.
                </p>
              ) : (
                <PieChart byType={budgetByType} />
              )}
            </div>
            {totalBudget > 0 && (
              <p className="text-[11px] font-medium text-zinc-700 dark:text-zinc-200">
                Total budgeted:{" "}
                <span className="tabular-nums">
                  ${totalBudget.toFixed(2)}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-2 space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide">
            How this works
          </p>
          <p className="text-xs">
            For the selected month, we sum all recorded expenses by type and
            compare them to the budgets you&apos;ve set. The table shows the
            numeric difference, while the pies show relative distribution.
          </p>
        </div>
      </div>
    </section>
  );
}
