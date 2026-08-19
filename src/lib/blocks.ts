/**
 * 把一篇笔记的 markdown 切成「普通段落」和「可编辑块」。
 *
 * 站是静态的，markdown 仍然是题目骨架的唯一来源（走 git）；
 * 填进去的答案走 Neon，两边靠 blockId 对上。markdown 没被改动过的块，
 * 数据库里没有记录时就退回 markdown 里的原始形态（种子）。
 */

import { slugify } from '@/lib/utils';

export type FieldRowKind = 'text' | 'tags';

export interface FieldRow {
  id: string;
  label: string;
  /** kind === 'text' 时是填写内容 */
  value: string;
  kind: FieldRowKind;
  /** kind === 'tags' 时的候选标签 */
  options?: string[];
  /** kind === 'tags' 时选中的标签 */
  selected?: string[];
}

export interface FieldTableData {
  headers: [string, string];
  rows: FieldRow[];
}

export interface AnswerData {
  text: string;
}

export type BlockData = FieldTableData | AnswerData;

export type Segment =
  | { type: 'markdown'; key: string; content: string }
  | { type: 'fieldtable'; key: string; blockId: string; seed: FieldTableData }
  | { type: 'answer'; key: string; blockId: string; seed: AnswerData; hint?: string };

const FIELD_TABLE_HEAD = /^\|\s*项\s*\|\s*填写\s*\|\s*$/;
const TABLE_DIVIDER = /^\|[\s:|-]+\|\s*$/;
const PLACEHOLDER = /^_待填_$/;
const QUOTE_PLACEHOLDER = /^>\s*待填\s*(?:——\s*(.*))?$/;

/** `` `A` / `B` / `C` `` → ['A', 'B', 'C'] */
function parseTagOptions(cell: string): string[] {
  return cell
    .split('/')
    .map((part) => part.trim().replace(/^`|`$/g, '').trim())
    .filter(Boolean);
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function stripEmphasis(label: string): string {
  return label.replace(/\*\*/g, '').trim();
}

/**
 * blockId 挂在最近的标题上，而不是行号或全局序号：
 * 往笔记中间插一段不会让已经填好的答案错位。
 */
function makeBlockId(heading: string, kind: string, ordinal: number): string {
  const anchor = heading ? slugify(heading) : 'root';
  return `${anchor}#${kind}${ordinal}`;
}

export function parseSegments(markdown: string): Segment[] {
  const lines = markdown.split(/\r?\n/);
  const segments: Segment[] = [];

  let buffer: string[] = [];
  let heading = '';
  const ordinals = new Map<string, number>();

  const nextOrdinal = (kind: string) => {
    const key = `${heading}::${kind}`;
    const next = (ordinals.get(key) ?? 0) + 1;
    ordinals.set(key, next);
    return next;
  };

  const flush = () => {
    if (!buffer.length) return;
    const content = buffer.join('\n');
    buffer = [];
    if (!content.trim()) return;
    segments.push({ type: 'markdown', key: `md-${segments.length}`, content });
  };

  let inFence = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (/^\s*```/.test(line)) inFence = !inFence;

    if (inFence) {
      buffer.push(line);
      continue;
    }

    const headingMatch = line.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch) {
      heading = headingMatch[1].trim();
      buffer.push(line);
      continue;
    }

    // 「项 / 填写」表 → 可编辑字段表
    if (FIELD_TABLE_HEAD.test(line.trim()) && TABLE_DIVIDER.test((lines[i + 1] ?? '').trim())) {
      flush();

      const rows: FieldRow[] = [];
      let cursor = i + 2;
      while (cursor < lines.length && lines[cursor].trim().startsWith('|')) {
        const cells = splitRow(lines[cursor].trim());
        const rawLabel = cells[0] ?? '';
        const rawValue = cells[1] ?? '';
        const label = stripEmphasis(rawLabel);
        const isTags = label === '标签';

        rows.push({
          id: `r${rows.length + 1}`,
          label,
          value: isTags ? '' : rawValue,
          kind: isTags ? 'tags' : 'text',
          ...(isTags ? { options: parseTagOptions(rawValue), selected: [] } : {}),
        });
        cursor += 1;
      }

      const ordinal = nextOrdinal('table');
      segments.push({
        type: 'fieldtable',
        key: `tbl-${segments.length}`,
        blockId: makeBlockId(heading, 'table', ordinal),
        seed: { headers: ['项', '填写'], rows },
      });

      i = cursor - 1;
      continue;
    }

    // `> 待填` 引用块 → 可编辑答案
    const quoteMatch = line.trim().match(QUOTE_PLACEHOLDER);
    if (quoteMatch) {
      flush();
      const ordinal = nextOrdinal('answer');
      segments.push({
        type: 'answer',
        key: `ans-${segments.length}`,
        blockId: makeBlockId(heading, 'answer', ordinal),
        seed: { text: '' },
        hint: quoteMatch[1]?.trim() || undefined,
      });
      continue;
    }

    // 独占一行的 `_待填_` → 可编辑答案
    if (PLACEHOLDER.test(line.trim())) {
      flush();
      const ordinal = nextOrdinal('answer');
      segments.push({
        type: 'answer',
        key: `ans-${segments.length}`,
        blockId: makeBlockId(heading, 'answer', ordinal),
        seed: { text: '' },
      });
      continue;
    }

    buffer.push(line);
  }

  flush();
  return segments;
}

export function isFieldTableData(data: BlockData): data is FieldTableData {
  return Array.isArray((data as FieldTableData).rows);
}
