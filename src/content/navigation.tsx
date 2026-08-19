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

/** 内容层的分组结构 -> 侧边栏要的形状 */
export function toDocSections(sections: NoteSection[]): DocSection[] {
  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    icon: section.icon ? ICONS[section.icon] : undefined,
    items: section.items.map((item) => ({ id: item.itemId, title: item.title })),
  }));
}
