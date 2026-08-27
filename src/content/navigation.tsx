import type { ReactNode } from 'react';
import {
  Calculator,
  Database,
  FileText,
  Gamepad2,
  Landmark,
  List,
  Map,
  Mic2,
  Microscope,
  Radio,
  Repeat,
  Workflow,
  Wrench,
} from 'lucide-react';
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
  repeat: <Repeat className="w-4 h-4" />,
  'file-text': <FileText className="w-4 h-4" />,
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
  course: 'Course and older notes',
};

/**
 * 内容层的分组结构 -> 侧边栏要的形状。
 * 英文模式下取 `.en.md` 里的标题；那一篇还没翻就照常用中文，不留空。
 */
export function toDocSections(sections: NoteSection[], lang: 'zh' | 'en' = 'zh'): DocSection[] {
  const pick = (zh: string, en?: string) => (lang === 'en' && en ? en : zh);
  return sections.map((section) => ({
    id: section.id,
    title: pick(section.title, SECTION_TITLES_EN[section.id] ?? section.titleEn),
    icon: section.icon ? ICONS[section.icon] : undefined,
    items: section.items.map((item) => ({
      id: item.itemId,
      title: pick(item.title, item.titleEn),
      tier: item.tier,
    })),
  }));
}
