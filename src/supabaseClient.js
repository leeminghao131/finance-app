import { createClient } from "@supabase/supabase-js";
import { classifyFinanceSupabaseTarget } from "./financeSupabaseTarget.js";

// RELEASE-CANDIDATE FAIL-CLOSED ROUTING:
// Vercel Production build + original Production hostname -> Production Supabase only.
// Vercel Preview/local development -> independent TEST Supabase only.
// Any mismatched URL/hostname/build tier -> no Supabase connection.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const deploymentTier =
  typeof __MH_VERCEL_ENV__ === "string" ? __MH_VERCEL_ENV__ : "unknown";
const browserHostname =
  typeof window !== "undefined" ? window.location.hostname : "";

export const supabaseTarget = classifyFinanceSupabaseTarget({
  vercelEnvironment: deploymentTier,
  hostname: browserHostname,
  supabaseUrl,
  hasAnonKey: Boolean(supabaseAnonKey),
});

export const isTestEnvironment = supabaseTarget === "test";
export const isProductionEnvironment = supabaseTarget === "production";
export const hasSupabaseEnv = supabaseTarget !== null;
export const supabase = hasSupabaseEnv
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
