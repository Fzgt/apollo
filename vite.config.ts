import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// 站点部署在 Vercel 的根路径。换成子路径部署时用 VITE_BASE 覆盖。
const BASE = process.env.VITE_BASE ?? "/";

// https://vitejs.dev/config/
export default defineConfig({
  base: BASE,
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (/[\\/]node_modules[\\/](react|react-dom|react-router-dom|scheduler)[\\/]/.test(id)) {
            return "vendor-react";
          }

          if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) {
            return "vendor-framer-motion";
          }

          if (/[\\/]node_modules[\\/]@radix-ui[\\/]/.test(id)) {
            return "vendor-radix";
          }

          return undefined;
        },
      },
    },
  },
});
