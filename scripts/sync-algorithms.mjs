/**
 * 算法笔记同步：把本机题解目录搬成站里的 `/algorithms` 内容。
 *
 * 来源是 Obsidian 那份 `Algorithm/既然巅峰留不住，那就重走来时路` —— 13 个分类目录，
 * 里面是一题一个 `.ts`/`.js`，少数几题另有一份写思路的 `.md`（带截图）。
 * 站点部署在 Vercel，构建机上没有这个目录，所以这里把它**生成成仓库里的文件**再提交，
 * 跟 `sync-blog.mjs` 一样：源在别处，仓库里存一份构建期快照。
 *
 * 约定见 `src/content/collection.ts`：`<NN>-<sectionId>/<NNN>-<itemId>.md`。
 * 目录/文件名的数字前缀只决定顺序，`itemId` 用 `lc<题号>`，没题号的走下面的别名表。
 *
 * 用法：npm run sync:algorithms
 * 源目录可用 ALGO_SRC 覆盖。
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { homedir } from 'node:os';

const SRC = process.env.ALGO_SRC ?? join(homedir(), 'Desktop/Algorithm/既然巅峰留不住，那就重走来时路');
const OUT = 'src/content/algorithms';
const IMG_OUT = 'public/algorithms';

/** 目录名 -> 站里的 id / 显示名 / lucide 图标。图标名要在 content/navigation.tsx 的 ICONS 里有 */
const SECTIONS = {
  '1.基础排序算法': { id: 'basic-sorting', title: '基础排序', icon: 'arrow-down-narrow-wide' },
  '2.链表': { id: 'linked-list', title: '链表', icon: 'link-2' },
  '3.栈与队列': { id: 'stack-queue', title: '栈与队列', icon: 'layers' },
  '4.哈希表': { id: 'hash-map', title: '哈希表', icon: 'hash' },
  '5.二叉树': { id: 'binary-tree', title: '二叉树', icon: 'git-fork' },
  '6.二分查找': { id: 'binary-search', title: '二分查找', icon: 'search' },
  '7.滑动窗口与双指针': { id: 'two-pointers', title: '滑动窗口与双指针', icon: 'move-horizontal' },
  '8.动态规划': { id: 'dp', title: '动态规划', icon: 'layout-grid' },
  '9.贪心算法': { id: 'greedy', title: '贪心', icon: 'coins' },
  '10.图': { id: 'graph', title: '图', icon: 'network' },
  '11.高级排序算法': { id: 'advanced-sorting', title: '高级排序', icon: 'zap' },
  '12.数组+字符串': { id: 'array-string', title: '数组与字符串', icon: 'type' },
  '13.回溯': { id: 'backtracking', title: '回溯', icon: 'undo-2' },
};

/**
 * 没有题号的那几份。key 是去掉扩展名的文件名，同一个 id 下的多个文件合成一篇
 * （快排三份写法就是这么并成一篇的）。`order` 让它们排在有题号的前面。
 */
const UNNUMBERED = {
  冒泡排序: { id: 'bubble-sort', title: '冒泡排序' },
  选择排序: { id: 'selection-sort', title: '选择排序' },
  快速排序: { id: 'quick-sort', title: '快速排序', label: '常规写法', order: 0 },
  '快排(原地版)': { id: 'quick-sort', title: '快速排序', label: '原地版', order: 1 },
  Claude快排注释详解: { id: 'quick-sort', title: '快速排序', label: '逐行注释版', order: 2 },
  回溯: { id: 'overview', title: '回溯：我所理解的回溯' },
};

const CODE_EXT = new Set(['.ts', '.js']);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name === '.DS_Store') return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** `70爬楼梯.ts` / `167. 两数之和 II.js` -> { num: 70, rest: '爬楼梯' } */
function parseName(file) {
  const stem = basename(file, extname(file));
  const match = stem.match(/^(\d+)[.\s]*(.*)$/);
  if (!match) return { stem, num: null, rest: stem };
  return { stem, num: Number(match[1]), rest: match[2].trim() };
}

/**
 * 一组里挑标题。同一题的几份文件名写法常常不一致（`3无重复字符串最长子串.js` 和
 * `3无重复字符的最长子串.ts`），先去掉括号里的变体说明，再取出现次数最多的那个写法，
 * 一样多就取短的——多数派比字典序更接近他后来定下的叫法。
 */
function pickTitle(rests) {
  const tally = new Map();
  for (const rest of rests) {
    const plain = rest.replace(/[（(].*$/, '').trim();
    if (plain) tally.set(plain, (tally.get(plain) ?? 0) + 1);
  }
  const pool = tally.size ? [...tally.entries()] : [[rests[0], 1]];
  return pool.sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];
}

/** 代码里真出现 ``` 时把围栏加长，不然正文会被截断 */
function fence(code) {
  let ticks = '```';
  while (code.includes(ticks)) ticks += '`';
  return ticks;
}

function langOf(file) {
  return extname(file) === '.js' ? 'js' : 'ts';
}

// 源目录不在就立刻停：下面会把生成物整个删掉重建，在别的机器上误跑等于清空内容
if (!existsSync(SRC)) {
  console.error(`源目录不在：${SRC}\n用 ALGO_SRC 指到题解目录再跑。`);
  process.exit(1);
}

// 生成物整个重建：源目录里删掉一题，站里也该跟着没有
rmSync(OUT, { recursive: true, force: true });
rmSync(IMG_OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let itemCount = 0;
let fileCount = 0;

for (const [dirName, section] of Object.entries(SECTIONS)) {
  const dir = join(SRC, dirName);
  if (!existsSync(dir)) {
    console.warn(`跳过（源目录不在）：${dirName}`);
    continue;
  }

  // 同一题的多份文件（.md 思路 + .ts 实现 + 截图）合成一篇
  const groups = new Map();
  for (const file of walk(dir)) {
    const ext = extname(file);
    // 截图叫 image.png，题号在它所在的目录名上（`46全排列/image.png`）
    const { stem, num, rest } = parseName(IMAGE_EXT.has(ext) ? basename(join(file, '..')) : file);
    const alias = UNNUMBERED[stem];
    if (num === null && !alias) {
      console.warn(`跳过（认不出题号，也不在别名表里）：${file}`);
      continue;
    }
    const id = alias ? alias.id : `lc${num}`;

    let group = groups.get(id);
    if (!group) {
      group = { id, num: num ?? -1, rests: [], notes: [], codes: [], images: [], hints: new Set() };
      groups.set(id, group);
    }
    if (alias) group.title = alias.title;
    else group.rests.push(rest);

    // `12.数组+字符串/前缀和/560和为K的子数组.ts` 里的「前缀和」是子分类，进标题
    const parent = basename(join(file, '..'));
    if (parent !== dirName && parent !== stem) group.hints.add(parent);

    if (ext === '.md') group.notes.push(file);
    else if (CODE_EXT.has(ext))
      group.codes.push({ file, label: alias?.label, order: alias?.order ?? 0 });
    else if (IMAGE_EXT.has(ext)) group.images.push(file);
  }

  const ordered = [...groups.values()].sort((a, b) => a.num - b.num || a.id.localeCompare(b.id));

  ordered.forEach((group, index) => {
    const hint = group.hints.size ? `（${[...group.hints].join('、')}）` : '';
    const title = group.title ?? `${group.num}. ${pickTitle(group.rests)}`;

    const imageDir = join(IMG_OUT, section.id, group.id);
    if (group.images.length) {
      mkdirSync(imageDir, { recursive: true });
      for (const image of group.images) copyFileSync(image, join(imageDir, basename(image)));
    }

    const parts = [];
    for (const note of group.notes.sort()) {
      // 笔记里的图片是相对路径，搬到 public 之后要改成站内绝对路径
      parts.push(
        readFileSync(note, 'utf8')
          .trim()
          .replace(/!\[([^\]]*)\]\(\s*<?([^)>\s]+)>?\s*\)/g, (whole, alt, src) =>
            /^(https?:|\/)/.test(src)
              ? whole
              : `![${alt}](/algorithms/${section.id}/${group.id}/${basename(src)})`
          )
      );
    }

    const codes = group.codes.sort((a, b) => a.order - b.order || a.file.localeCompare(b.file));
    for (const { file, label } of codes) {
      const body = readFileSync(file, 'utf8').trim();
      const bar = fence(body);
      // 一题只有一份实现就不加小标题；多份（或另有思路笔记）才需要说明这是哪一份
      const heading =
        codes.length > 1
          ? `### ${label ?? basename(file)}`
          : parts.length
            ? '### 我的实现'
            : '';
      parts.push(`${heading ? `${heading}\n\n` : ''}${bar}${langOf(file)}\n${body}\n${bar}`);
    }

    const frontmatter = [
      '---',
      `title: "${(title + hint).replace(/"/g, "'")}"`,
      `section: ${section.title}`,
      `icon: ${section.icon}`,
      '---',
    ].join('\n');

    const outDir = join(OUT, `${String(Object.keys(SECTIONS).indexOf(dirName) + 1).padStart(2, '0')}-${section.id}`);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, `${String(index).padStart(3, '0')}-${group.id}.md`),
      `${frontmatter}\n\n${parts.join('\n\n')}\n`
    );
    itemCount += 1;
    fileCount += group.notes.length + group.codes.length;
  });
}

writeFileSync(
  join(OUT, 'index.ts'),
  `/**
 * 算法题解的内容层（/algorithms 那个 tab）。
 *
 * 目录里的 .md **全部由 \`npm run sync:algorithms\` 生成**，源是本机的
 * \`Algorithm/既然巅峰留不住，那就重走来时路\`。不要手改这里的文件，下一次同步会覆盖；
 * 要改就改源目录里的题解，再跑一次同步。
 */

import { buildCollection } from '../collection';

const RAW = import.meta.glob('./**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const collection = buildCollection(RAW, '${OUT}');

export const algorithmSections = collection.sections;

export const allAlgorithmNotes = collection.notes;

export const getAlgorithmNote = collection.getNote;
`
);

console.log(`算法笔记同步完成：${itemCount} 篇，来自 ${fileCount} 个源文件`);
