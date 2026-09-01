import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    allowedHosts: ['der-presenting-sunrise-queens.trycloudflare.com', 'addressinsights.debarv.com'],
  },
});
