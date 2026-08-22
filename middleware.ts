import { next } from '@vercel/functions';

/**
 * 全站口令（HTTP Basic Auth），只放行对外分享的简历。
 *
 * 为什么必须放在这一层，而不是前端弹个密码框：
 * 这是个纯静态站，所有笔记正文都打包在 `/assets/notes-*.js` 里，而那个文件名
 * 在入口 JS 里就能搜到。前端密码框只挡渲染，字节早就下发到浏览器了——
 * 任何人打开开发者工具就能把整份笔记捞走。中间件跑在 CDN 之前，
 * 口令不对就是 401，一个字节都不下发。
 *
 * 采用「默认拒绝 + 白名单」而不是反过来：白名单漏了会立刻表现为 /cv 打不开
 * （吵闹、马上能发现），黑名单漏了则是笔记静默泄漏（安静、永远发现不了）。
 * 以后如果构建产物拆分变了导致 /cv 白屏，来这里补前缀。
 *
 * 部署前提：在 Vercel 项目设置里加环境变量 `SITE_PASSWORD`（可选 `SITE_USER`）。
 * 没配置就整站 401 —— 这是有意的：宁可把自己锁在外面，也不要以为受保护其实没有。
 */

/** 对外分享的简历页要用到的路径 */
const PUBLIC_PATHS = new Set([
  '/cv',
  '/Chris-Sun-Resume.pdf',
  '/favicon.ico',
  '/favicon.png',
  '/logo-avatar.png',
  '/site.webmanifest',
  '/robots.txt',
]);

/**
 * /cv 实际会拉取的构建产物前缀（哈希后缀会变，前缀不会）。
 * 这几个里不含任何笔记正文：笔记在 `notes-*`，资料在 `LibraryPage-*`，
 * 两者都不在白名单上。
 */
const PUBLIC_ASSET_PREFIXES = [
  'index-', // 入口 JS 与全站 CSS
  'rolldown-runtime-',
  'vendor-',
  'SharedResumePage-',
  'ResumeSheet-',
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Vercel 自己的内部路径（analytics、insights 等）
  if (pathname.startsWith('/_vercel/')) return true;

  if (pathname.startsWith('/assets/')) {
    const file = pathname.slice('/assets/'.length);
    return PUBLIC_ASSET_PREFIXES.some((prefix) => file.startsWith(prefix));
  }

  return false;
}

/** 逐字符比较，长度不同直接判否；避免用 === 提前短路泄漏长度信息 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function unauthorized(message: string): Response {
  return new Response(message, {
    status: 401,
    headers: {
      // 浏览器看到这个头才会弹出用户名/密码输入框
      'WWW-Authenticate': 'Basic realm="Apollo", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export default function middleware(request: Request) {
  const { pathname } = new URL(request.url);

  if (isPublic(pathname)) return next();

  const password = process.env.SITE_PASSWORD;
  if (!password) {
    return unauthorized(
      'Site password is not configured. Set SITE_PASSWORD in the Vercel project settings and redeploy.'
    );
  }

  const user = process.env.SITE_USER ?? 'chris';
  const header = request.headers.get('authorization') ?? '';
  const expected = `Basic ${btoa(`${user}:${password}`)}`;

  if (!safeEqual(header, expected)) {
    return unauthorized('Authentication required.');
  }

  return next();
}
