'use client';

import { useState } from "react";
import db from "@/lib/db";
import { id } from "@instantdb/react";
import { localTodayYmd, parseLocalDateYmd } from "@/lib/dateUtils";

export function ExpenseForm() {
  const user = db.useUser();
  const [type, setType] = useState("");
  const [store, setStore] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => localTodayYmd());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const numericPrice = Number(price);
    if (
      !type ||
      !store ||
      !description ||
      !price ||
      !date ||
      Number.isNaN(numericPrice) ||
      numericPrice <= 0
    ) {
      setError("Please fill all fields, choose a date, and use a positive price.");
      return;
    }

    const createdAt = parseLocalDateYmd(date) ?? Date.now();

    setIsSubmitting(true);
    try {
      await db.transact(
        db.tx.expenses[id()]
          .update({
            type,
            store,
            price: numericPrice,
            description,
            createdAt,
          })
          .link({ owner: user.id })
      );

      setType("");
      setStore("");
      setPrice("");
      setDescription("");
      setDate(localTodayYmd());
    } catch (err: any) {
      setError(err?.message ?? "Failed to save expense.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor="type"
            className="block text-xs font-medium text-zinc-600 dark:text-zinc-300"
          >
            Expense type
          </label>
          <input
            id="type"
            type="text"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="Groceries, Travel, etc."
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-black outline-none ring-0 transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="store"
            className="block text-xs font-medium text-zinc-600 dark:text-zinc-300"
          >
            Store
          </label>
          <input
            id="store"
            type="text"
            value={store}
            onChange={(e) => setStore(e.target.value)}
            placeholder="Trader Joe's, Uber, etc."
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-black outline-none ring-0 transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="date"
          className="block text-xs font-medium text-zinc-600 dark:text-zinc-300"
        >
          Date
        </label>
        <input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-black outline-none ring-0 transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
        />
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="price"
          className="block text-xs font-medium text-zinc-600 dark:text-zinc-300"
        >
          Price
        </label>
        <div className="flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-within:border-zinc-500 dark:focus-within:ring-zinc-800">
          <span className="mr-1 text-xs text-zinc-500">$</span>
          <input
            id="price"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            className="w-full border-none bg-transparent text-sm text-black outline-none ring-0"
          />
        </div>
        <p className="text-[11px] text-zinc-400">
          Stored as a number in your default currency (no automatic conversion).
        </p>
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="description"
          className="block text-xs font-medium text-zinc-600 dark:text-zinc-300"
        >
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What did you buy?"
          className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-black outline-none ring-0 transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-50 transition hover:bg-zinc-800 disabled:opacity-60 disabled:hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        {isSubmitting ? "Saving..." : "Save expense"}
      </button>
    </form>
  );
}

