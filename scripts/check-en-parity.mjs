/**
 * 中英版本的口径对账。
 *
 * 英文版是面试要照着讲的材料，数字翻错一个就是背错一个。
 * 这里不判断译文好坏，只比对两件不该变的东西：
 *   1. 代码块内容（逐块全等，注释除外——注释是散文，允许翻译）
 *   2. 正文里出现的数字（含 60 秒、250ms、2⁴ 这类）
 *
 * 用法：node scripts/check-en-parity.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src/content/notes', 'src/content/library'];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/**
 * 真代码块的正文，去掉行注释——注释是散文，翻译是允许的。
 * ```text 的示意图不算：里面全是中文说明，本来就该翻。
 *
 * `--` 也算行注释（SQL）。误伤 `i--` 这类不要紧：两边同样处理，比的是相等。
 */
function codeBlocks(md) {
  return [...md.matchAll(/```([^\n]*)\n([\s\S]*?)```/g)]
    .filter(([, lang]) => lang.trim() && lang.trim() !== 'text')
    .map(([, , body]) =>
    body
      .split('\n')
      .map((line) => line.replace(/\/\/.*$|--.*$|#(?!\[).*$/, '').trimEnd())
      .join('\n')
      .trim()
  );
}

/** frontmatter 不是正文：`day: 99` 这种只在中文那份里，比它没有意义 */
function stripFrontmatter(md) {
  return md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

/**
 * 出现过哪些数字。链接目标除外。
 * 只看两位以上：个位数在英文里常写成单词（three to five seconds），不是错。
 * 比的是集合不是次数——同一个数在英文里少出现一次通常只是句式不同
 * （「第 10 秒」写成 the tenth second），少了这个数才是口径出问题。
 */
function numbers(md) {
  const text = stripFrontmatter(md).replace(/\[[^\]]*\]\([^)]*\)/g, '');
  return [...text.matchAll(/\d+(?:\.\d+)?/g)]
    .map(([n]) => n)
    .filter((n) => n.length >= 2);
}

let failed = 0;
for (const root of ROOTS) {
  for (const en of walk(root).filter((f) => f.endsWith('.en.md'))) {
    const zh = en.replace(/\.en\.md$/, '.md');
    const a = readFileSync(zh, 'utf8');
    const b = readFileSync(en, 'utf8');

    const [ca, cb] = [codeBlocks(a), codeBlocks(b)];
    if (ca.length !== cb.length) {
      console.log(`✗ ${en}: 代码块数量 ${ca.length} → ${cb.length}`);
      failed++;
    } else {
      ca.forEach((block, i) => {
        if (block !== cb[i]) {
          console.log(`✗ ${en}: 第 ${i + 1} 个代码块内容不一致`);
          failed++;
        }
      });
    }

    const nb = new Set(numbers(b));
    const missing = [...new Set(numbers(a))].filter((n) => !nb.has(n));
    if (missing.length) {
      console.log(`✗ ${en}: 中文里有、英文里没有的数字 → ${missing.join(', ')}`);
      failed++;
    }
  }
}

console.log(failed ? `\n${failed} 处需要人看一眼` : '✓ 中英口径一致');
process.exit(failed ? 1 : 0);
