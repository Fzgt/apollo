import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";

// 站点部署在 Vercel 的根路径。换成子路径部署时用 VITE_BASE 覆盖。
const BASE = process.env.VITE_BASE ?? "/";

// 页面右上角那个「更新于」用的就是这两个值：构建时刻钉进 bundle，
// 打开页面看到的时间就是这份产物被构建出来的时间——不是浏览器的当前时间。
// 存 ISO 串（UTC），Vercel 在 UTC 机器上构建，时区换算留给浏览器做。
const BUILD_TIME = new Date().toISOString();

// Vercel 构建目录不带 .git，所以先认它注入的环境变量，本地才回落到 git 命令。
const COMMIT_SHA = (() => {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromVercel) return fromVercel.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
})();

// https://vitejs.dev/config/
export default defineConfig({
  base: BASE,
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    __COMMIT_SHA__: JSON.stringify(COMMIT_SHA),
  },
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
