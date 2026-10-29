import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_URL, SUPABASE_ANON, hayBackend } from "./config";
export { SUPABASE_URL, SUPABASE_ANON, hayBackend } from "./config";

let cliente: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!hayBackend) throw new Error("Supabase no está configurado (.env.local)");
  if (!cliente) cliente = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON!);
  return cliente;
}
