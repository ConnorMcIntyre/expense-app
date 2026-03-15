import { init } from "@instantdb/react";
import schema from "../instant.schema";

// Prefer env var, but fall back to the provided app ID so the client
// always has a valid appId and doesn't crash on init.
const APP_ID =
  process.env.NEXT_PUBLIC_INSTANT_APP_ID ??
  "3b091a0a-a45e-48d2-a187-ecd73afd6ac8";

if (!APP_ID) {
  console.error("InstantDB APP_ID is missing.");
}

const db = init({ appId: APP_ID, schema });

export default db;

