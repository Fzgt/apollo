/**
 * 笔记集合的公共构建逻辑。
 *
 * 约定优于配置：`<contentRoot>/<NN>-<sectionId>/<NN>-<itemId>.md`
 * 目录名去掉数字前缀就是 section id，文件名去掉数字前缀就是 item id，
 * 数字前缀只决定顺序。加一篇笔记＝丢一个 .md 进去，不用改任何 TS。
 *
 * 站里有两套内容：`content/notes`（复习计划，带日程与进度）和
 * `content/library`（面试资料，只有正文）。两套共用这里的解析与取数。
 */

export type NoteStatus = 'todo' | 'doing' | 'done';

export interface NoteFrontmatter {
  /** 页面标题，也是侧边栏条目名 */
  title: string;
  /** 所属分组的显示名。取该分组内第一篇笔记的值 */
  section: string;
  /** lucide 图标名（kebab-case），分组图标取第一篇的值 */
  icon?: string;
  /** 对应复习计划第几天；0 = 总览，99 = 速查。资料集用不到 */
  day?: number;
  /** S / A / B / 前置 / — */
  level?: string;
  /** 进度状态，驱动首页看板 */
  status?: NoteStatus;
}

export interface Note extends NoteFrontmatter {
  sectionId: string;
  itemId: string;
  status: NoteStatus;
  day: number;
  level: string;
  /** 相对仓库根的源文件路径，用于「在 GitHub 上编辑」 */
  sourcePath: string;
  /** 'must' = 必看，'ref' = 速查；侧边栏据此加标记 */
  tier?: string;
  content: string;
  /** 同名 `.en.md` 的正文，没有这个文件就是 undefined */
  contentEn?: string;
  /** 英文版 frontmatter 里的标题，切到英文时用 */
  titleEn?: string;
  /** 英文版 frontmatter 里的分组名 */
  sectionEn?: string;
}

export interface NoteSection {
  id: string;
  title: string;
  /** 英文分组名，取组内第一篇英文版的 section 字段 */
  titleEn?: string;
  icon?: string;
  items: Note[];
}

export interface NoteCollection {
  sections: NoteSection[];
  notes: Note[];
  getNote(sectionId?: string, itemId?: string): Note | undefined;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** 只解析 `key: value` 这一层，笔记的 frontmatter 不需要更多 */
function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return { data: {}, body: raw };

  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!key) continue;
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }

  return { data, body: raw.slice(match[0].length) };
}

/** `02-beyz` -> `beyz`，`00-day02.md` -> `day02`，`00-day02.en.md` -> `day02` */
function stripOrderPrefix(name: string): string {
  return name.replace(/(\.en)?\.md$/, '').replace(/^\d+[-_]/, '');
}

/** `00-day02.en.md` 是 `00-day02.md` 的英文版，不是独立的一篇 */
function isEnglishVariant(fileName: string): boolean {
  return fileName.endsWith('.en.md');
}

function isStatus(value: string | undefined): value is NoteStatus {
  return value === 'todo' || value === 'doing' || value === 'done';
}

/**
 * @param raw        `import.meta.glob('./**\/*.md', { query: '?raw', eager: true })` 的结果
 * @param contentRoot 相对仓库根的目录，只用于拼「在 GitHub 上编辑」的链接
 */
export function buildCollection(raw: Record<string, string>, contentRoot: string): NoteCollection {
  const sections = new Map<string, NoteSection>();

  // 英文版先单独收一遍：`.en.md` 排在同名 `.md` 前面，正文循环里来不及回填
  const english = new Map<string, { title?: string; section?: string; body: string }>();
  for (const globPath of Object.keys(raw)) {
    const segments = globPath.replace(/^\.\//, '').split('/');
    if (segments.length !== 2 || !isEnglishVariant(segments[1])) continue;
    const { data, body } = parseFrontmatter(raw[globPath]);
    english.set(`${stripOrderPrefix(segments[0])}/${stripOrderPrefix(segments[1])}`, {
      title: data.title,
      section: data.section,
      body,
    });
  }

  for (const globPath of Object.keys(raw).sort()) {
    // './02-beyz/00-day02.md' -> ['02-beyz', '00-day02.md']
    const segments = globPath.replace(/^\.\//, '').split('/');
    if (segments.length !== 2) continue;

    const [dirName, fileName] = segments;
    if (isEnglishVariant(fileName)) continue;
    const { data, body } = parseFrontmatter(raw[globPath]);

    const sectionId = stripOrderPrefix(dirName);
    const itemId = stripOrderPrefix(fileName);
    const note: Note = {
      sectionId,
      itemId,
      title: data.title || itemId,
      section: data.section || sectionId,
      icon: data.icon,
      day: Number.isFinite(Number(data.day)) ? Number(data.day) : 0,
      level: data.level || '—',
      status: isStatus(data.status) ? data.status : 'todo',
      sourcePath: `${contentRoot}/${dirName}/${fileName}`,
      tier: data.tier,
      content: body,
      contentEn: english.get(`${sectionId}/${itemId}`)?.body,
      titleEn: english.get(`${sectionId}/${itemId}`)?.title,
      sectionEn: english.get(`${sectionId}/${itemId}`)?.section,
    };

    let section = sections.get(sectionId);
    if (!section) {
      // 分组的标题和图标由组内第一篇（文件名序号最小的）决定
      section = {
        id: sectionId,
        title: note.section,
        titleEn: note.sectionEn,
        icon: note.icon,
        items: [],
      };
      sections.set(sectionId, section);
    }
    section.items.push(note);
  }

  const list = [...sections.values()];
  const notes = list.flatMap((section) => section.items);

  return {
    sections: list,
    notes,
    getNote(sectionId?: string, itemId?: string) {
      const section = sectionId ? list.find((s) => s.id === sectionId) : list[0];
      if (!section) return undefined;
      if (!itemId) return section.items[0];
      return section.items.find((item) => item.itemId === itemId) ?? section.items[0];
    },
  };
}
