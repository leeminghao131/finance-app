import { createClient } from "@supabase/supabase-js";

// FEATURE-BRANCH FAIL-CLOSED GUARD.
// Never connect this unapproved test build to the live finance database.
// Remove/review this exact guard only during the owner's explicitly approved production release.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SANDBOX_PROJECT_ID = "qrkaxxdwqgffhkalvtby";
const requiredSandboxUrl = "https://" + SANDBOX_PROJECT_ID + ".supabase.co";
export const isTestEnvironment = supabaseUrl === requiredSandboxUrl;
export const hasSupabaseEnv = Boolean(isTestEnvironment && supabaseAnonKey);
export const supabase = hasSupabaseEnv ? createClient(supabaseUrl, supabaseAnonKey) : null;
