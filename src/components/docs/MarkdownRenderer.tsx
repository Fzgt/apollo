import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// 中文里 `是**「粗体」**` 这种写法，按 CommonMark 的定界符规则不构成强调
// （** 前是汉字、后是标点），会原样渲染成星号。这个插件放宽了 CJK 相邻的判定。
import remarkCjkFriendly from 'remark-cjk-friendly';
import { cn } from '@/lib/utils';
import { headingIdByLine } from '@/lib/headings';
import { inlineHtmlImages } from '@/lib/markdown-html';
import { ImageLightbox, type LightboxImage } from './ImageLightbox';
import { Copy, Check } from 'lucide-react';

// 正文里的图片，按出现顺序。灯箱要靠这个做左右翻页，所以在渲染之前先扫一遍源码——
// `img` 组件是一张张被调用的，拿不到「这一篇一共有几张、我是第几张」。
// HTML 的 <img> 已经被 inlineHtmlImages 改写成 markdown 语法了，一条正则就够。
const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(\s*(?:<([^>]*)>|([^\s)]+))[^)]*\)/g;

function collectImages(source: string): LightboxImage[] {
  return [...source.matchAll(MARKDOWN_IMAGE)].map((match) => ({
    alt: match[1] ?? '',
    src: (match[2] ?? match[3] ?? '').trim(),
  }));
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

type PrismModule = typeof import('prismjs');

const normalizePrismLanguage = (language: string) => {
  const normalized = language.toLowerCase();

  if (normalized === 'js') return 'javascript';
  if (normalized === 'ts') return 'typescript';
  if (['shell', 'sh', 'zsh', 'terminal'].includes(normalized)) return 'bash';
  if (normalized === 'py') return 'python';

  return normalized;
};

let prismPromise: Promise<PrismModule> | null = null;
const prismLanguagePromises = new Map<string, Promise<unknown>>();

const loadPrismCore = () => {
  prismPromise ??= import('prismjs');
  return prismPromise;
};

const prismLanguageLoaders: Record<string, () => Promise<unknown>> = {
  javascript: () => import('prismjs/components/prism-javascript'),
  typescript: async () => {
    await loadPrismLanguage('javascript');
    return import('prismjs/components/prism-typescript');
  },
  jsx: async () => {
    await loadPrismLanguage('javascript');
    return import('prismjs/components/prism-jsx');
  },
  tsx: async () => {
    await loadPrismLanguage('jsx');
    await loadPrismLanguage('typescript');
    return import('prismjs/components/prism-tsx');
  },
  bash: () => import('prismjs/components/prism-bash'),
  json: () => import('prismjs/components/prism-json'),
  css: () => import('prismjs/components/prism-css'),
  sql: () => import('prismjs/components/prism-sql'),
  python: () => import('prismjs/components/prism-python'),
  lua: () => import('prismjs/components/prism-lua'),
};

async function loadPrismLanguage(language: string) {
  await loadPrismCore();

  const normalized = normalizePrismLanguage(language);
  const loader = prismLanguageLoaders[normalized];

  if (!loader) return;

  if (!prismLanguagePromises.has(normalized)) {
    prismLanguagePromises.set(normalized, loader());
  }

  await prismLanguagePromises.get(normalized);
}

async function loadPrism(language: string) {
  const prism = await loadPrismCore();
  await loadPrismLanguage(language);
  return prism;
}

function CodeBlock({ className, children }: { className?: string; children: string }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  
  // Extract language from className (e.g., "language-javascript")
  const language = className?.replace('language-', '') || 'text';
  
  useEffect(() => {
    let isActive = true;
    const codeElement = codeRef.current;

    if (!codeElement) return;

    loadPrism(language)
      .then((Prism) => {
        if (isActive) {
          Prism.highlightElement(codeElement);
        }
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) {
          console.warn('Failed to load Prism language:', language, error);
        }
      });

    return () => {
      isActive = false;
    };
  }, [children, language]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative max-w-full">
      <div className="absolute right-2 top-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
        <button
          onClick={handleCopy}
          className="p-2 rounded-lg bg-muted/80 hover:bg-muted border border-border/50 transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>
      {language !== 'text' && (
        <div className="absolute left-3 top-2 text-xs text-muted-foreground/60 uppercase tracking-wider">
          {language}
        </div>
      )}
      <pre className="max-w-full overflow-x-auto rounded-xl border border-border bg-card px-4 pb-4 pt-10 text-sm">
        <code ref={codeRef} className={`language-${language}`}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  // 锚点 id 由 headingIdByLine 从原文算好，渲染时按 AST 给的行号查。
  // 不能在渲染过程中递增计数器来给重名标题编号——严格模式和并发渲染会把
  // 同一棵子树渲染两遍，计数器翻倍，id 全变成 `xxx-2`，而目录算的是 `xxx`，
  // 于是 getElementById 一个都找不到：目录跳不动，也不会高亮当前章节。
  const idByLine = useMemo(() => headingIdByLine(content), [content]);
  const lineId = (node?: { position?: { start?: { line?: number } } }) =>
    idByLine.get(node?.position?.start?.line ?? -1);
  // Line-preserving, so the line numbers idByLine was built from still line up.
  const source = useMemo(() => inlineHtmlImages(content), [content]);

  const images = useMemo(() => collectImages(source), [source]);
  const [zoomed, setZoomed] = useState<number | null>(null);

  // 换一篇文章时把灯箱关掉：索引是对着上一篇那组图算的
  useEffect(() => setZoomed(null), [source]);

  return (
    <div className={cn('prose-docs max-w-full [overflow-wrap:anywhere]', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCjkFriendly]}
        components={{
          h1: ({ children, node }) => {
            const id = lineId(node);
            return (
              <h1 id={id} className="mb-6 mt-8 scroll-mt-24 border-b border-border pb-4 text-3xl font-bold text-foreground first:mt-0 md:text-4xl">
                {children}
              </h1>
            );
          },
          h2: ({ children, node }) => {
            const id = lineId(node);
            return (
              <h2 id={id} className="mb-4 mt-10 scroll-mt-24 text-2xl font-semibold text-foreground md:text-3xl">
                {children}
              </h2>
            );
          },
          h3: ({ children, node }) => {
            const id = lineId(node);
            return (
              <h3 id={id} className="mb-3 mt-8 scroll-mt-24 text-xl font-semibold text-foreground md:text-2xl">
                {children}
              </h3>
            );
          },
          h4: ({ children, node }) => {
            const id = lineId(node);
            return (
              <h4 id={id} className="text-lg font-semibold text-foreground mb-2 mt-6 scroll-mt-24">
                {children}
              </h4>
            );
          },
          p: ({ children }) => (
            <p className="mb-4 leading-7 text-muted-foreground">
              {children}
            </p>
          ),
          // 正文是 muted-foreground，加粗若不换色就只剩字重差别；暗色模式下
          // 亮字压在深底上会发虚，字重那点差距基本看不出来 —— 提到 foreground
          // 才有亮度差，重点词才真的跳出来。
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-primary hover:text-primary/80 underline underline-offset-4 transition-colors"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 ml-5 list-outside list-disc space-y-2 text-muted-foreground sm:ml-6">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 ml-5 list-outside list-decimal space-y-2 text-muted-foreground sm:ml-6">
              {children}
            </ol>
          ),
          li: ({ children, className }) => {
            // GFM 任务项自带 task-list-item 类：去掉列表符号，让复选框顶格
            const isTask = typeof className === 'string' && className.includes('task-list-item');
            return (
              <li className={cn('leading-7', isTask && 'ml-0 list-none')}>
                {children}
              </li>
            );
          },
          input: ({ type, checked }) =>
            type === 'checkbox' ? (
              <span
                className={cn(
                  'mr-2 inline-flex h-4 w-4 shrink-0 translate-y-[2px] items-center justify-center rounded border',
                  checked
                    ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'border-border bg-muted/40'
                )}
                aria-hidden="true"
              >
                {checked ? <Check className="h-3 w-3" /> : null}
              </span>
            ) : null,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/50 pl-4 py-2 my-4 bg-muted/30 rounded-r-lg text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const codeString = String(children).replace(/\n$/, '');
            // 不带语言标记的围栏块（``` 直接换行）拿不到 className，只能靠换行
            // 判断。漏掉这一步它会掉进下面的行内分支，white-space 被折叠、
            // break-all 把单词拦腰截断，ASCII 图就整个散了。
            const isBlock = className?.includes('language-') || codeString.includes('\n');
            
            if (isBlock) {
              return <CodeBlock className={className}>{codeString}</CodeBlock>;
            }
            
            return (
              <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-primary break-all" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => {
            // Just pass through - the code component handles the pre styling
            return <>{children}</>;
          },
          table: ({ children }) => (
            <div className="mb-6 max-w-full overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-full border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-border px-3 py-3 text-left align-top font-semibold text-foreground sm:px-4">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border px-3 py-3 align-top text-muted-foreground sm:px-4">
              {children}
            </td>
          ),
          hr: () => (
            <hr className="border-border my-8" />
          ),
          // 正文里的图都是截图，动辄一两百 KB，且基本都在首屏之外
          img: ({ src, alt }) => {
            const index = images.findIndex((image) => image.src === src);
            // 截图都是 retina 的，原始像素两三倍于该显示的尺寸。issue 里写过 width 的
            // （inlineHtmlImages 编进了 ?w=）按那个宽度收；没写的兜底不超过 70vh，
            // 免得一张竖图占掉整屏。要看细节点开灯箱。
            const declaredWidth = Number(
              new URLSearchParams(String(src ?? '').split('?')[1] ?? '').get('w'),
            );
            return (
              <button
                type="button"
                onClick={() => setZoomed(index >= 0 ? index : 0)}
                aria-label={alt ? `Zoom: ${alt}` : 'Zoom image'}
                className="my-6 block w-fit max-w-full cursor-zoom-in rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <img
                  src={src}
                  alt={alt}
                  loading="lazy"
                  decoding="async"
                  style={
                    Number.isFinite(declaredWidth) && declaredWidth > 0
                      ? { maxWidth: declaredWidth }
                      : undefined
                  }
                  className="h-auto max-h-[70vh] w-auto max-w-full rounded-xl border border-border shadow-lg transition-shadow hover:shadow-xl"
                />
              </button>
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>

      <AnimatePresence>
        {zoomed !== null && images.length > 0 && (
          <ImageLightbox
            images={images}
            index={zoomed}
            onIndexChange={setZoomed}
            onClose={() => setZoomed(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
