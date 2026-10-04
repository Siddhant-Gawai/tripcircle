import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
  throw new Error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for this server-side script only.",
  );
const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const destinations = JSON.parse(
  await readFile(
    new URL("../supabase/destinations.json", import.meta.url),
    "utf8",
  ),
);
const details = JSON.parse(
  await readFile(
    new URL("../supabase/page-details.json", import.meta.url),
    "utf8",
  ),
);
const { error } = await client
  .from("tripcircle_destinations")
  .upsert(destinations.map((d) => ({ ...d, details: details[d.id] })));
if (error) throw error;
console.log("TripCircle catalogue saved.");
