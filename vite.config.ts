import { defineConfig } from "vite";

export default defineConfig({
  base: "/AddressInsights/",
  server: {
    port: 5173,
    allowedHosts: ['https://49asvk.github.io/AddressInsights/', '49asvk.github.io', '49asvk.github.io/AddressInsights' ],
  },
});
