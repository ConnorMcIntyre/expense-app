import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
    }),
    profiles: i.entity({
      handle: i.string(),
      displayName: i.string().optional(),
    }),
    expenses: i.entity({
      type: i.string(),
      store: i.string(),
      price: i.number(),
      description: i.string(),
      createdAt: i.number().indexed(),
      receiptUrl: i.string().optional(),
    }),
    budgets: i.entity({
      type: i.string(),
      month: i.string(), // YYYY-MM
      amount: i.number(),
      createdAt: i.number().indexed(),
    }),
  },
  links: {
    userProfiles: {
      forward: { on: "profiles", has: "one", label: "user" },
      reverse: { on: "$users", has: "one", label: "profile" },
    },
    userExpenses: {
      forward: { on: "expenses", has: "one", label: "owner" },
      reverse: { on: "$users", has: "many", label: "expenses" },
    },
    userBudgets: {
      forward: { on: "budgets", has: "one", label: "owner" },
      reverse: { on: "$users", has: "many", label: "budgets" },
    },
  },
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;

