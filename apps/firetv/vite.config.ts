import { defineConfig } from "vite";
export default defineConfig({
  base: "/curiolab/",
  build: { outDir: "../../build/pages", emptyOutDir: true },
  server: { host: "0.0.0.0", allowedHosts: true },
  preview: { host: "0.0.0.0", allowedHosts: true },
});
