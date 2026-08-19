import { useMemo } from 'react';
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';
import { EditableAnswer } from '@/components/docs/EditableAnswer';
import { EditableFieldTable } from '@/components/docs/EditableFieldTable';
import { parseSegments } from '@/lib/blocks';

interface Props {
  /** `<sectionId>/<itemId>`，和数据库里的 key 前缀一致 */
  noteId: string;
  content: string;
}

/**
 * 一篇笔记 = 若干只读 markdown 段 + 若干可编辑块。
 * 题目骨架仍在 markdown 里走 git，填进去的答案走数据库。
 */
export function NoteBody({ noteId, content }: Props) {
  const segments = useMemo(() => parseSegments(content), [content]);

  return (
    <div className="max-w-full">
      {segments.map((segment) => {
        if (segment.type === 'markdown') {
          return <MarkdownRenderer key={segment.key} content={segment.content} />;
        }

        const blockKey = `${noteId}::${segment.blockId}`;

        if (segment.type === 'fieldtable') {
          return <EditableFieldTable key={segment.key} blockKey={blockKey} seed={segment.seed} />;
        }

        return (
          <EditableAnswer
            key={segment.key}
            blockKey={blockKey}
            seed={segment.seed}
            hint={segment.hint}
          />
        );
      })}
    </div>
  );
}
