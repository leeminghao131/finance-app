import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Vercel deployment tier is injected at BUILD time; Preview cannot impersonate Production.
  define: {
    __MH_VERCEL_ENV__: JSON.stringify(process.env.VERCEL_ENV || "development"),
  },
});
