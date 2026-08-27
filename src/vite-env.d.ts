/// <reference types="vite/client" />

/** 构建时刻的 ISO 串，由 vite.config.ts 的 define 钉进 bundle */
declare const __BUILD_TIME__: string;
/** 构建时的 commit 短 hash；拿不到时是空串 */
declare const __COMMIT_SHA__: string;

/**
 * Prism 的语法包只有副作用（往全局 Prism 上注册一门语言），
 * `@types/prismjs` 没给这些子路径写声明，动态 import 会被当成隐式 any。
 */
declare module 'prismjs/components/*';
