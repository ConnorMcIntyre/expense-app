'use client';

import { AuthGate } from "./components/AuthGate";
import { ExpensesDashboard } from "./components/ExpensesDashboard";

export default function Home() {
  return (
    <AuthGate>
      <ExpensesDashboard />
    </AuthGate>
  );
}

