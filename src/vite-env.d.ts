/// <reference types="vite/client" />

/** 构建时刻的 ISO 串，由 vite.config.ts 的 define 钉进 bundle */
declare const __BUILD_TIME__: string;
/** 构建时的 commit 短 hash；拿不到时是空串 */
declare const __COMMIT_SHA__: string;
