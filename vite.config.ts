import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";
import { componentTagger } from "lovable-tagger";

// GitHub Pages 把站点挂在 https://<user>.github.io/<repo>/ 下，
// 所以产物里的资源路径必须带仓库名前缀。VITE_BASE 可以覆盖（换自定义域名时设成 "/"）。
const BASE = process.env.VITE_BASE ?? "/apollo/";

// GitHub Pages 没有 SPA 回退，深链接（/apollo/docs?note=...）会直接 404。
// 惯例做法：把 index.html 复制一份成 404.html，Pages 拿它兜底，react-router 再接管路由。
function spaFallback(): Plugin {
  return {
    name: "spa-404-fallback",
    apply: "build",
    closeBundle() {
      const dist = path.resolve(__dirname, "dist");
      const index = path.join(dist, "index.html");
      if (fs.existsSync(index)) {
        fs.copyFileSync(index, path.join(dist, "404.html"));
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: BASE,
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger(), spaFallback()].filter(Boolean),
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
}));
