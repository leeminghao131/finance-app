// PR82 RELEASE CANDIDATE -- environment target allowlist only, no database writes.
// Production is allowed ONLY on the original canonical Production hostname and
// ONLY when Vercel explicitly built the bundle for the Production environment.
// Preview and local development are constrained to the independent TEST project.
export const FINANCE_TEST_PROJECT_URL = "https://qrkaxxdwqgffhkalvtby.supabase.co";
export const FINANCE_PRODUCTION_PROJECT_URL = "https://hlkciowyusbhwcwjzfsr.supabase.co";
export const FINANCE_CANONICAL_PRODUCTION_HOST = "finance-app-ivory-theta.vercel.app";

export function classifyFinanceSupabaseTarget({
  vercelEnvironment,
  hostname,
  supabaseUrl,
  hasAnonKey,
}) {
  if (!hasAnonKey || typeof supabaseUrl !== "string") return null;
  const host = typeof hostname === "string" ? hostname.trim().toLowerCase() : "";
  // Fail closed if Vercel Environment is missing, invalid, or misreported.
  if (vercelEnvironment === "production") {
    return host === FINANCE_CANONICAL_PRODUCTION_HOST &&
      supabaseUrl === FINANCE_PRODUCTION_PROJECT_URL
      ? "production"
      : null;
  }
  if (vercelEnvironment === "preview" || vercelEnvironment === "development") {
    // Never accept a TEST-only bundle on the actual Production hostname.
    return host !== FINANCE_CANONICAL_PRODUCTION_HOST &&
      supabaseUrl === FINANCE_TEST_PROJECT_URL
      ? "test"
      : null;
  }
  return null;
}
