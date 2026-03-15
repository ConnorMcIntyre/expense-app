'use client';

import { useState } from "react";
import type { ReactNode, FormEvent } from "react";
import db from "@/lib/db";

type Step = "email" | "code";

export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, user, error } = db.useAuth();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-sm text-zinc-500">Loading ExpenseBetter...</p>
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  const displayError = localError || error?.message;

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await db.auth.sendMagicCode({ email });
      setStep("code");
    } catch (err: any) {
      setLocalError(err?.message ?? "Failed to send magic code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await db.auth.signInWithMagicCode({ email, code });
    } catch (err: any) {
      setLocalError(err?.message ?? "Failed to verify magic code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white/80 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          ExpenseBetter
        </h1>
        <p className="mb-6 text-sm text-zinc-500">
          Track your spending with simple, passwordless sign-in.
        </p>

        {displayError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {displayError}
          </div>
        )}

        {step === "email" && (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-black outline-none ring-0 transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-50 transition hover:bg-zinc-800 disabled:opacity-60 disabled:hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {isSubmitting ? "Sending code..." : "Send magic code"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="code"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-200"
              >
                Verification Code
              </label>
              <input
                id="code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm tracking-[0.35em] text-black outline-none ring-0 transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                placeholder="• • • • • •"
              />
              <p className="text-xs text-zinc-500">
                Enter the code sent to <span className="font-medium">{email}</span>.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("email")}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-50 transition hover:bg-zinc-800 disabled:opacity-60 disabled:hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

