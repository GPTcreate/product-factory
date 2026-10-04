// Type-only bridge for Node fixture tests of Deno adapters. Production Edge
// functions are independently checked using `deno check` with real Deno types.
declare const Deno: { env: { get(name: string): string | undefined } };
declare module "npm:@supabase/supabase-js@2" {
  export { createClient } from "@supabase/supabase-js";
  export type { SupabaseClient } from "@supabase/supabase-js";
}
