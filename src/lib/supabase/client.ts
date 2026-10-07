import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Públicos por diseño: la publishable key viaja al navegador de todos modos.
// Lo que protege los datos son las políticas RLS y las RPC de la base.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://qhbvhefrcijtnaurnoxn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_ygqTATu8Y3huU4HoIMcXWg_TEkpIgJv";

let client: SupabaseClient<Database> | null = null;

/** Cliente del navegador. La sesión anónima queda guardada en localStorage. */
export function supabase(): SupabaseClient<Database> {
  client ??= createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return client;
}
