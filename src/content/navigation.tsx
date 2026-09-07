import type { ReactNode } from 'react';
import {
  ArrowDownNarrowWide,
  Calculator,
  Coins,
  Database,
  FileText,
  Gamepad2,
  GitFork,
  Hash,
  Landmark,
  Layers,
  LayoutGrid,
  Link2,
  List,
  Map,
  Mic2,
  Microscope,
  MoveHorizontal,
  Network,
  PawPrint,
  Radio,
  Repeat,
  Scale,
  Search,
  Type,
  Undo2,
  Workflow,
  Wrench,
  Zap,
} from 'lucide-react';
import type { Lang } from '@/lib/i18n';
import type { NoteSection } from './collection';

export interface DocSection {
  id: string;
  title: string;
  icon?: ReactNode;
  items?: {
    id: string;
    title: string;
    tier?: string;
  }[];
}

/** frontmatter 里的 icon 名到组件的映射。加新图标时在这里补一行 */
const ICONS: Record<string, ReactNode> = {
  map: <Map className="w-4 h-4" />,
  calculator: <Calculator className="w-4 h-4" />,
  radio: <Radio className="w-4 h-4" />,
  microscope: <Microscope className="w-4 h-4" />,
  landmark: <Landmark className="w-4 h-4" />,
  list: <List className="w-4 h-4" />,
  workflow: <Workflow className="w-4 h-4" />,
  database: <Database className="w-4 h-4" />,
  'gamepad-2': <Gamepad2 className="w-4 h-4" />,
  wrench: <Wrench className="w-4 h-4" />,
  'mic-2': <Mic2 className="w-4 h-4" />,
  'paw-print': <PawPrint className="w-4 h-4" />,
  repeat: <Repeat className="w-4 h-4" />,
  'file-text': <FileText className="w-4 h-4" />,
  scale: <Scale className="w-4 h-4" />,
  // 算法那套分类的图标
  'arrow-down-narrow-wide': <ArrowDownNarrowWide className="w-4 h-4" />,
  'link-2': <Link2 className="w-4 h-4" />,
  layers: <Layers className="w-4 h-4" />,
  hash: <Hash className="w-4 h-4" />,
  'git-fork': <GitFork className="w-4 h-4" />,
  search: <Search className="w-4 h-4" />,
  'move-horizontal': <MoveHorizontal className="w-4 h-4" />,
  'layout-grid': <LayoutGrid className="w-4 h-4" />,
  coins: <Coins className="w-4 h-4" />,
  network: <Network className="w-4 h-4" />,
  zap: <Zap className="w-4 h-4" />,
  type: <Type className="w-4 h-4" />,
  'undo-2': <Undo2 className="w-4 h-4" />,
};

/**
 * 分组名的英文。
 *
 * 分组名来自组内第一篇的 frontmatter，等那一篇翻完才会变英文——但侧边栏
 * 是整站骨架，不该跟着单篇翻译进度一格一格变。所以这里按 section id 直接钉死。
 */
const SECTION_TITLES_EN: Record<string, string> = {
  overview: 'Overview',
  beyz: 'Beyz',
  biomap: 'BioMap',
  baidu: 'Baidu',
  winterfell: 'WinterFell',
  periplus: 'Periplus',
  skills: 'Skills section',
  mock: 'Mock interviews',
  cheatsheet: 'Cheat sheet',
  interview: 'General interview',
  jd: 'The JD',
  speak: 'Talk track',
  english: 'Interview English',
  course: 'Course and older notes',
  'basic-sorting': 'Basic sorting',
  'linked-list': 'Linked list',
  'stack-queue': 'Stack and queue',
  'hash-map': 'Hash map',
  'binary-tree': 'Binary tree',
  'binary-search': 'Binary search',
  'two-pointers': 'Sliding window and two pointers',
  dp: 'Dynamic programming',
  greedy: 'Greedy',
  graph: 'Graph',
  'advanced-sorting': 'Advanced sorting',
  'array-string': 'Array and string',
  backtracking: 'Backtracking',
};

/**
 * 内容层的分组结构 -> 侧边栏要的形状。
 *
 * 英文：标题取 `.en.md` 里的，那一篇还没翻就落回中文原标题，不留空。
 * 中文：一律用原文的 frontmatter，中文那一份从来不缺。
 */
export function toDocSections(sections: NoteSection[], lang: Lang): DocSection[] {
  const en = lang === 'en';
  return sections.map((section) => ({
    id: section.id,
    title: en
      ? (SECTION_TITLES_EN[section.id] ?? section.titleEn ?? section.title)
      : section.title,
    icon: section.icon ? ICONS[section.icon] : undefined,
    items: section.items.map((item) => ({
      id: item.itemId,
      title: en ? (item.titleEn ?? item.title) : item.title,
      tier: item.tier,
    })),
  }));
}

/** 一篇笔记在当前语言下的标题 / 分组名 / 正文。中文那一份永远在，英文可能还没翻 */
export function noteView(
  note: { title: string; titleEn?: string; section: string; sectionEn?: string; content: string; contentEn?: string },
  lang: Lang
) {
  if (lang === 'zh') {
    return { title: note.title, section: note.section, content: note.content };
  }
  return {
    title: note.titleEn ?? note.title,
    section: note.sectionEn ?? note.section,
    content: note.contentEn ?? note.content,
  };
}
